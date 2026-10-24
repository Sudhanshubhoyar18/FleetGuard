import { Router } from 'express';
import { notificationService } from '../services/notification.service.js';
import { telegramService } from '../services/telegram.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const notificationRouter = Router();

notificationRouter.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const notifications = await notificationService.getRecent(limit);
    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notificationRouter.post('/test', requireAuth, async (req, res) => {
  try {
    const { chatId } = req.body;
    const result = await telegramService.sendTestNotification(chatId);

    res.json({
      success: result.success,
      isMock: result.isMock,
      messageId: result.messageId,
      error: result.error,
      info: result.success
        ? 'Telegram test notification delivered to designated chat.'
        : 'Telegram notification could not be delivered. Please check bot token and chat ID.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notificationRouter.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const notifId = req.params.id as string;
    const updated = await notificationService.markAsRead(notifId);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

notificationRouter.post('/read-all', requireAuth, async (req, res) => {
  try {
    await notificationService.markAllAsRead();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
