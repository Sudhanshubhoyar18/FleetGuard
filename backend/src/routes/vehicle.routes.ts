import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { auditService } from '../services/audit.service.js';

export const vehicleRouter = Router();

vehicleRouter.get('/', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        devices: {
          select: {
            id: true,
            deviceId: true,
            isOnline: true,
            lastHeartbeatAt: true,
            lastGpsFixAt: true,
            cellularSignalRssi: true,
            model: true,
            firmwareVersion: true
          }
        },
        rentalOrders: {
          where: { status: 'ACTIVE' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Enrich each vehicle with its latest valid GPS telemetry
    const enriched = await Promise.all(
      vehicles.map(async (v) => {
        const latestTelemetry = await prisma.telemetry.findFirst({
          where: { vehicleId: v.id, isGpsValid: true },
          orderBy: { timestamp: 'desc' }
        });

        // Compute total distance across all completed and active trips
        const tripDistanceAgg = await prisma.trip.aggregate({
          where: { vehicleId: v.id },
          _sum: { totalDistanceKm: true }
        });

        const assignedDevice = v.devices[0] || null;
        const isDeviceOnline = Boolean(assignedDevice?.isOnline);

        return {
          ...v,
          isOnline: isDeviceOnline,
          totalDistanceKm: Math.round((tripDistanceAgg._sum.totalDistanceKm || 0) * 10) / 10,
          activeRental: v.rentalOrders[0] || null,
          latestLocation: latestTelemetry
            ? {
                latitude: latestTelemetry.latitude,
                longitude: latestTelemetry.longitude,
                speedKmH: latestTelemetry.speedKmH,
                headingDegrees: latestTelemetry.headingDegrees,
                timestamp: latestTelemetry.timestamp,
                isSimulated: latestTelemetry.isSimulated,
                isStale: Date.now() - new Date(latestTelemetry.timestamp).getTime() > 5 * 60 * 1000 // > 5 mins
              }
            : null
        };
      })
    );

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

vehicleRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { plateNumber, vin, make, model, year, speedLimit } = req.body;
    if (!plateNumber || !make || !model || !year) {
      return res.status(400).json({ error: 'plateNumber, make, model, and year are required' });
    }

    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber: plateNumber.toUpperCase().trim() }
    });

    if (existing) {
      return res.status(400).json({ error: `Vehicle with plate number ${plateNumber} already exists` });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber: plateNumber.toUpperCase().trim(),
        vin: vin ? vin.toUpperCase().trim() : null,
        make,
        model,
        year: parseInt(year, 10),
        speedLimit: speedLimit ? parseFloat(speedLimit) : 80.0,
      }
    });

    await auditService.log({
      userId: req.user?.userId,
      action: 'VEHICLE_CREATED',
      resourceType: 'VEHICLE',
      resourceId: vehicle.id,
      details: { plateNumber: vehicle.plateNumber, make, model }
    });

    res.status(201).json(vehicle);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

vehicleRouter.get('/:id', async (req, res) => {
  try {
    const vehicleId = req.params.id as string;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        devices: true,
        rentalOrders: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        speedAlerts: {
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        trips: {
          orderBy: { startTime: 'desc' },
          take: 10
        }
      }
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const latestTelemetry = await prisma.telemetry.findFirst({
      where: { vehicleId: vehicle.id, isGpsValid: true },
      orderBy: { timestamp: 'desc' }
    });

    res.json({
      ...vehicle,
      latestLocation: latestTelemetry
        ? {
            latitude: latestTelemetry.latitude,
            longitude: latestTelemetry.longitude,
            speedKmH: latestTelemetry.speedKmH,
            headingDegrees: latestTelemetry.headingDegrees,
            timestamp: latestTelemetry.timestamp,
            isSimulated: latestTelemetry.isSimulated,
            isStale: Date.now() - new Date(latestTelemetry.timestamp).getTime() > 5 * 60 * 1000
          }
        : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

vehicleRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const vehicleId = req.params.id as string;
    const { speedLimit, status, make, model, year, deviceId } = req.body;

    const data: any = {};
    if (speedLimit !== undefined) data.speedLimit = parseFloat(speedLimit);
    if (status !== undefined) data.status = status;
    if (make !== undefined) data.make = make;
    if (model !== undefined) data.model = model;
    if (year !== undefined) data.year = parseInt(year, 10);

    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data
    });

    if (deviceId) {
      // Re-assign device
      await prisma.device.update({
        where: { deviceId },
        data: { vehicleId: vehicle.id }
      });
    }

    await auditService.log({
      userId: req.user?.userId,
      action: 'VEHICLE_UPDATED',
      resourceType: 'VEHICLE',
      resourceId: vehicle.id,
      details: req.body
    });

    res.json(vehicle);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

vehicleRouter.get('/:id/location', async (req, res) => {
  try {
    const vehicleId = req.params.id as string;
    const latest = await prisma.telemetry.findFirst({
      where: { vehicleId, isGpsValid: true },
      orderBy: { timestamp: 'desc' }
    });

    if (!latest) {
      return res.status(404).json({ error: 'No GPS telemetry available for this vehicle' });
    }

    const isStale = Date.now() - new Date(latest.timestamp).getTime() > 5 * 60 * 1000;

    res.json({
      latitude: latest.latitude,
      longitude: latest.longitude,
      speedKmH: latest.speedKmH,
      headingDegrees: latest.headingDegrees,
      timestamp: latest.timestamp,
      isGpsValid: latest.isGpsValid,
      isSimulated: latest.isSimulated,
      isStale,
      staleWarning: isStale ? 'Location data is older than 5 minutes. Device may be parked or offline.' : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

vehicleRouter.get('/:id/history', async (req, res) => {
  try {
    const vehicleId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 200;
    const history = await prisma.telemetry.findMany({
      where: {
        vehicleId,
        isGpsValid: true
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 1000),
      select: {
        id: true,
        timestamp: true,
        latitude: true,
        longitude: true,
        speedKmH: true,
        headingDegrees: true,
        isSimulated: true
      }
    });

    res.json(history.reverse());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

vehicleRouter.get('/:id/trips', async (req, res) => {
  try {
    const vehicleId = req.params.id as string;
    const trips = await prisma.trip.findMany({
      where: { vehicleId },
      orderBy: { startTime: 'desc' },
      include: {
        points: {
          select: {
            latitude: true,
            longitude: true,
            speedKmH: true,
            timestamp: true
          },
          take: 500
        }
      }
    });
    res.json(trips);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
