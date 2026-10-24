import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma/client.js';
import { immobilizerService } from '../services/immobilizer.service.js';

describe('Safe Vehicle Immobilizer Service', () => {
  let testVehicle: any;
  let testDevice: any;

  beforeAll(async () => {
    testVehicle = await prisma.vehicle.create({
      data: {
        plateNumber: `TEST-IMMOB-${Date.now()}`,
        make: 'Volvo',
        model: 'XC90',
        year: 2024,
        speedLimit: 80.0,
        immobilizerState: 'NORMAL'
      }
    });

    testDevice = await prisma.device.create({
      data: {
        deviceId: `DEV-IMMOB-${Date.now()}`,
        authSecretHash: 'test_secret',
        vehicleId: testVehicle.id,
        isOnline: true
      }
    });
  });

  afterAll(async () => {
    await prisma.immobilizerAck.deleteMany({ where: { deviceId: testDevice.id } });
    await prisma.immobilizerCommand.deleteMany({ where: { vehicleId: testVehicle.id } });
    await prisma.device.delete({ where: { id: testDevice.id } });
    await prisma.vehicle.delete({ where: { id: testVehicle.id } });
    await prisma.$disconnect();
  });

  it('submits an immobilization command into queue with initial status REQUESTED', async () => {
    const result = await immobilizerService.submitCommand({
      vehicleId: testVehicle.id,
      commandType: 'IMMOBILIZE',
      reason: 'Automated test immobilization verification',
      isSimulated: true
    });

    expect(result.command).toBeDefined();
    expect(result.command.status).toBe('REQUESTED');
    expect(result.command.commandType).toBe('IMMOBILIZE');

    // Check that vehicle status moved to PENDING_IMMOBILIZATION
    const vehicleInDb = await prisma.vehicle.findUnique({
      where: { id: testVehicle.id }
    });
    expect(vehicleInDb?.immobilizerState).toBe('PENDING_IMMOBILIZATION');
  });

  it('delivers pending command to device and advances status to DELIVERED', async () => {
    const pendingCmd = await immobilizerService.getPendingCommandForDevice(testDevice.id);
    expect(pendingCmd).toBeDefined();
    expect(pendingCmd?.commandType).toBe('IMMOBILIZE');

    const cmdInDb = await prisma.immobilizerCommand.findUnique({
      where: { id: pendingCmd!.id }
    });
    expect(cmdInDb?.status).toBe('DELIVERED');
  });

  it('records device acknowledgment and marks status COMPLETED when safely executed', async () => {
    const activeCmd = await prisma.immobilizerCommand.findFirst({
      where: { vehicleId: testVehicle.id, status: 'DELIVERED' }
    });
    expect(activeCmd).toBeDefined();

    const ackResult = await immobilizerService.acknowledgeCommand({
      commandId: activeCmd!.id,
      deviceId: testDevice.id,
      relayState: 'ACTIVE',
      vehicleSpeedAtAckKmH: 0.0, // Safely stopped
      isExecutionComplete: true
    });

    expect(ackResult.status).toBe('COMPLETED');

    // Verify vehicle physical state is now IMMOBILIZED
    const vehicleInDb = await prisma.vehicle.findUnique({
      where: { id: testVehicle.id }
    });
    expect(vehicleInDb?.immobilizerState).toBe('IMMOBILIZED');
  });
});
