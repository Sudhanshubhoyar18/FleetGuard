#ifndef IGPS_DRIVER_H
#define IGPS_DRIVER_H

#include <Arduino.h>

struct GpsTelemetryData {
  bool isValid;
  double latitude;
  double longitude;
  float altitudeMeters;
  float speedKmH;
  float headingDegrees;
  float hdop;
  int satelliteCount;
  uint32_t ageMs;
};

class IGpsDriver {
public:
  virtual ~IGpsDriver() {}

  /**
   * Initializes the GPS UART interface and baud rate.
   */
  virtual bool init() = 0;

  /**
   * Reads incoming NMEA sentences from hardware UART in a non-blocking stream.
   */
  virtual void update() = 0;

  /**
   * Returns true if receiver has an active 2D/3D satellite lock with fresh coordinates.
   */
  virtual bool hasValidFix() = 0;

  /**
   * Returns current snapshot of GPS telemetry data.
   */
  virtual GpsTelemetryData getTelemetry() = 0;
};

#endif // IGPS_DRIVER_H
