import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/index.js';
import { createLogger } from './utils/logger.js';
import { wsServer } from './websocket/wsServer.js';
import { deviceSupervisor } from './services/deviceSupervisor.service.js';
import { rentalService } from './services/rental.service.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import Routers
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { vehicleRouter } from './routes/vehicle.routes.js';
import { deviceRouter } from './routes/device.routes.js';
import { telemetryRouter } from './routes/telemetry.routes.js';
import { tripRouter } from './routes/trip.routes.js';
import { rentalRouter } from './routes/rental.routes.js';
import { alertRouter } from './routes/alert.routes.js';
import { historyRouter } from './routes/history.routes.js';
import { immobilizerRouter } from './routes/immobilizer.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { settingsRouter } from './routes/settings.routes.js';

const logger = createLogger('Server');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({
  origin: '*', // Allows cross-origin development between Vite and API
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-token']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  if (!req.url.includes('/health')) {
    logger.debug(`${req.method} ${req.url}`);
  }
  next();
});

// API Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/vehicles', vehicleRouter);
app.use('/api/devices', deviceRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/trips', tripRouter);
app.use('/api/rentals', rentalRouter);
app.use('/api/alerts', alertRouter);
app.use('/api/history', historyRouter);
app.use('/api', immobilizerRouter); // Contains /vehicles/:id/immobilizer/... and /devices/:id/immobilizer/...
app.use('/api/notifications', notificationRouter);
app.use('/api/settings', settingsRouter);

// Global Error Handling
app.use(errorHandler);

// Initialize WebSocket server
wsServer.init(server);

// Start IoT Supervisor daemons
deviceSupervisor.start();

// Periodically evaluate rental deadlines (every 60 seconds)
const rentalDeadlineInterval = setInterval(() => {
  rentalService.checkRentalDeadlines().catch((err) => {
    logger.error(`Error evaluating rental deadlines: ${err.message}`);
  });
}, 60000);

// Graceful Shutdown Handler
function handleGracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Gracefully stopping FleetGuard services...`);
  deviceSupervisor.stop();
  clearInterval(rentalDeadlineInterval);
  wsServer.shutdown();

  server.close(() => {
    logger.info('FleetGuard HTTP and WebSocket server stopped.');
    process.exit(0);
  });

  // Force close after 5 seconds if lingering sockets
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

// Start HTTP Server
server.listen(config.port, () => {
  logger.info(`========================================================`);
  logger.info(`🛡️ FleetGuard IoT & Fleet Management Backend Server`);
  logger.info(`📡 HTTP API:        http://localhost:${config.port}/api`);
  logger.info(`🔌 WebSocket Stream: ws://localhost:${config.port}/ws`);
  logger.info(`🕒 Cellular Module:  SIM800L (2G GSM/GPRS)`);
  logger.info(`⚙️  Environment:     ${process.env.NODE_ENV || 'development'}`);
  logger.info(`========================================================`);
});

export { app, server };
