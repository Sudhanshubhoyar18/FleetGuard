import { describe, it, expect } from 'vitest';
import { haversineDistanceKm, isValidCoordinate, validateGpsMovement } from '../utils/geo.js';

describe('Geospatial & GPS Utilities', () => {
  it('correctly calculates Haversine distance between known coordinates', () => {
    // San Francisco (37.7749, -122.4194) to San Jose (37.3382, -121.8863) ~ 67-68 km
    const distKm = haversineDistanceKm(37.7749, -122.4194, 37.3382, -121.8863);
    expect(distKm).toBeGreaterThan(65);
    expect(distKm).toBeLessThan(70);
  });

  it('returns 0 distance for identical points', () => {
    const distKm = haversineDistanceKm(40.7128, -74.006, 40.7128, -74.006);
    expect(distKm).toBe(0);
  });

  it('validates legitimate coordinates and rejects invalid/out-of-bounds coordinates', () => {
    expect(isValidCoordinate(37.7749, -122.4194)).toBe(true);
    expect(isValidCoordinate(-33.8688, 151.2093)).toBe(true);

    // Latitude out of range
    expect(isValidCoordinate(95.0, 50.0)).toBe(false);
    expect(isValidCoordinate(-95.0, 50.0)).toBe(false);

    // Longitude out of range
    expect(isValidCoordinate(45.0, 190.0)).toBe(false);
    expect(isValidCoordinate(45.0, -185.0)).toBe(false);

    // Null Island (0,0) rejection
    expect(isValidCoordinate(0.0, 0.0)).toBe(false);
    expect(isValidCoordinate(0.00001, 0.00001)).toBe(false);

    // NaN / invalid types
    expect(isValidCoordinate(NaN, 10)).toBe(false);
  });

  it('identifies and rejects impossible physical GPS jumps', () => {
    const time1 = new Date('2026-10-21T10:00:00Z');
    // 10 seconds later, 50 km away (teleportation / satellite lock glitch)
    const time2 = new Date('2026-10-21T10:00:10Z');

    const result = validateGpsMovement(
      37.7749, -122.4194, time1,
      38.2000, -122.1000, time2,
      200, 5
    );

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('exceeds threshold');
  });

  it('approves legitimate driving displacement', () => {
    const time1 = new Date('2026-10-21T10:00:00Z');
    const time2 = new Date('2026-10-21T10:01:00Z'); // 60 seconds later

    // ~1 km in 60 seconds = 60 km/h (normal city/highway driving)
    const result = validateGpsMovement(
      37.7749, -122.4194, time1,
      37.7830, -122.4194, time2,
      200, 5
    );

    expect(result.isValid).toBe(true);
    expect(result.impliedSpeedKmH).toBeLessThan(100);
  });
});
