import { prisma } from '../prisma/client.js';
import { haversineDistanceKm } from '../utils/geo.js';
import { wsServer } from '../websocket/wsServer.js';
import { notificationService } from './notification.service.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RentalService');

export class RentalService {
  private destinationDeviationNotified: Set<string> = new Set();
  private allowanceExceededNotified: Set<string> = new Set();

  /**
   * Finds any currently active rental order for a given vehicle.
   */
  async getActiveRentalForVehicle(vehicleId: string) {
    return prisma.rentalOrder.findFirst({
      where: {
        vehicleId,
        status: 'ACTIVE'
      }
    });
  }

  /**
   * Evaluates active rental metrics against new GPS point:
   * - Increments distance travelled
   * - Checks if distance allowance exceeded
   * - Checks destination distance / geofence boundary deviation
   */
  async processTelemetryForRental(
    rentalOrder: any,
    currentLat: number,
    currentLng: number,
    distanceDeltaKm: number,
    vehiclePlateNumber: string
  ) {
    if (!rentalOrder) return;

    // 1. Accumulate distance
    const newTotalDistance = (rentalOrder.totalDistanceTravelledKm || 0) + distanceDeltaKm;
    await prisma.rentalOrder.update({
      where: { id: rentalOrder.id },
      data: { totalDistanceTravelledKm: newTotalDistance }
    });

    // 2. Check distance allowance
    if (newTotalDistance > rentalOrder.allowedDistanceKm && !this.allowanceExceededNotified.has(rentalOrder.id)) {
      this.allowanceExceededNotified.add(rentalOrder.id);
      logger.warn(`Rental order ${rentalOrder.orderNumber} exceeded distance allowance: ${newTotalDistance.toFixed(1)} km > ${rentalOrder.allowedDistanceKm} km`);

      await prisma.rentalEvent.create({
        data: {
          rentalOrderId: rentalOrder.id,
          eventType: 'DISTANCE_EXCEEDED',
          message: `Vehicle exceeded agreed distance allowance of ${rentalOrder.allowedDistanceKm} km (Current: ${newTotalDistance.toFixed(1)} km)`,
          metadataJson: JSON.stringify({ totalDistance: newTotalDistance, limit: rentalOrder.allowedDistanceKm })
        }
      });

      await notificationService.notify({
        title: `Rental Limit Exceeded: Order #${rentalOrder.orderNumber}`,
        message: `Vehicle ${vehiclePlateNumber} exceeded permitted distance allowance of ${rentalOrder.allowedDistanceKm} km (Total: ${newTotalDistance.toFixed(1)} km).`,
        category: 'RENTAL_LIMIT',
        severity: 'WARNING',
        telegramText: `⚠️ <b>RENTAL DISTANCE EXCEEDED</b>\n\n📄 <b>Order:</b> #${rentalOrder.orderNumber}\n🚘 <b>Vehicle:</b> ${vehiclePlateNumber}\n👤 <b>Customer:</b> ${rentalOrder.customerName}\n📏 <b>Travelled:</b> ${newTotalDistance.toFixed(1)} km / ${rentalOrder.allowedDistanceKm} km allowance`
      });

      wsServer.broadcast('RENTAL_EVENT', {
        rentalOrderId: rentalOrder.id,
        eventType: 'DISTANCE_EXCEEDED',
        totalDistance: newTotalDistance
      });
    }

    // 3. Check destination geofence if configured
    if (rentalOrder.destinationLatitude && rentalOrder.destinationLongitude && rentalOrder.geofenceRadiusKm) {
      const distToDestinationKm = haversineDistanceKm(
        currentLat,
        currentLng,
        rentalOrder.destinationLatitude,
        rentalOrder.destinationLongitude
      );

      // If outside destination radius and not yet notified
      if (distToDestinationKm > rentalOrder.geofenceRadiusKm && !this.destinationDeviationNotified.has(rentalOrder.id)) {
        this.destinationDeviationNotified.add(rentalOrder.id);
        logger.info(`Rental order ${rentalOrder.orderNumber} deviation alert: ${distToDestinationKm.toFixed(1)} km from destination (Radius: ${rentalOrder.geofenceRadiusKm} km)`);

        await prisma.rentalEvent.create({
          data: {
            rentalOrderId: rentalOrder.id,
            eventType: 'GEOFENCE_DEVIATION',
            message: `Vehicle is ${distToDestinationKm.toFixed(1)} km away from designated destination '${rentalOrder.destinationAddress}' (Permitted radius: ${rentalOrder.geofenceRadiusKm} km)`,
            metadataJson: JSON.stringify({ distanceKm: distToDestinationKm, radiusKm: rentalOrder.geofenceRadiusKm })
          }
        });

        await notificationService.notify({
          title: `Geofence Deviation: Order #${rentalOrder.orderNumber}`,
          message: `Vehicle ${vehiclePlateNumber} is currently ${distToDestinationKm.toFixed(1)} km from the destination area (${rentalOrder.destinationAddress}).`,
          category: 'GEOFENCE',
          severity: 'INFO',
          telegramText: `📍 <b>RENTAL GEOFENCE ALERT</b>\n\n📄 <b>Order:</b> #${rentalOrder.orderNumber}\n🚘 <b>Vehicle:</b> ${vehiclePlateNumber}\n🗺️ <b>Destination:</b> ${rentalOrder.destinationAddress}\n📍 <b>Distance to Destination:</b> ${distToDestinationKm.toFixed(1)} km (Limit: ${rentalOrder.geofenceRadiusKm} km)`
        });
      }
    }
  }

  /**
   * Checks for rentals nearing return deadline or overdue
   */
  async checkRentalDeadlines() {
    const now = new Date();
    const activeRentals = await prisma.rentalOrder.findMany({
      where: { status: 'ACTIVE' },
      include: { vehicle: true }
    });

    for (const order of activeRentals) {
      if (order.expectedReturnDateTime < now && order.status !== 'OVERDUE') {
        await prisma.rentalOrder.update({
          where: { id: order.id },
          data: { status: 'OVERDUE' }
        });

        await prisma.rentalEvent.create({
          data: {
            rentalOrderId: order.id,
            eventType: 'OVERDUE',
            message: `Rental order return time was ${order.expectedReturnDateTime.toISOString()}. Vehicle has not been returned.`,
          }
        });

        await notificationService.notify({
          title: `Rental Overdue: Order #${order.orderNumber}`,
          message: `Vehicle ${order.vehicle.plateNumber} (Customer: ${order.customerName}) is overdue. Return deadline was ${order.expectedReturnDateTime.toLocaleString()}.`,
          category: 'RENTAL_LIMIT',
          severity: 'CRITICAL',
          telegramText: `🚨 <b>RENTAL OVERDUE ALERT</b>\n\n📄 <b>Order:</b> #${order.orderNumber}\n🚘 <b>Vehicle:</b> ${order.vehicle.plateNumber}\n👤 <b>Customer:</b> ${order.customerName} (${order.customerPhone})\n⏰ <b>Expected Return:</b> ${order.expectedReturnDateTime.toISOString()}`
        });

        wsServer.broadcast('RENTAL_EVENT', {
          rentalOrderId: order.id,
          eventType: 'OVERDUE'
        });
      }
    }
  }
}

export const rentalService = new RentalService();
export default rentalService;
