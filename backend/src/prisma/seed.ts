import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting FleetGuard database seeding...');

  // 1. Create Default Users
  const passwordHash = await bcrypt.hash('FleetGuard2026!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fleetguard.io' },
    update: {},
    create: {
      email: 'admin@fleetguard.io',
      name: 'System Admin',
      passwordHash,
      role: 'ADMIN'
    }
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@fleetguard.io' },
    update: {},
    create: {
      email: 'operator@fleetguard.io',
      name: 'Fleet Dispatcher',
      passwordHash,
      role: 'OPERATOR'
    }
  });

  console.log('✅ Users created: admin@fleetguard.io, operator@fleetguard.io (Password: FleetGuard2026!)');

  // 2. Create Vehicles (Clearly identified as SAMPLE data)
  const vehicle1 = await prisma.vehicle.upsert({
    where: { plateNumber: 'SAMPLE-FG-01' },
    update: {},
    create: {
      plateNumber: 'SAMPLE-FG-01',
      vin: '1HGCR2F83HA000001',
      make: 'Toyota',
      model: 'RAV4 Hybrid',
      year: 2024,
      status: 'ACTIVE',
      speedLimit: 80.0,
      immobilizerState: 'NORMAL'
    }
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: { plateNumber: 'SAMPLE-FG-02' },
    update: {},
    create: {
      plateNumber: 'SAMPLE-FG-02',
      vin: '5YJ3E1EB8NF000002',
      make: 'Tesla',
      model: 'Model Y AWD',
      year: 2023,
      status: 'IN_RENTAL',
      speedLimit: 90.0,
      immobilizerState: 'NORMAL'
    }
  });

  const vehicle3 = await prisma.vehicle.upsert({
    where: { plateNumber: 'SAMPLE-FG-03' },
    update: {},
    create: {
      plateNumber: 'SAMPLE-FG-03',
      vin: '1FTFW1ED6PF000003',
      make: 'Ford',
      model: 'F-150 Lightning',
      year: 2025,
      status: 'ACTIVE',
      speedLimit: 75.0,
      immobilizerState: 'NORMAL'
    }
  });

  console.log('✅ Sample vehicles created: SAMPLE-FG-01, SAMPLE-FG-02, SAMPLE-FG-03');

  // 3. Create IoT Devices
  const device1 = await prisma.device.upsert({
    where: { deviceId: 'FG-ESP32-001' },
    update: { vehicleId: vehicle1.id },
    create: {
      deviceId: 'FG-ESP32-001',
      model: 'ESP32-SIM800L',
      firmwareVersion: '1.0.0',
      authSecretHash: 'fleetguard_device_shared_secret_token_2026',
      vehicleId: vehicle1.id,
      isOnline: true,
      lastHeartbeatAt: new Date(),
      lastGpsFixAt: new Date(),
      cellularSignalRssi: -68,
      networkOperator: 'T-Mobile / Airtel GPRS'
    }
  });

  const device2 = await prisma.device.upsert({
    where: { deviceId: 'FG-ESP32-002' },
    update: { vehicleId: vehicle2.id },
    create: {
      deviceId: 'FG-ESP32-002',
      model: 'ESP32-SIM800L',
      firmwareVersion: '1.0.0',
      authSecretHash: 'fleetguard_device_shared_secret_token_2026',
      vehicleId: vehicle2.id,
      isOnline: true,
      lastHeartbeatAt: new Date(),
      lastGpsFixAt: new Date(),
      cellularSignalRssi: -72,
      networkOperator: 'AT&T / Vodafone GPRS'
    }
  });

  console.log('✅ Sample devices created: FG-ESP32-001, FG-ESP32-002');

  // 4. Create Initial Sample Telemetry Fixes (Marked isSimulated: true)
  // San Francisco / Silicon Valley coordinates
  const now = new Date();
  await prisma.telemetry.create({
    data: {
      deviceId: device1.id,
      vehicleId: vehicle1.id,
      timestamp: now,
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 16.5,
      speedKmH: 0.0,
      headingDegrees: 45.0,
      hdop: 1.1,
      satelliteCount: 9,
      isGpsValid: true,
      isSimulated: true,
      rawPacket: 'SAMPLE_INIT_DATA_POINT'
    }
  });

  await prisma.telemetry.create({
    data: {
      deviceId: device2.id,
      vehicleId: vehicle2.id,
      timestamp: now,
      latitude: 37.7891,
      longitude: -122.4014,
      altitude: 22.0,
      speedKmH: 34.5,
      headingDegrees: 180.0,
      hdop: 0.9,
      satelliteCount: 11,
      isGpsValid: true,
      isSimulated: true,
      rawPacket: 'SAMPLE_INIT_DATA_POINT'
    }
  });

  // 5. Create Sample Active Rental Order on SAMPLE-FG-02
  const expectedReturn = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours later
  const rental = await prisma.rentalOrder.upsert({
    where: { orderNumber: 'RNT-2026-0001' },
    update: {},
    create: {
      orderNumber: 'RNT-2026-0001',
      vehicleId: vehicle2.id,
      customerName: 'Alexander Wright',
      customerEmail: 'alex.wright@example.com',
      customerPhone: '+1 (555) 234-5678',
      customerIdNumber: 'DL-CA-9281729',
      startDateTime: new Date(),
      expectedReturnDateTime: expectedReturn,
      startLocation: 'FleetGuard Central Hub, San Francisco',
      destinationAddress: 'Silicon Valley Innovation Hub, Palo Alto',
      destinationLatitude: 37.4419,
      destinationLongitude: -122.143,
      allowedDistanceKm: 180.0,
      geofenceRadiusKm: 25.0,
      speedLimitKmH: 90.0,
      status: 'ACTIVE',
      totalDistanceTravelledKm: 18.4,
      notes: 'SAMPLE ORDER: Renter requested clean detailing. Corporate rate applied.'
    }
  });

  await prisma.rentalEvent.create({
    data: {
      rentalOrderId: rental.id,
      eventType: 'CREATED',
      message: 'Rental order initialized and vehicle checked out.'
    }
  });

  console.log('✅ Sample rental created: RNT-2026-0001 (Customer: Alexander Wright)');
  console.log('🎉 Database seeding complete with verified sample dataset.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
