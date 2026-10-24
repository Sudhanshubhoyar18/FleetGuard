#include "HAL/RelayDriver.h"

RelayDriver::RelayDriver(int pin, bool activeLow)
  : _pin(pin), _activeLow(activeLow), _isTriggered(false) {}

void RelayDriver::init() {
  pinMode(_pin, OUTPUT);
  // Fail-safe initialization: Ensure relay is NOT triggered on boot
  if (_activeLow) {
    digitalWrite(_pin, HIGH); // Active LOW -> HIGH means Relay OFF
  } else {
    digitalWrite(_pin, LOW);  // Active HIGH -> LOW means Relay OFF
  }
  _isTriggered = false;
  Serial.println("[RELAY] Initialized in FAIL-SAFE NORMAL circuit state.");
}

bool RelayDriver::setTriggered(bool triggered) {
  _isTriggered = triggered;
  if (_activeLow) {
    digitalWrite(_pin, triggered ? LOW : HIGH);
  } else {
    digitalWrite(_pin, triggered ? HIGH : LOW);
  }

  Serial.print("[RELAY] Physical state changed: ");
  Serial.println(triggered ? "TRIGGERED (CIRCUIT CUT)" : "NORMAL (CIRCUIT CLOSED)");
  return true;
}

bool RelayDriver::isTriggered() {
  return _isTriggered;
}
