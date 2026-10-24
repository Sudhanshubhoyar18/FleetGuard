import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { tripService } from '../services/trip.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const tripRouter = Router();

tripRouter.get('/', async (req, res) => {
  try {
    const vehicleId = req.query.vehicleId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;

    const trips = await prisma.trip.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: limit,
      include: {
        vehicle: {
          select: { plateNumber: true, make: true, model: true }
        },
        rentalOrder: {
          select: { orderNumber: true, customerName: true }
        }
      }
    });

    res.json(trips);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

tripRouter.get('/:id', async (req, res) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: {
        vehicle: true,
        rentalOrder: true,
        points: {
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            latitude: true,
            longitude: true,
            speedKmH: true,
            headingDegrees: true,
            distanceDeltaKm: true,
            timestamp: true
          }
        }
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    res.json(trip);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

tripRouter.post('/start', requireAuth, async (req, res) => {
  try {
    const { vehicleId, rentalOrderId, startLat, startLng } = req.body;
    if (!vehicleId) {
      return res.status(400).json({ error: 'vehicleId is required' });
    }

    const trip = await tripService.startTrip({
      vehicleId,
      rentalOrderId,
      startLat,
      startLng
    });

    res.status(201).json(trip);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

tripRouter.post('/:id/end', requireAuth, async (req, res) => {
  try {
    const tripId = req.params.id as string;
    const { endLat, endLng } = req.body;
    const trip = await tripService.endTrip(tripId, endLat, endLng);
    res.json(trip);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
