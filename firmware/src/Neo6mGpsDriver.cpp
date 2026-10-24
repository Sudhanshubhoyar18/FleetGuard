#include "HAL/Neo6mGpsDriver.h"

Neo6mGpsDriver::Neo6mGpsDriver(HardwareSerial& serial, int rxPin, int txPin, uint32_t baud)
  : _gpsSerial(serial), _rxPin(rxPin), _txPin(txPin), _baud(baud) {}

bool Neo6mGpsDriver::init() {
  Serial.println("[GPS] Initializing NEO-6M hardware UART...");
  _gpsSerial.begin(_baud, SERIAL_8N1, _rxPin, _txPin);
  delay(100);
  return true;
}

void Neo6mGpsDriver::update() {
  while (_gpsSerial.available() > 0) {
    char c = _gpsSerial.read();
    _gps.encode(c);
  }
}

bool Neo6mGpsDriver::hasValidFix() {
  // A valid GPS fix requires fresh coordinates (age < 2500ms) and valid location sentence
  return _gps.location.isValid() && _gps.location.age() < 2500;
}

GpsTelemetryData Neo6mGpsDriver::getTelemetry() {
  GpsTelemetryData data;
  data.isValid = hasValidFix();

  if (data.isValid) {
    data.latitude = _gps.location.lat();
    data.longitude = _gps.location.lng();
    data.ageMs = _gps.location.age();
    data.altitudeMeters = _gps.altitude.isValid() ? (float)_gps.altitude.meters() : 0.0f;
    data.speedKmH = _gps.speed.isValid() ? (float)_gps.speed.kmph() : 0.0f;
    data.headingDegrees = _gps.course.isValid() ? (float)_gps.course.deg() : 0.0f;
    data.hdop = _gps.hdop.isValid() ? (float)_gps.hdop.hdop() : 99.0f;
    data.satelliteCount = _gps.satellites.isValid() ? _gps.satellites.value() : 0;
  } else {
    data.latitude = 0.0;
    data.longitude = 0.0;
    data.ageMs = 999999;
    data.altitudeMeters = 0.0f;
    data.speedKmH = 0.0f;
    data.headingDegrees = 0.0f;
    data.hdop = 99.0f;
    data.satelliteCount = _gps.satellites.isValid() ? _gps.satellites.value() : 0;
  }

  return data;
}
