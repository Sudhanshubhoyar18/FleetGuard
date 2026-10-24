import { Router } from 'express';
import { prisma } from '../prisma/client.js';

export const historyRouter = Router();

export interface UnifiedHistoryEvent {
  id: string;
  vehicleId?: string | null;
  plateNumber?: string | null;
  deviceId?: string | null;
  eventType: string; // 'GPS_UPDATE' | 'SPEED_ALERT' | 'TRIP_START' | 'TRIP_END' | 'RENTAL_EVENT' | 'IMMOBILIZER' | 'HEARTBEAT'
  timestamp: string;
  title: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
  speedKmH?: number | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

historyRouter.get('/', async (req, res) => {
  try {
    const {
      vehicleId,
      eventType,
      search,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);

    const events: UnifiedHistoryEvent[] = [];

    // 1. Speed alerts
    if (!eventType || eventType === 'SPEED_ALERT') {
      const speedAlerts = await prisma.speedAlert.findMany({
        where: {
          ...(vehicleId ? { vehicleId: vehicleId as string } : {}),
          ...(startDate || endDate ? { timestamp: dateFilter } : {})
        },
        include: { vehicle: true },
        orderBy: { timestamp: 'desc' },
        take: 100
      });

      for (const a of speedAlerts) {
        events.push({
          id: a.id,
          vehicleId: a.vehicleId,
          plateNumber: a.vehicle?.plateNumber,
          deviceId: null,
          eventType: 'SPEED_ALERT',
          timestamp: a.timestamp.toISOString(),
          title: `Speed Violation (${a.speedRecordedKmH} km/h)`,
          description: `Vehicle exceeded speed threshold of ${a.speedLimitKmH} km/h`,
          latitude: a.latitude,
          longitude: a.longitude,
          speedKmH: a.speedRecordedKmH,
          severity: 'WARNING'
        });
      }
    }

    // 2. Rental Events
    if (!eventType || eventType === 'RENTAL_EVENT') {
      const rentalEvents = await prisma.rentalEvent.findMany({
        where: {
          ...(startDate || endDate ? { timestamp: dateFilter } : {})
        },
        include: { rentalOrder: { include: { vehicle: true } } },
        orderBy: { timestamp: 'desc' },
        take: 100
      });

      for (const r of rentalEvents) {
        if (!vehicleId || r.rentalOrder.vehicleId === vehicleId) {
          events.push({
            id: r.id,
            vehicleId: r.rentalOrder.vehicleId,
            plateNumber: r.rentalOrder.vehicle?.plateNumber,
            deviceId: null,
            eventType: 'RENTAL_EVENT',
            timestamp: r.timestamp.toISOString(),
            title: `Rental: ${r.eventType}`,
            description: r.message,
            severity: r.eventType.includes('EXCEEDED') || r.eventType.includes('OVERDUE') ? 'CRITICAL' : 'INFO'
          });
        }
      }
    }

    // 3. Immobilizer Commands & Acks
    if (!eventType || eventType === 'IMMOBILIZER') {
      const immobilizerCommands = await prisma.immobilizerCommand.findMany({
        where: {
          ...(vehicleId ? { vehicleId: vehicleId as string } : {}),
          ...(startDate || endDate ? { requestedAt: dateFilter } : {})
        },
        include: { vehicle: true, device: true },
        orderBy: { requestedAt: 'desc' },
        take: 50
      });

      for (const cmd of immobilizerCommands) {
        events.push({
          id: cmd.id,
          vehicleId: cmd.vehicleId,
          plateNumber: cmd.vehicle?.plateNumber,
          deviceId: cmd.deviceId,
          eventType: 'IMMOBILIZER',
          timestamp: cmd.requestedAt.toISOString(),
          title: `Immobilizer ${cmd.commandType} (${cmd.status})`,
          description: `Action: ${cmd.commandType}, Status: ${cmd.status}. Reason: ${cmd.reason}`,
          severity: cmd.status === 'FAILED' ? 'CRITICAL' : 'WARNING'
        });
      }
    }

    // 4. Trips Start & Complete
    if (!eventType || eventType === 'TRIP') {
      const trips = await prisma.trip.findMany({
        where: {
          ...(vehicleId ? { vehicleId: vehicleId as string } : {}),
          ...(startDate || endDate ? { startTime: dateFilter } : {})
        },
        include: { vehicle: true },
        orderBy: { startTime: 'desc' },
        take: 50
      });

      for (const t of trips) {
        events.push({
          id: t.id,
          vehicleId: t.vehicleId,
          plateNumber: t.vehicle?.plateNumber,
          deviceId: t.deviceId,
          eventType: 'TRIP',
          timestamp: t.startTime.toISOString(),
          title: `Trip ${t.status}: ${t.totalDistanceKm.toFixed(1)} km`,
          description: `Trip duration points: ${t.pointCount}, Max speed: ${t.maxSpeedKmH} km/h`,
          latitude: t.startLatitude,
          longitude: t.startLongitude,
          speedKmH: t.maxSpeedKmH,
          severity: 'INFO'
        });
      }
    }

    // Sort unified events descending by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by text search if provided
    let filtered = events;
    if (search) {
      const q = (search as string).toLowerCase();
      filtered = events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.plateNumber && e.plateNumber.toLowerCase().includes(q))
      );
    }

    const totalCount = filtered.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(startIndex, startIndex + limitNum);

    res.json({
      data: paginated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

historyRouter.get('/export', async (req, res) => {
  try {
    const vehicleId = req.query.vehicleId as string;

    const speedAlerts = await prisma.speedAlert.findMany({
      where: vehicleId ? { vehicleId } : {},
      include: { vehicle: true },
      orderBy: { timestamp: 'desc' },
      take: 500
    });

    const rows = [
      ['Event ID', 'Event Type', 'Timestamp', 'Plate Number', 'Latitude', 'Longitude', 'Speed km/h', 'Limit km/h', 'Acknowledged'].join(',')
    ];

    for (const a of speedAlerts) {
      rows.push(
        [
          a.id,
          'SPEED_ALERT',
          a.timestamp.toISOString(),
          a.vehicle?.plateNumber || '',
          a.latitude,
          a.longitude,
          a.speedRecordedKmH,
          a.speedLimitKmH,
          a.isAcknowledged ? 'YES' : 'NO'
        ].join(',')
      );
    }

    const csvContent = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="fleetguard-history-${Date.now()}.csv"`);
    res.status(200).send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
