import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireDeviceAuth } from '../middleware/deviceAuth.middleware.js';
import { immobilizerService } from '../services/immobilizer.service.js';

export const immobilizerRouter = Router();

// Operator creates command
immobilizerRouter.post('/vehicles/:id/immobilizer/commands', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const vehicleId = req.params.id as string;
    const { commandType, reason, isSimulated } = req.body;

    if (!commandType || !['IMMOBILIZE', 'RESTORE'].includes(commandType)) {
      return res.status(400).json({ error: "commandType must be either 'IMMOBILIZE' or 'RESTORE'" });
    }

    if (!reason) {
      return res.status(400).json({ error: 'A specific reason/justification is required for vehicle immobilization commands' });
    }

    const result = await immobilizerService.submitCommand({
      vehicleId,
      commandType,
      reason,
      userId: req.user?.userId,
      ipAddress: req.ip,
      isSimulated: Boolean(isSimulated)
    });

    res.status(202).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get vehicle immobilizer status & history
immobilizerRouter.get('/vehicles/:id/immobilizer/status', async (req, res) => {
  try {
    const vehicleId = req.params.id as string;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        plateNumber: true,
        immobilizerState: true,
        devices: {
          select: { id: true, deviceId: true, isOnline: true }
        }
      }
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const commands = await prisma.immobilizerCommand.findMany({
      where: { vehicleId },
      orderBy: { requestedAt: 'desc' },
      take: 20,
      include: {
        acknowledgments: true
      }
    });

    const latestTelemetry = await prisma.telemetry.findFirst({
      where: { vehicleId, isGpsValid: true },
      orderBy: { timestamp: 'desc' },
      select: { speedKmH: true, timestamp: true }
    });

    res.json({
      vehicleId,
      plateNumber: vehicle.plateNumber,
      immobilizerState: vehicle.immobilizerState,
      currentSpeedKmH: latestTelemetry?.speedKmH || 0,
      assignedDevice: vehicle.devices[0] || null,
      recentCommands: commands
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific command status
immobilizerRouter.get('/immobilizer/commands/:id', async (req, res) => {
  try {
    const commandId = req.params.id as string;
    const command = await prisma.immobilizerCommand.findUnique({
      where: { id: commandId },
      include: {
        vehicle: true,
        acknowledgments: true
      }
    });

    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }

    res.json(command);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Device polls for pending commands
immobilizerRouter.get('/devices/:id/immobilizer/pending', requireDeviceAuth, async (req, res) => {
  try {
    const devId = req.params.id as string;
    const device = await prisma.device.findFirst({
      where: {
        OR: [{ id: devId }, { deviceId: devId }]
      }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const command = await immobilizerService.getPendingCommandForDevice(device.id);
    if (!command) {
      return res.status(200).json({ hasPendingCommand: false });
    }

    res.json({
      hasPendingCommand: true,
      commandId: command.id,
      commandType: command.commandType,
      expiresAt: command.expiresAt
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Device acknowledges command execution
immobilizerRouter.post('/devices/:id/immobilizer/ack', requireDeviceAuth, async (req, res) => {
  try {
    const devId = req.params.id as string;
    const { commandId, relayState, vehicleSpeedAtAckKmH, isExecutionComplete, failureReason, rawPayload } = req.body;

    const device = await prisma.device.findFirst({
      where: {
        OR: [{ id: devId }, { deviceId: devId }]
      }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const updated = await immobilizerService.acknowledgeCommand({
      commandId,
      deviceId: device.id,
      relayState: relayState || 'ACTIVE',
      vehicleSpeedAtAckKmH: vehicleSpeedAtAckKmH ? parseFloat(vehicleSpeedAtAckKmH) : undefined,
      isExecutionComplete: Boolean(isExecutionComplete),
      failureReason,
      rawPayload
    });

    res.json({ success: true, command: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
