#ifndef RELAY_DRIVER_H
#define RELAY_DRIVER_H

#include "IRelayDriver.h"

class RelayDriver : public IRelayDriver {
private:
  int _pin;
  bool _activeLow;
  bool _isTriggered;

public:
  RelayDriver(int pin, bool activeLow = true);

  void init() override;
  bool setTriggered(bool triggered) override;
  bool isTriggered() override;
};

#endif // RELAY_DRIVER_H
