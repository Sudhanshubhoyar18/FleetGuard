import { prisma } from '../prisma/client.js';
import { config } from '../config/index.js';
import { wsServer } from '../websocket/wsServer.js';
import { notificationService } from './notification.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DeviceSupervisor');

export class DeviceSupervisor {
  private timer: NodeJS.Timeout | null = null;

  start() {
    this.timer = setInterval(() => {
      this.checkHeartbeats().catch((err) => {
        logger.error(`Error in heartbeat supervisor check: ${err.message}`);
      });
    }, 10000); // Check every 10 seconds

    logger.info(`Device supervisor started (Heartbeat timeout: ${config.telemetry.heartbeatTimeoutSeconds}s)`);
  }

  async checkHeartbeats() {
    const timeoutMs = config.telemetry.heartbeatTimeoutSeconds * 1000;
    const thresholdTime = new Date(Date.now() - timeoutMs);

    // Find all devices currently marked online whose last heartbeat is older than threshold
    const timedOutDevices = await prisma.device.findMany({
      where: {
        isOnline: true,
        OR: [
          { lastHeartbeatAt: { lt: thresholdTime } },
          { lastHeartbeatAt: null }
        ]
      },
      include: {
        vehicle: true
      }
    });

    for (const device of timedOutDevices) {
      await prisma.device.update({
        where: { id: device.id },
        data: { isOnline: false }
      });

      logger.warn(`Device ${device.deviceId} timed out. Transitioned to OFFLINE.`);

      // Broadcast to WebSocket clients
      wsServer.broadcast('DEVICE_STATUS', {
        deviceId: device.deviceId,
        isOnline: false,
        lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() || null
      });

      // Notification
      await notificationService.notify({
        title: `Device Offline: ${device.deviceId}`,
        message: `IoT Tracker device ${device.deviceId} (Assigned to: ${device.vehicle?.plateNumber || 'Unassigned'}) is offline. No heartbeat for over ${config.telemetry.heartbeatTimeoutSeconds}s.`,
        category: 'DEVICE_STATUS',
        severity: 'WARNING',
        telegramText: `⚠️ <b>DEVICE OFFLINE</b>\n\n📟 <b>Device ID:</b> <code>${device.deviceId}</code>\n🚘 <b>Vehicle:</b> ${device.vehicle?.plateNumber || 'None'}\n🕒 <b>Last Seen:</b> ${device.lastHeartbeatAt ? device.lastHeartbeatAt.toISOString() : 'Never'}`
      });
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const deviceSupervisor = new DeviceSupervisor();
export default deviceSupervisor;
