import { prisma } from '../prisma/client.js';
import { wsServer } from '../websocket/wsServer.js';
import { telegramService } from './telegram.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('NotificationService');

export interface CreateNotificationParams {
  title: string;
  message: string;
  category: 'DEVICE_STATUS' | 'SPEED_ALERT' | 'RENTAL_LIMIT' | 'GEOFENCE' | 'IMMOBILIZER' | 'SYSTEM_ERROR';
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  telegramText?: string;
}

export class NotificationService {
  async notify(params: CreateNotificationParams) {
    try {
      const notification = await prisma.notification.create({
        data: {
          title: params.title,
          message: params.message,
          category: params.category,
          severity: params.severity || 'INFO',
        }
      });

      // Broadcast to all active frontend dashboard WebSocket clients
      wsServer.broadcast('NOTIFICATION', notification);

      // Forward to Telegram if applicable
      const tgText = params.telegramText || `🛡️ <b>FleetGuard Alert: ${params.title}</b>\n\n${params.message}\n\nCategory: <code>${params.category}</code>\nSeverity: <b>${params.severity || 'INFO'}</b>`;
      await telegramService.sendMessage(tgText, params.category, notification.id);

      return notification;
    } catch (err: any) {
      logger.error(`Error dispatching notification: ${err.message}`);
      return null;
    }
  }

  async getRecent(limit: number = 20) {
    return prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        deliveryLogs: true
      }
    });
  }

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
  }

  async markAllAsRead() {
    return prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
