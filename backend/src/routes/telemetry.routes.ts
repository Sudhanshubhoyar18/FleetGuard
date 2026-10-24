import { Router } from 'express';
import { requireDeviceAuth } from '../middleware/deviceAuth.middleware.js';
import { telemetryService, type TelemetryPacket } from '../services/telemetry.service.js';

export const telemetryRouter = Router();

telemetryRouter.post('/', requireDeviceAuth, async (req, res) => {
  try {
    const payload = req.body;

    // Handle batch buffer upload
    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return res.status(400).json({ error: 'Empty telemetry batch array' });
      }
      const results = await telemetryService.processBatch(payload as TelemetryPacket[]);
      return res.status(200).json({
        batchSize: payload.length,
        results
      });
    }

    // Handle single telemetry packet
    if (!payload.deviceId || payload.latitude === undefined || payload.longitude === undefined) {
      return res.status(400).json({
        error: 'Invalid telemetry payload. deviceId, latitude, and longitude are required.'
      });
    }

    const result = await telemetryService.processTelemetry(payload as TelemetryPacket);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
