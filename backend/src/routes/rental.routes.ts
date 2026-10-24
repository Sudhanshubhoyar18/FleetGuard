import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { auditService } from '../services/audit.service.js';
import { notificationService } from '../services/notification.service.js';

export const rentalRouter = Router();

rentalRouter.get('/', async (req, res) => {
  try {
    const status = req.query.status as string;
    const vehicleId = req.query.vehicleId as string;

    const where: any = {};
    if (status) where.status = status;
    if (vehicleId) where.vehicleId = vehicleId;

    const rentals = await prisma.rentalOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: {
          select: { plateNumber: true, make: true, model: true }
        },
        events: {
          orderBy: { timestamp: 'desc' },
          take: 5
        }
      }
    });

    res.json(rentals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

rentalRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      vehicleId,
      customerName,
      customerEmail,
      customerPhone,
      customerIdNumber,
      startDateTime,
      expectedReturnDateTime,
      startLocation,
      destinationAddress,
      destinationLatitude,
      destinationLongitude,
      allowedDistanceKm,
      geofenceRadiusKm,
      speedLimitKmH,
      notes
    } = req.body;

    if (!vehicleId || !customerName || !customerPhone || !startDateTime || !expectedReturnDateTime || !allowedDistanceKm) {
      return res.status(400).json({
        error: 'vehicleId, customerName, customerPhone, startDateTime, expectedReturnDateTime, and allowedDistanceKm are required.'
      });
    }

    const count = await prisma.rentalOrder.count();
    const orderNumber = `RNT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const rental = await prisma.rentalOrder.create({
      data: {
        orderNumber,
        vehicleId,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone,
        customerIdNumber: customerIdNumber || null,
        startDateTime: new Date(startDateTime),
        expectedReturnDateTime: new Date(expectedReturnDateTime),
        startLocation: startLocation || 'Fleet Hub HQ',
        destinationAddress: destinationAddress || 'City Limits',
        destinationLatitude: destinationLatitude ? parseFloat(destinationLatitude) : null,
        destinationLongitude: destinationLongitude ? parseFloat(destinationLongitude) : null,
        allowedDistanceKm: parseFloat(allowedDistanceKm),
        geofenceRadiusKm: geofenceRadiusKm ? parseFloat(geofenceRadiusKm) : 15.0,
        speedLimitKmH: speedLimitKmH ? parseFloat(speedLimitKmH) : 80.0,
        status: 'ACTIVE',
        notes: notes || null
      },
      include: {
        vehicle: true
      }
    });

    // Update vehicle status
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'IN_RENTAL' }
    });

    // Record creation event
    await prisma.rentalEvent.create({
      data: {
        rentalOrderId: rental.id,
        eventType: 'CREATED',
        message: `Rental order #${orderNumber} created for customer ${customerName}. Allowance: ${allowedDistanceKm} km.`
      }
    });

    await auditService.log({
      userId: req.user?.userId,
      action: 'RENTAL_CREATED',
      resourceType: 'RENTAL_ORDER',
      resourceId: rental.id,
      details: { orderNumber, vehicleId, customerName }
    });

    await notificationService.notify({
      title: `New Rental Order: #${orderNumber}`,
      message: `Rental order #${orderNumber} created for ${rental.vehicle.plateNumber} by ${customerName}.`,
      category: 'RENTAL_LIMIT',
      severity: 'INFO',
      telegramText: `📄 <b>NEW RENTAL CREATED</b>\n\n🆔 <b>Order:</b> #${orderNumber}\n🚘 <b>Vehicle:</b> ${rental.vehicle.plateNumber}\n👤 <b>Customer:</b> ${customerName} (${customerPhone})\n📍 <b>Destination:</b> ${rental.destinationAddress}\n📏 <b>Allowance:</b> ${allowedDistanceKm} km`
    });

    res.status(201).json(rental);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

rentalRouter.get('/:id', async (req, res) => {
  try {
    const rental = await prisma.rentalOrder.findUnique({
      where: { id: req.params.id },
      include: {
        vehicle: true,
        trips: {
          orderBy: { startTime: 'desc' }
        },
        events: {
          orderBy: { timestamp: 'desc' }
        },
        speedAlerts: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!rental) {
      return res.status(404).json({ error: 'Rental order not found' });
    }

    res.json(rental);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

rentalRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rentalId = req.params.id as string;
    const { status, notes, allowedDistanceKm, speedLimitKmH, destinationAddress } = req.body;
    const data: any = {};
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (allowedDistanceKm !== undefined) data.allowedDistanceKm = parseFloat(allowedDistanceKm);
    if (speedLimitKmH !== undefined) data.speedLimitKmH = parseFloat(speedLimitKmH);
    if (destinationAddress !== undefined) data.destinationAddress = destinationAddress;

    const rental = await prisma.rentalOrder.update({
      where: { id: rentalId },
      data,
      include: { vehicle: true }
    });

    res.json(rental);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

rentalRouter.post('/:id/start', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rentalId = req.params.id as string;
    const rental = await prisma.rentalOrder.update({
      where: { id: rentalId },
      data: {
        status: 'ACTIVE',
        startDateTime: new Date()
      },
      include: { vehicle: true }
    });

    await prisma.vehicle.update({
      where: { id: rental.vehicleId },
      data: { status: 'IN_RENTAL' }
    });

    await prisma.rentalEvent.create({
      data: {
        rentalOrderId: rental.id,
        eventType: 'STARTED',
        message: `Rental order #${rental.orderNumber} initiated active checkout.`
      }
    });

    res.json(rental);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

rentalRouter.post('/:id/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rentalId = req.params.id as string;
    const rental = await prisma.rentalOrder.update({
      where: { id: rentalId },
      data: {
        status: 'COMPLETED',
        actualReturnDateTime: new Date()
      },
      include: { vehicle: true }
    });

    // Reset vehicle status to ACTIVE
    await prisma.vehicle.update({
      where: { id: rental.vehicleId },
      data: { status: 'ACTIVE' }
    });

    await prisma.rentalEvent.create({
      data: {
        rentalOrderId: rental.id,
        eventType: 'COMPLETED',
        message: `Rental completed. Final distance travelled: ${rental.totalDistanceTravelledKm.toFixed(1)} km.`
      }
    });

    res.json(rental);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
