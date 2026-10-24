import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const alertRouter = Router();

alertRouter.get('/', async (req, res) => {
  try {
    const vehicleId = req.query.vehicleId as string;
    const isAcknowledged = req.query.isAcknowledged !== undefined ? req.query.isAcknowledged === 'true' : undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (isAcknowledged !== undefined) where.isAcknowledged = isAcknowledged;

    const alerts = await prisma.speedAlert.findMany({
      where,
      orderBy: { timestamp: 'desc' },
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

    res.json(alerts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

alertRouter.post('/:id/acknowledge', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const alertId = req.params.id as string;
    const alert = await prisma.speedAlert.update({
      where: { id: alertId },
      data: {
        isAcknowledged: true,
        acknowledgedBy: req.user?.name || req.user?.email || 'Operator',
        acknowledgedAt: new Date()
      }
    });

    res.json(alert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
