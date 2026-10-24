import { prisma } from '../prisma/client.js';
import { config } from '../config/index.js';
import { isValidCoordinate, validateGpsMovement, haversineDistanceKm } from '../utils/geo.js';
import { wsServer } from '../websocket/wsServer.js';
import { speedAlertService } from './speedAlert.service.js';
import { rentalService } from './rental.service.js';
import { tripService } from './trip.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TelemetryService');

export interface TelemetryPacket {
  deviceId: string;
  timestamp?: string | number | Date;
  latitude: number;
  longitude: number;
  altitude?: number;
  speedKmH: number;
  headingDegrees?: number;
  hdop?: number;
  satelliteCount?: number;
  isGpsValid?: boolean;
  batteryVoltage?: number;
  cellularSignalRssi?: number;
  isSimulated?: boolean;
  rawPacket?: string;
}

export class TelemetryService {
  /**
   * Processes a single incoming telemetry point from a device.
   */
  async processTelemetry(packet: TelemetryPacket) {
    const { deviceId, latitude, longitude, speedKmH } = packet;

    // 1. Find device
    const device = await prisma.device.findUnique({
      where: { deviceId },
      include: {
        vehicle: true
      }
    });

    if (!device) {
      throw new Error(`Device with ID '${deviceId}' is not registered in FleetGuard.`);
    }

    const timestamp = packet.timestamp ? new Date(packet.timestamp) : new Date();

    // 2. Validate GPS coordinates
    const hasValidCoords = isValidCoordinate(latitude, longitude) && packet.isGpsValid !== false;

    // 3. Retrieve last valid telemetry point for jump detection and distance calculation
    const lastPoint = await prisma.telemetry.findFirst({
      where: {
        deviceId: device.id,
        isGpsValid: true
      },
      orderBy: { timestamp: 'desc' }
    });

    let distanceDeltaKm = 0;
    let isPhysicallyPlausible = true;
    let jumpReason: string | undefined;

    if (hasValidCoords && lastPoint) {
      const validation = validateGpsMovement(
        lastPoint.latitude,
        lastPoint.longitude,
        lastPoint.timestamp,
        latitude,
        longitude,
        timestamp,
        config.telemetry.maxValidSpeedKmH,
        config.telemetry.maxDistanceJumpKm
      );

      if (!validation.isValid) {
        isPhysicallyPlausible = false;
        jumpReason = validation.reason;
        logger.warn(`GPS Jump filtered out for device ${deviceId}: ${validation.reason}`);
      } else {
        // Stationary drift filter: if vehicle speed is less than 2.5 km/h, ignore tiny displacement
        if (speedKmH < config.telemetry.minSpeedThresholdForMovingKmH) {
          distanceDeltaKm = 0;
        } else {
          distanceDeltaKm = validation.distanceKm;
        }
      }
    }

    // 4. Record Telemetry to database
    const telemetryRecord = await prisma.telemetry.create({
      data: {
        deviceId: device.id,
        vehicleId: device.vehicleId,
        timestamp,
        latitude,
        longitude,
        altitude: packet.altitude || null,
        speedKmH: Math.max(0, speedKmH),
        headingDegrees: packet.headingDegrees || null,
        hdop: packet.hdop || null,
        satelliteCount: packet.satelliteCount || null,
        isGpsValid: hasValidCoords && isPhysicallyPlausible,
        isSimulated: Boolean(packet.isSimulated),
        rawPacket: packet.rawPacket || (jumpReason ? `JUMP_FILTERED: ${jumpReason}` : null)
      }
    });

    // 5. Update Device connection status & last GPS fix
    await prisma.device.update({
      where: { id: device.id },
      data: {
        isOnline: true,
        lastHeartbeatAt: timestamp,
        lastGpsFixAt: hasValidCoords && isPhysicallyPlausible ? timestamp : device.lastGpsFixAt,
        cellularSignalRssi: packet.cellularSignalRssi !== undefined ? packet.cellularSignalRssi : device.cellularSignalRssi
      }
    });

    // 6. If vehicle is assigned and coordinates are valid, update trips & rental tracking
    if (device.vehicle && hasValidCoords && isPhysicallyPlausible) {
      const vehicle = device.vehicle;

      // Check active rental
      const activeRental = await rentalService.getActiveRentalForVehicle(vehicle.id);

      // Check active trip or auto-start trip if vehicle starts moving (> 5 km/h)
      let currentTripId = vehicle.currentTripId;
      if (!currentTripId && speedKmH >= 5.0) {
        const newTrip = await tripService.startTrip({
          vehicleId: vehicle.id,
          deviceId: device.id,
          rentalOrderId: activeRental?.id,
          startLat: latitude,
          startLng: longitude
        });
        currentTripId = newTrip.id;
      }

      if (currentTripId) {
        await tripService.recordTripPoint({
          tripId: currentTripId,
          latitude,
          longitude,
          speedKmH,
          headingDegrees: packet.headingDegrees,
          distanceDeltaKm,
          timestamp
        });
      }

      // Process rental updates
      if (activeRental && distanceDeltaKm > 0) {
        await rentalService.processTelemetryForRental(
          activeRental,
          latitude,
          longitude,
          distanceDeltaKm,
          vehicle.plateNumber
        );
      }

      // Evaluate speed alert
      await speedAlertService.evaluateSpeed({
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        speedKmH,
        latitude,
        longitude,
        timestamp,
        rentalOrderId: activeRental?.id,
        customSpeedLimit: activeRental?.speedLimitKmH || vehicle.speedLimit
      });
    }

    // 7. Broadcast live update via WebSocket to connected dashboards
    const wsPayload = {
      deviceId,
      vehicleId: device.vehicleId,
      plateNumber: device.vehicle?.plateNumber || null,
      latitude,
      longitude,
      speedKmH,
      headingDegrees: packet.headingDegrees || 0,
      timestamp: timestamp.toISOString(),
      isGpsValid: hasValidCoords && isPhysicallyPlausible,
      isSimulated: Boolean(packet.isSimulated),
      signalRssi: packet.cellularSignalRssi || null,
      immobilizerState: device.vehicle?.immobilizerState || 'NORMAL'
    };

    wsServer.broadcast('TELEMETRY_UPDATE', wsPayload);

    return {
      success: true,
      telemetryId: telemetryRecord.id,
      isGpsValid: hasValidCoords && isPhysicallyPlausible,
      jumpReason
    };
  }

