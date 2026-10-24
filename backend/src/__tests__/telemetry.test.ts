import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma/client.js';
import { telemetryService } from '../services/telemetry.service.js';

describe('Telemetry & Device Heartbeat Engine', () => {
  let testVehicle: any;
  let testDevice: any;

  beforeAll(async () => {
    testVehicle = await prisma.vehicle.create({
      data: {
        plateNumber: `TEST-TEL-${Date.now()}`,
        make: 'Audi',
        model: 'Q7',
        year: 2024,
        speedLimit: 70.0,
        immobilizerState: 'NORMAL'
      }
    });

    testDevice = await prisma.device.create({
      data: {
        deviceId: `DEV-TEL-${Date.now()}`,
        authSecretHash: 'test_token',
        vehicleId: testVehicle.id,
        isOnline: false
      }
    });
  });

  afterAll(async () => {
    await prisma.speedAlert.deleteMany({ where: { vehicleId: testVehicle.id } });
    await prisma.tripPoint.deleteMany({ where: { trip: { vehicleId: testVehicle.id } } });
    await prisma.trip.deleteMany({ where: { vehicleId: testVehicle.id } });
    await prisma.telemetry.deleteMany({ where: { deviceId: testDevice.id } });
    await prisma.device.delete({ where: { id: testDevice.id } });
    await prisma.vehicle.delete({ where: { id: testVehicle.id } });
    await prisma.$disconnect();
  });

  it('ingests valid GPS telemetry and transitions device to online state', async () => {
    const res = await telemetryService.processTelemetry({
      deviceId: testDevice.deviceId,
      latitude: 37.7749,
      longitude: -122.4194,
      speedKmH: 45.0,
      headingDegrees: 90.0,
      hdop: 1.2,
      satelliteCount: 8,
      cellularSignalRssi: -75,
      isSimulated: true
    });

    expect(res.success).toBe(true);
    expect(res.isGpsValid).toBe(true);

    const updatedDevice = await prisma.device.findUnique({
      where: { id: testDevice.id }
    });
    expect(updatedDevice?.isOnline).toBe(true);
    expect(updatedDevice?.lastHeartbeatAt).toBeDefined();
    expect(updatedDevice?.lastGpsFixAt).toBeDefined();
  });

  it('detects overspeed condition and logs speed alert event', async () => {
    const t1 = new Date();
    await telemetryService.processTelemetry({
      deviceId: testDevice.deviceId,
      timestamp: t1,
      latitude: 37.7760,
      longitude: -122.4190,
      speedKmH: 40.0,
      headingDegrees: 90.0,
      isSimulated: true
    });

    // 5 seconds later at 95 km/h
    const t2 = new Date(t1.getTime() + 5000);
    await telemetryService.processTelemetry({
      deviceId: testDevice.deviceId,
      timestamp: t2,
      latitude: 37.7765,
      longitude: -122.4190,
      speedKmH: 95.0,
      headingDegrees: 90.0,
      isSimulated: true
    });

    const alert = await prisma.speedAlert.findFirst({
      where: { vehicleId: testVehicle.id },
      orderBy: { timestamp: 'desc' }
    });

    expect(alert).toBeDefined();
    expect(alert?.speedRecordedKmH).toBe(95.0);
    expect(alert?.speedLimitKmH).toBe(70.0);
  });

  it('handles invalid coordinate fixes without marking them as valid fix', async () => {
    const res = await telemetryService.processTelemetry({
      deviceId: testDevice.deviceId,
      latitude: 0.0, // Null Island
      longitude: 0.0,
      speedKmH: 0.0,
      isGpsValid: false
    });

    expect(res.success).toBe(true);
    expect(res.isGpsValid).toBe(false);
  });
});
