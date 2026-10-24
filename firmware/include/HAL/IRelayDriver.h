#ifndef IRELAY_DRIVER_H
#define IRELAY_DRIVER_H

#include <Arduino.h>

class IRelayDriver {
public:
  virtual ~IRelayDriver() {}

  /**
   * Configures GPIO pin mode and ensures safe initial state.
   */
  virtual void init() = 0;

  /**
   * Sets relay state (true = Cut/Triggered, false = Normal/Closed circuit).
   */
  virtual bool setTriggered(bool triggered) = 0;

  /**
   * Returns current physical state of relay.
   */
  virtual bool isTriggered() = 0;
};

#endif // IRELAY_DRIVER_H
