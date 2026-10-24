#ifndef NEO6M_GPS_DRIVER_H
#define NEO6M_GPS_DRIVER_H

#include "IGpsDriver.h"
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>

class Neo6mGpsDriver : public IGpsDriver {
private:
  HardwareSerial& _gpsSerial;
  int _rxPin;
  int _txPin;
  uint32_t _baud;
  TinyGPSPlus _gps;

public:
  Neo6mGpsDriver(HardwareSerial& serial, int rxPin, int txPin, uint32_t baud = 9600);

  bool init() override;
  void update() override;
  bool hasValidFix() override;
  GpsTelemetryData getTelemetry() override;
};

#endif // NEO6M_GPS_DRIVER_H
