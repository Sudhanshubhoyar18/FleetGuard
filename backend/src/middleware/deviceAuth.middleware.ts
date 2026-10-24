import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { prisma } from '../prisma/client.js';

export interface DeviceAuthenticatedRequest extends Request {
  device?: any;
}

/**
 * Middleware to authenticate requests originating from ESP32 IoT devices or the Simulator.
 * Looks for 'x-device-token' header or Bearer token.
 */
export async function requireDeviceAuth(req: DeviceAuthenticatedRequest, res: Response, next: NextFunction) {
  const token = (req.headers['x-device-token'] as string) ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({
      error: 'Device Unauthorized',
      message: 'Missing device authentication token. Supply x-device-token header.'
    });
  }

  // 1. Quick check against shared device master secret
  if (token === config.deviceAuthSecret) {
    return next();
  }

  // 2. Or verify against individual device token / deviceId
  const deviceId = (req.body?.deviceId as string) || (req.params?.id as string);
  if (deviceId) {
    const device = await prisma.device.findUnique({
      where: { deviceId }
    });

    if (device && (device.authSecretHash === token || token === config.deviceAuthSecret)) {
      req.device = device;
      return next();
    }
  }

  return res.status(403).json({
    error: 'Device Forbidden',
    message: 'Invalid device credentials.'
  });
}
