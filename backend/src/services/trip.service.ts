import { prisma } from '../prisma/client.js';
import { haversineDistanceKm } from '../utils/geo.js';
import { wsServer } from '../websocket/wsServer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TripService');

export class TripService {
  /**
   * Starts a new trip for a vehicle.
   */
  async startTrip(params: {
    vehicleId: string;
    deviceId?: string;
    rentalOrderId?: string;
    startLat?: number;
    startLng?: number;
  }) {
    const { vehicleId, deviceId, rentalOrderId, startLat, startLng } = params;

    // Check if there is already an active trip
    const existingActiveTrip = await prisma.trip.findFirst({
      where: { vehicleId, status: 'ACTIVE' }
    });

    if (existingActiveTrip) {
      return existingActiveTrip;
    }

    const trip = await prisma.trip.create({
      data: {
        vehicleId,
        deviceId,
        rentalOrderId,
        status: 'ACTIVE',
        startTime: new Date(),
        startLatitude: startLat,
        startLongitude: startLng,
        totalDistanceKm: 0.0,
        maxSpeedKmH: 0.0,
        averageSpeedKmH: 0.0,
        pointCount: 0
      }
    });

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { currentTripId: trip.id }
    });

    wsServer.broadcast('TRIP_EVENT', {
      type: 'TRIP_STARTED',
      trip
    });

    logger.info(`Trip started for vehicle ${vehicleId} (Trip ID: ${trip.id})`);
    return trip;
  }

  /**
   * Appends a valid GPS point to an active trip and increments accumulated distance.
   */
  async recordTripPoint(params: {
    tripId: string;
    latitude: number;
    longitude: number;
    speedKmH: number;
    headingDegrees?: number;
    distanceDeltaKm: number;
    timestamp: Date;
  }) {
    const { tripId, latitude, longitude, speedKmH, headingDegrees, distanceDeltaKm, timestamp } = params;

    const tripPoint = await prisma.tripPoint.create({
      data: {
        tripId,
        latitude,
        longitude,
        speedKmH,
        headingDegrees,
        distanceDeltaKm,
        timestamp
      }
    });

    // Update trip summary
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { totalDistanceKm: true, maxSpeedKmH: true, averageSpeedKmH: true, pointCount: true }
    });

    if (trip) {
      const newTotalDistance = (trip.totalDistanceKm || 0) + distanceDeltaKm;
      const newMaxSpeed = Math.max(trip.maxSpeedKmH || 0, speedKmH);
      const newPointCount = (trip.pointCount || 0) + 1;
      const newAvgSpeed = ((trip.averageSpeedKmH || 0) * (newPointCount - 1) + speedKmH) / newPointCount;

      await prisma.trip.update({
        where: { id: tripId },
        data: {
          totalDistanceKm: Math.round(newTotalDistance * 100) / 100,
          maxSpeedKmH: Math.round(newMaxSpeed * 10) / 10,
          averageSpeedKmH: Math.round(newAvgSpeed * 10) / 10,
          pointCount: newPointCount,
          endLatitude: latitude,
          endLongitude: longitude
        }
      });
    }

    return tripPoint;
  }

  /**
   * Completes an ongoing trip.
   */
  async endTrip(tripId: string, endLat?: number, endLng?: number) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId }
    });

    if (!trip || trip.status === 'COMPLETED') {
      return trip;
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        status: 'COMPLETED',
        endTime: new Date(),
        endLatitude: endLat || trip.endLatitude,
        endLongitude: endLng || trip.endLongitude
      }
    });

    await prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: { currentTripId: null }
    });

    wsServer.broadcast('TRIP_EVENT', {
      type: 'TRIP_COMPLETED',
      trip: updatedTrip
    });

    logger.info(`Trip completed: ${tripId} (Distance: ${updatedTrip.totalDistanceKm.toFixed(2)} km)`);
    return updatedTrip;
  }
}

export const tripService = new TripService();
export default tripService;