  /**
   * Ingests a batch of offline-buffered telemetry points sent upon cellular reconnection.
   */
  async processBatch(batch: TelemetryPacket[]) {
    const results = [];
    for (const packet of batch) {
      try {
        const res = await this.processTelemetry(packet);
        results.push(res);
      } catch (err: any) {
        results.push({ success: false, error: err.message, deviceId: packet.deviceId });
      }
    }
    return results;
  }

  /**
   * Heartbeat ping from device.
   */
  async processHeartbeat(params: {
    deviceId: string;
    batteryVoltage?: number;
    gsmSignal?: number;
    networkStatus?: string;
    isGpsLocked?: boolean;
    memoryFreeBytes?: number;
  }) {
    const { deviceId, batteryVoltage, gsmSignal, networkStatus, isGpsLocked, memoryFreeBytes } = params;

    const device = await prisma.device.findUnique({
      where: { deviceId }
    });

    if (!device) {
      throw new Error(`Device '${deviceId}' not found.`);
    }

    const now = new Date();

    await prisma.deviceHeartbeat.create({
      data: {
        deviceId: device.id,
        batteryVoltage: batteryVoltage || null,
        gsmSignal: gsmSignal || null,
        networkStatus: networkStatus || null,
        isGpsLocked: Boolean(isGpsLocked),
        memoryFreeBytes: memoryFreeBytes || null,
        timestamp: now
      }
    });

    await prisma.device.update({
      where: { id: device.id },
      data: {
        isOnline: true,
        lastHeartbeatAt: now,
        cellularSignalRssi: gsmSignal !== undefined ? gsmSignal : device.cellularSignalRssi
      }
    });

    wsServer.broadcast('DEVICE_HEARTBEAT', {
      deviceId,
      isOnline: true,
      lastHeartbeatAt: now.toISOString(),
      gsmSignal,
      isGpsLocked
    });

    return { success: true, timestamp: now };
  }
}

export const telemetryService = new TelemetryService();
export default telemetryService;
