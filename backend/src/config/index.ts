import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET || 'fleetguard_dev_secret_key_892347891273918237912',
  deviceAuthSecret: process.env.DEVICE_AUTH_SECRET || 'fleetguard_device_shared_secret_token_2026',
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  googleMaps: {
    serverApiKey: process.env.GOOGLE_MAPS_SERVER_API_KEY || '',
  },
  telemetry: {
    heartbeatTimeoutSeconds: parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS || '60', 10),
    maxValidSpeedKmH: parseFloat(process.env.GPS_MAX_VALID_SPEED_KMH || '200'),
    maxDistanceJumpKm: parseFloat(process.env.GPS_MAX_DISTANCE_JUMP_KM || '5'),
    speedAlertCooldownSeconds: parseInt(process.env.SPEED_ALERT_COOLDOWN_SECONDS || '120', 10),
    minSpeedThresholdForMovingKmH: 2.5, // GPS drift noise filter below 2.5 km/h
    safeImmobilizeSpeedMaxKmH: 5.0, // Critical safety requirement: vehicle must be virtually stopped to cut off
  }
};
