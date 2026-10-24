import { prisma } from '../prisma/client.js';
import { config } from '../config/index.js';
import { wsServer } from '../websocket/wsServer.js';
import { notificationService } from './notification.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('SpeedAlertService');

export class SpeedAlertService {
  // Vehicle ID -> timestamp of last triggered alert
  private lastAlertTimestamp: Map<string, number> = new Map();

  async evaluateSpeed(params: {
    vehicleId: string;
    plateNumber: string;
    speedKmH: number;
    latitude: number;
    longitude: number;
    timestamp: Date;
    rentalOrderId?: string | null;
    customSpeedLimit?: number | null;
  }) {
    const { vehicleId, plateNumber, speedKmH, latitude, longitude, timestamp, rentalOrderId } = params;

    // Check configured speed limit
    let effectiveLimit = params.customSpeedLimit || 80.0;
    if (!params.customSpeedLimit) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { speedLimit: true }
      });
      if (vehicle?.speedLimit) {
        effectiveLimit = vehicle.speedLimit;
      }
    }

    if (speedKmH <= effectiveLimit) {
      return null;
    }

    // Cooldown check to prevent spamming notifications on every continuous GPS second
    const now = Date.now();
    const lastAlert = this.lastAlertTimestamp.get(vehicleId) || 0;
    const cooldownMs = config.telemetry.speedAlertCooldownSeconds * 1000;

    if (now - lastAlert < cooldownMs) {
      logger.debug(
        `Speed alert suppressed for vehicle ${plateNumber} (Speed: ${speedKmH.toFixed(1)} km/h > ${effectiveLimit} km/h). In cooldown window.`
      );
      return null;
    }

    this.lastAlertTimestamp.set(vehicleId, now);

    logger.warn(
      `🚨 Speed limit violation: Vehicle ${plateNumber} traveling at ${speedKmH.toFixed(1)} km/h (Limit: ${effectiveLimit} km/h)`
    );

    const alert = await prisma.speedAlert.create({
      data: {
        vehicleId,
        rentalOrderId: rentalOrderId || undefined,
        speedRecordedKmH: Math.round(speedKmH * 10) / 10,
        speedLimitKmH: effectiveLimit,
        latitude,
        longitude,
        timestamp,
        isAcknowledged: false,
      },
      include: {
        vehicle: {
          select: { plateNumber: true, make: true, model: true }
        }
      }
    });

    // Broadcast live over WebSocket
    wsServer.broadcast('SPEED_ALERT', alert);

    // Push notification & Telegram
    await notificationService.notify({
      title: `Speed Limit Exceeded: ${plateNumber}`,
      message: `Vehicle ${plateNumber} recorded at ${speedKmH.toFixed(1)} km/h on GPS (Configured limit: ${effectiveLimit} km/h). Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.`,
      category: 'SPEED_ALERT',
      severity: 'WARNING',
      telegramText: `🚨 <b>SPEED ALERT!</b>\n\n🚘 <b>Vehicle:</b> ${plateNumber}\n⚡ <b>Recorded Speed:</b> ${speedKmH.toFixed(1)} km/h\n🛑 <b>Speed Limit:</b> ${effectiveLimit} km/h\n📍 <b>Coordinates:</b> ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n🕒 <b>Time:</b> ${timestamp.toISOString()}`
    });

    return alert;
  }
}

export const speedAlertService = new SpeedAlertService();
export default speedAlertService;
