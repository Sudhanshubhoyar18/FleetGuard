import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireDeviceAuth } from '../middleware/deviceAuth.middleware.js';
import { telemetryService } from '../services/telemetry.service.js';
import { config } from '../config/index.js';

export const deviceRouter = Router();

deviceRouter.get('/', async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        vehicle: {
          select: { id: true, plateNumber: true, make: true, model: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const now = Date.now();
    const timeoutMs = config.telemetry.heartbeatTimeoutSeconds * 1000;

    const enriched = devices.map((d) => {
      // Dynamic online evaluation based on last heartbeat
      const isOnlineReal = Boolean(d.lastHeartbeatAt && now - new Date(d.lastHeartbeatAt).getTime() <= timeoutMs);

      return {
        ...d,
        isOnline: isOnlineReal,
        secondsSinceHeartbeat: d.lastHeartbeatAt
          ? Math.floor((now - new Date(d.lastHeartbeatAt).getTime()) / 1000)
          : null,
        heartbeatTimeoutSeconds: config.telemetry.heartbeatTimeoutSeconds
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

deviceRouter.post('/register', requireAuth, async (req, res) => {
  try {
    const { deviceId, model, firmwareVersion, vehicleId, authSecret } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const existing = await prisma.device.findUnique({
      where: { deviceId }
    });

    if (existing) {
      return res.status(400).json({ error: `Device with ID ${deviceId} is already registered` });
    }

    const device = await prisma.device.create({
      data: {
        deviceId,
        model: model || 'ESP32-SIM800L',
        firmwareVersion: firmwareVersion || '1.0.0',
        authSecretHash: authSecret || config.deviceAuthSecret,
        vehicleId: vehicleId || null,
        isOnline: false
      },
      include: {
        vehicle: true
      }
    });

    res.status(201).json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

deviceRouter.get('/:id/status', async (req, res) => {
  try {
    const devId = req.params.id as string;
    const device = await prisma.device.findFirst({
      where: {
        OR: [{ id: devId }, { deviceId: devId }]
      },
      include: {
        vehicle: true,
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 20
        }
      }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const now = Date.now();
    const timeoutMs = config.telemetry.heartbeatTimeoutSeconds * 1000;
    const isOnline = Boolean(device.lastHeartbeatAt && now - new Date(device.lastHeartbeatAt).getTime() <= timeoutMs);

    res.json({
      device: {
        ...device,
        isOnline
      },
      recentHeartbeats: device.heartbeats
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

deviceRouter.post('/:id/heartbeat', requireDeviceAuth, async (req, res) => {
  try {
    const deviceId = req.params.id as string;
    const { batteryVoltage, gsmSignal, networkStatus, isGpsLocked, memoryFreeBytes } = req.body;

    const result = await telemetryService.processHeartbeat({
      deviceId,
      batteryVoltage,
      gsmSignal,
      networkStatus,
      isGpsLocked,
      memoryFreeBytes
    });

    res.json({ success: true, timestamp: result.timestamp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
