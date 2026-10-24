#ifndef SIM800L_DRIVER_H
#define SIM800L_DRIVER_H

#include "INetworkDriver.h"
#include <HardwareSerial.h>

class Sim800LDriver : public INetworkDriver {
private:
  HardwareSerial& _modemSerial;
  int _rxPin;
  int _txPin;
  int _rstPin;
  uint32_t _baud;
  String _apn;
  String _user;
  String _pass;
  bool _connected;
  unsigned long _lastRegistrationCheck;

  bool sendAtCommand(const String& cmd, const String& expectedResponse, unsigned long timeoutMs = 3000);
  String sendAtCommandWithReply(const String& cmd, unsigned long timeoutMs = 3000);

public:
  Sim800LDriver(
    HardwareSerial& serial,
    int rxPin,
    int txPin,
    int rstPin,
    uint32_t baud,
    const String& apn,
    const String& user = "",
    const String& pass = ""
  );

  bool init() override;
  bool connect() override;
  bool isConnected() override;
  int getSignalQuality() override;
  bool httpPost(
    const String& endpoint,
    const String& payload,
    const String& authToken,
    String& responseOut
  ) override;
  bool httpGet(
    const String& endpoint,
    const String& authToken,
    String& responseOut
  ) override;
  void loop() override;
};

#endif // SIM800L_DRIVER_H
