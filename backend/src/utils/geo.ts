/**
 * Geospatial utility functions for GPS tracking, distance calculation,
 * and coordinate jump filtering.
 */

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Calculates Great-Circle distance between two coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Validates that GPS coordinates are within realistic global bounds
 * and not null island (0,0) or common test artifacts.
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }
  if (isNaN(latitude) || isNaN(longitude)) {
    return false;
  }
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  // Null Island check (0.0, 0.0) usually indicates uninitialized GPS UART parser
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) {
    return false;
  }
  return true;
}

export interface MovementValidationResult {
  isValid: boolean;
  reason?: string;
  distanceKm: number;
  impliedSpeedKmH: number;
}

/**
 * Validates whether movement between two sequential GPS points is physically plausible.
 * Filters out satellite multi-path jumps, cold-start leaps, or corrupt NMEA sentences.
 */
export function validateGpsMovement(
  lat1: number,
  lon1: number,
  time1: Date,
  lat2: number,
  lon2: number,
  time2: Date,
  maxAllowedSpeedKmH: number = 200,
  maxJumpKm: number = 5
): MovementValidationResult {
  const distanceKm = haversineDistanceKm(lat1, lon1, lat2, lon2);
  const timeDeltaHours = Math.abs(time2.getTime() - time1.getTime()) / (1000 * 60 * 60);

  // If time delta is less than 0.5s, accept small distance (< 20 meters), otherwise check speed
  if (timeDeltaHours < (0.5 / 3600)) {
    if (distanceKm > 0.05) {
      return {
        isValid: false,
        reason: 'Sub-second GPS displacement exceeds physical vehicle acceleration',
        distanceKm,
        impliedSpeedKmH: 999
      };
    }
    return { isValid: true, distanceKm, impliedSpeedKmH: 0 };
  }

  const impliedSpeedKmH = distanceKm / timeDeltaHours;

  if (distanceKm > maxJumpKm && timeDeltaHours < (60 / 3600)) {
    return {
      isValid: false,
      reason: `GPS jump of ${distanceKm.toFixed(2)} km in ${(timeDeltaHours * 3600).toFixed(0)}s exceeds threshold (${maxJumpKm} km)`,
      distanceKm,
      impliedSpeedKmH
    };
  }

  if (impliedSpeedKmH > maxAllowedSpeedKmH) {
    return {
      isValid: false,
      reason: `Implied speed ${impliedSpeedKmH.toFixed(1)} km/h exceeds maximum valid vehicle speed (${maxAllowedSpeedKmH} km/h)`,
      distanceKm,
      impliedSpeedKmH
    };
  }

  return {
    isValid: true,
    distanceKm,
    impliedSpeedKmH
  };
}
