import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { wsServer } from '../websocket/wsServer.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req, res) => {
  try {
    // Database connectivity probe
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'UP',
      service: 'FleetGuard Backend API',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: 'CONNECTED',
      activeWebSocketClients: wsServer.getConnectedClientsCount(),
      systemTime: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'DOWN',
      database: 'DISCONNECTED',
      error: err.message
    });
  }
});
