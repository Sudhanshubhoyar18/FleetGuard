import { prisma } from '../prisma/client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AuditService');

export class AuditService {
  async log(params: {
    userId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
  }) {
    try {
      return await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          detailsJson: params.details ? JSON.stringify(params.details) : null,
          ipAddress: params.ipAddress,
        }
      });
    } catch (e: any) {
      logger.error(`Failed to record audit log: ${e.message}`);
      return null;
    }
  }

  async getRecent(limit: number = 50) {
    return prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });
  }
}

export const auditService = new AuditService();
export default auditService;
