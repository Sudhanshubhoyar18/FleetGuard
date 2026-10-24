import { config } from '../config/index.js';
import { prisma } from '../prisma/client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TelegramService');

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
  isMock: boolean;
}

export class TelegramService {
  private lastAlertTimes: Map<string, number> = new Map();

  /**
   * Sends a structured message via Telegram Bot API with cooldown to prevent spam.
   */
  async sendMessage(
    text: string,
    category: string = 'GENERAL',
    notificationId?: string
  ): Promise<TelegramSendResult> {
    const botToken = config.telegram.botToken.trim();
    const chatId = config.telegram.chatId.trim();

    if (!botToken || !chatId) {
      logger.warn(
        `Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured in backend .env. (Category: ${category})`
      );

      if (notificationId) {
        await this.logDelivery(
          notificationId,
          'TELEGRAM',
          chatId || 'NOT_CONFIGURED',
          'FAILED',
          'Credentials missing: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is blank'
        );
      }

      return {
        success: false,
        isMock: true,
        error: 'Telegram Bot credentials not configured in backend environment.'
      };
    }

    // Cooldown check for category spam prevention (e.g. 60 seconds per specific category)
    const now = Date.now();
    const lastSent = this.lastAlertTimes.get(category) || 0;
    if (category !== 'TEST' && now - lastSent < 30000) {
      logger.info(`Telegram notification throttled under cooldown for category ${category}`);
      return {
        success: false,
        isMock: false,
        error: 'Notification suppressed due to category cooldown rate limit'
      };
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });

      const responseData = (await response.json()) as any;

      if (!response.ok || !responseData.ok) {
        const errorMsg = responseData.description || `HTTP ${response.status} from Telegram`;
        logger.error(`Telegram delivery failed: ${errorMsg}`);

        if (notificationId) {
          await this.logDelivery(
            notificationId,
            'TELEGRAM',
            chatId,
            'FAILED',
            errorMsg
          );
        }

        return {
          success: false,
          isMock: false,
          error: errorMsg
        };
      }

      this.lastAlertTimes.set(category, now);
      logger.info(`Telegram notification delivered successfully (Message ID: ${responseData.result?.message_id})`);

      if (notificationId) {
        await this.logDelivery(
          notificationId,
          'TELEGRAM',
          chatId,
          'DELIVERED',
          JSON.stringify({ messageId: responseData.result?.message_id })
        );
      }

      return {
        success: true,
        isMock: false,
        messageId: responseData.result?.message_id
      };
    } catch (err: any) {
      logger.error(`Telegram network/fetch error: ${err.message}`);
      if (notificationId) {
        await this.logDelivery(
          notificationId,
          'TELEGRAM',
          chatId,
          'FAILED',
          err.message
        );
      }
      return {
        success: false,
        isMock: false,
        error: err.message
      };
    }
  }

  async sendTestNotification(targetChatId?: string): Promise<TelegramSendResult> {
    const chatId = targetChatId || config.telegram.chatId;
    const botToken = config.telegram.botToken;

    if (!botToken || !chatId) {
      return {
        success: false,
        isMock: true,
        error: 'Telegram Bot credentials not configured in backend environment.'
      };
    }

    const testMessage = `🛡️ <b>FleetGuard System Notification</b>\n\n✅ <b>Test Alert Connection:</b> OK\n🕒 <b>Timestamp:</b> ${new Date().toISOString()}\n📡 <b>Status:</b> Telegram Bot API is operational.`;

    return this.sendMessage(testMessage, 'TEST');
  }

  private async logDelivery(
    notificationId: string,
    channel: string,
    recipient: string,
    status: string,
    details?: string
  ) {
    try {
      await prisma.notificationDeliveryLog.create({
        data: {
          notificationId,
          channel,
          recipient,
          status,
          responseDetails: details,
          attempts: 1
        }
      });
    } catch (e) {
      logger.error('Failed to write notification delivery log to database', e);
    }
  }
}

export const telegramService = new TelegramService();
export default telegramService;
