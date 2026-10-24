import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { config } from '../config/index.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { auditService } from '../services/audit.service.js';

export const settingsRouter = Router();

settingsRouter.get('/', async (req, res) => {
  try {
    const dbSettings = await prisma.appSetting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of dbSettings) {
      settingsMap[s.key] = s.value;
    }

    res.json({
      telegramBotTokenConfigured: Boolean(config.telegram.botToken || settingsMap.TELEGRAM_BOT_TOKEN),
      telegramChatId: settingsMap.TELEGRAM_CHAT_ID || config.telegram.chatId || '',
      googleMapsKeyConfigured: Boolean(config.googleMaps.serverApiKey || settingsMap.GOOGLE_MAPS_SERVER_API_KEY),
      heartbeatTimeoutSeconds: settingsMap.HEARTBEAT_TIMEOUT_SECONDS
        ? parseInt(settingsMap.HEARTBEAT_TIMEOUT_SECONDS, 10)
        : config.telemetry.heartbeatTimeoutSeconds,
      gpsMaxValidSpeedKmH: settingsMap.GPS_MAX_VALID_SPEED_KMH
        ? parseFloat(settingsMap.GPS_MAX_VALID_SPEED_KMH)
        : config.telemetry.maxValidSpeedKmH,
      gpsMaxDistanceJumpKm: settingsMap.GPS_MAX_DISTANCE_JUMP_KM
        ? parseFloat(settingsMap.GPS_MAX_DISTANCE_JUMP_KM)
        : config.telemetry.maxDistanceJumpKm,
      speedAlertCooldownSeconds: settingsMap.SPEED_ALERT_COOLDOWN_SECONDS
        ? parseInt(settingsMap.SPEED_ALERT_COOLDOWN_SECONDS, 10)
        : config.telemetry.speedAlertCooldownSeconds,
      cellularModuleType: 'SIM800L (2G GSM/GPRS)'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.patch('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      telegramBotToken,
      telegramChatId,
      heartbeatTimeoutSeconds,
      gpsMaxValidSpeedKmH,
      gpsMaxDistanceJumpKm,
      speedAlertCooldownSeconds
    } = req.body;

    const updates: { key: string; value: string; description?: string }[] = [];

    if (telegramBotToken !== undefined) {
      updates.push({ key: 'TELEGRAM_BOT_TOKEN', value: telegramBotToken, description: 'Telegram Bot API Token' });
      config.telegram.botToken = telegramBotToken;
    }
    if (telegramChatId !== undefined) {
      updates.push({ key: 'TELEGRAM_CHAT_ID', value: telegramChatId, description: 'Telegram Default Chat ID' });
      config.telegram.chatId = telegramChatId;
    }
    if (heartbeatTimeoutSeconds !== undefined) {
      updates.push({ key: 'HEARTBEAT_TIMEOUT_SECONDS', value: String(heartbeatTimeoutSeconds), description: 'Device offline timeout in seconds' });
      config.telemetry.heartbeatTimeoutSeconds = parseInt(heartbeatTimeoutSeconds, 10);
    }
    if (gpsMaxValidSpeedKmH !== undefined) {
      updates.push({ key: 'GPS_MAX_VALID_SPEED_KMH', value: String(gpsMaxValidSpeedKmH), description: 'Maximum valid speed filter' });
      config.telemetry.maxValidSpeedKmH = parseFloat(gpsMaxValidSpeedKmH);
    }
    if (gpsMaxDistanceJumpKm !== undefined) {
      updates.push({ key: 'GPS_MAX_DISTANCE_JUMP_KM', value: String(gpsMaxDistanceJumpKm), description: 'Maximum GPS jump threshold' });
      config.telemetry.maxDistanceJumpKm = parseFloat(gpsMaxDistanceJumpKm);
    }
    if (speedAlertCooldownSeconds !== undefined) {
      updates.push({ key: 'SPEED_ALERT_COOLDOWN_SECONDS', value: String(speedAlertCooldownSeconds), description: 'Speed alert rate-limit cooldown' });
      config.telemetry.speedAlertCooldownSeconds = parseInt(speedAlertCooldownSeconds, 10);
    }

    for (const update of updates) {
      await prisma.appSetting.upsert({
        where: { key: update.key },
        update: { value: update.value, description: update.description },
        create: { key: update.key, value: update.value, description: update.description }
      });
    }

    await auditService.log({
      userId: req.user?.userId,
      action: 'SETTINGS_UPDATED',
      resourceType: 'SYSTEM',
      details: { updatedKeys: updates.map((u) => u.key) }
    });

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
