import { prisma } from '../prisma/client.js';
import { config } from '../config/index.js';
import { wsServer } from '../websocket/wsServer.js';
import { notificationService } from './notification.service.js';
import { auditService } from './audit.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ImmobilizerService');

export class ImmobilizerService {
  /**
   * Submits an immobilization or restoration command into the secure queue.
   * Enforces vehicle speed safety checks and logs audit trail.
   */
  async submitCommand(params: {
    vehicleId: string;
    commandType: 'IMMOBILIZE' | 'RESTORE';
    reason: string;
    userId?: string;
    ipAddress?: string;
    isSimulated?: boolean;
  }) {
    const { vehicleId, commandType, reason, userId, ipAddress, isSimulated } = params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        devices: true
      }
    });

    if (!vehicle) {
      throw new Error(`Vehicle with ID ${vehicleId} not found.`);
    }

    const assignedDevice = vehicle.devices[0] || null;

    // Check latest speed if available
    const latestTelemetry = await prisma.telemetry.findFirst({
      where: { vehicleId, isGpsValid: true },
      orderBy: { timestamp: 'desc' }
    });

    // CRITICAL SAFETY CHECK: If vehicle is moving > 5 km/h, issue safe caution
    const currentSpeed = latestTelemetry ? latestTelemetry.speedKmH : 0;
    const isMovingUnsafe = currentSpeed > config.telemetry.safeImmobilizeSpeedMaxKmH;

    // Create command in database with status REQUESTED
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

    const command = await prisma.immobilizerCommand.create({
      data: {
        vehicleId,
        deviceId: assignedDevice?.id || null,
        commandType,
        status: 'REQUESTED',
        reason: `${reason}${isMovingUnsafe ? ' [CAUTION: Speed exceeds 5km/h; safety hold active]' : ''}`,
        requestedByUserId: userId || null,
        expiresAt,
        isSimulated: Boolean(isSimulated),
      },
      include: {
        vehicle: {
          select: { plateNumber: true, make: true, model: true }
        }
      }
    });

    // Update vehicle immobilizer status to pending
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        immobilizerState: commandType === 'IMMOBILIZE' ? 'PENDING_IMMOBILIZATION' : 'NORMAL'
      }
    });

    // Audit log
    await auditService.log({
      userId,
      action: `IMMOBILIZER_${commandType}_REQUESTED`,
      resourceType: 'VEHICLE',
      resourceId: vehicleId,
      details: {
        commandId: command.id,
        plateNumber: vehicle.plateNumber,
        speedAtRequest: currentSpeed,
        isMovingUnsafe,
        isSimulated,
        reason
      },
      ipAddress
    });

    // Broadcast WebSocket
    wsServer.broadcast('IMMOBILIZER_STATUS', {
      vehicleId,
      commandId: command.id,
      commandType,
      status: 'REQUESTED',
      currentSpeed,
      isMovingUnsafe
    });

    // Notification
    await notificationService.notify({
      title: `Immobilizer Command Requested: ${vehicle.plateNumber}`,
      message: `Safety command '${commandType}' requested for ${vehicle.plateNumber}. Status: REQUESTED. (Reason: ${reason}). Speed: ${currentSpeed.toFixed(1)} km/h.`,
      category: 'IMMOBILIZER',
      severity: isMovingUnsafe ? 'WARNING' : 'INFO',
      telegramText: `🔒 <b>IMMOBILIZER COMMAND QUEUED</b>\n\n🚘 <b>Vehicle:</b> ${vehicle.plateNumber}\n⚙️ <b>Action:</b> ${commandType}\n⚠️ <b>Safety Speed Check:</b> ${currentSpeed.toFixed(1)} km/h\n📝 <b>Reason:</b> ${reason}\n🆔 <b>Command ID:</b> <code>${command.id}</code>`
    });

    return {
      command,
      isMovingUnsafe,
      currentSpeed,
      warning: isMovingUnsafe
        ? `Safety Protection Active: Vehicle is traveling at ${currentSpeed.toFixed(1)} km/h. Per automotive safety standards, immobilization will only engage when the vehicle has safely stopped.`
        : null
    };
  }

  /**
   * Device polls for pending commands when connected.
   */
  async getPendingCommandForDevice(deviceId: string) {
    const command = await prisma.immobilizerCommand.findFirst({
      where: {
        deviceId,
        status: { in: ['REQUESTED', 'DELIVERED'] },
        expiresAt: { gt: new Date() }
      },
      orderBy: { requestedAt: 'asc' }
    });

    if (command && command.status === 'REQUESTED') {
      await prisma.immobilizerCommand.update({
        where: { id: command.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date()
        }
      });

      wsServer.broadcast('IMMOBILIZER_STATUS', {
        vehicleId: command.vehicleId,
        commandId: command.id,
        status: 'DELIVERED'
      });
    }

    return command;
  }

  /**
   * Called when physical device or hardware simulator acknowledges the command.
   */
  async acknowledgeCommand(params: {
    commandId: string;
    deviceId: string;
    relayState: 'ACTIVE' | 'INACTIVE';
    vehicleSpeedAtAckKmH?: number;
    isExecutionComplete: boolean;
    failureReason?: string;
    rawPayload?: string;
  }) {
    const { commandId, deviceId, relayState, vehicleSpeedAtAckKmH, isExecutionComplete, failureReason, rawPayload } = params;

    const command = await prisma.immobilizerCommand.findUnique({
      where: { id: commandId },
      include: { vehicle: true }
    });

    if (!command) {
      throw new Error(`Command ${commandId} not found`);
    }

    // Record ACK log
    await prisma.immobilizerAck.create({
      data: {
        commandId,
        deviceId,
        relayState,
        vehicleSpeedAtAckKmH,
        rawPayload
      }
    });

    const newStatus = failureReason
      ? 'FAILED'
      : isExecutionComplete
      ? 'COMPLETED'
      : 'ACKNOWLEDGED';

    const updatedCommand = await prisma.immobilizerCommand.update({
      where: { id: commandId },
      data: {
        status: newStatus,
        acknowledgedAt: new Date(),
        completedAt: newStatus === 'COMPLETED' ? new Date() : undefined,
        failureReason: failureReason || undefined
      }
    });

    // Update vehicle physical immobilizer state
    if (newStatus === 'COMPLETED') {
      await prisma.vehicle.update({
        where: { id: command.vehicleId },
        data: {
          immobilizerState: command.commandType === 'IMMOBILIZE' ? 'IMMOBILIZED' : 'NORMAL'
        }
      });
    }

    // Broadcast WebSocket
    wsServer.broadcast('IMMOBILIZER_STATUS', {
      vehicleId: command.vehicleId,
      commandId: command.id,
      commandType: command.commandType,
      status: newStatus,
      relayState,
      vehicleSpeed: vehicleSpeedAtAckKmH
    });

    // Notification
    await notificationService.notify({
      title: `Immobilizer Command ${newStatus}: ${command.vehicle.plateNumber}`,
      message: `Command '${command.commandType}' for ${command.vehicle.plateNumber} is now ${newStatus}. Relay: ${relayState}. Speed: ${vehicleSpeedAtAckKmH || 0} km/h.`,
      category: 'IMMOBILIZER',
      severity: newStatus === 'COMPLETED' ? 'WARNING' : newStatus === 'FAILED' ? 'CRITICAL' : 'INFO',
      telegramText: `🛡️ <b>IMMOBILIZER ${newStatus}</b>\n\n🚘 <b>Vehicle:</b> ${command.vehicle.plateNumber}\n⚙️ <b>Command:</b> ${command.commandType}\n🔌 <b>Relay State:</b> ${relayState}\n⚡ <b>Speed at ACK:</b> ${vehicleSpeedAtAckKmH || 0} km/h\n${failureReason ? `❌ <b>Reason:</b> ${failureReason}` : '✅ <b>Safety Verification Confirmed</b>'}`
    });

    return updatedCommand;
  }
}

export const immobilizerService = new ImmobilizerService();
export default immobilizerService;
