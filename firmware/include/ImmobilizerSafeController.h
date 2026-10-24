#ifndef IMMOBILIZER_SAFE_CONTROLLER_H
#define IMMOBILIZER_SAFE_CONTROLLER_H

#include <Arduino.h>
#include "HAL/IRelayDriver.h"
#include "HAL/INetworkDriver.h"
#include "HAL/IGpsDriver.h"

struct PendingCommand {
  bool active;
  String commandId;
  String commandType; // "IMMOBILIZE" or "RESTORE"
  unsigned long receivedAtMs;
};

class ImmobilizerSafeController {
private:
  IRelayDriver& _relay;
  INetworkDriver& _network;
  IGpsDriver& _gps;
  String _deviceId;
  String _authToken;
  String _serverHost;
  float _maxSafeSpeedKmH;
  PendingCommand _pendingCmd;

public:
  ImmobilizerSafeController(
    IRelayDriver& relay,
    INetworkDriver& network,
    IGpsDriver& gps,
    const String& deviceId,
    const String& authToken,
    const String& serverHost,
    float maxSafeSpeedKmH = 5.0f
  );

  void init();
  void pollForCommands();
  void evaluatePendingSafety();
  bool sendAcknowledgment(
    const String& commandId,
    const String& relayState,
    float speedAtAck,
    bool isComplete,
    const String& failureReason = ""
  );
};

#endif // IMMOBILIZER_SAFE_CONTROLLER_H
