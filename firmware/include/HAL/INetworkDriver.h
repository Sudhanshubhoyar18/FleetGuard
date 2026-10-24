#ifndef INETWORK_DRIVER_H
#define INETWORK_DRIVER_H

#include <Arduino.h>

class INetworkDriver {
public:
  virtual ~INetworkDriver() {}

  /**
   * Initializes modem hardware, serial bus, and AT parser.
   */
  virtual bool init() = 0;

  /**
   * Connects to cellular/packet data network (GPRS APN attachment).
   */
  virtual bool connect() = 0;

  /**
   * Returns true if cellular/network connection is currently established.
   */
  virtual bool isConnected() = 0;

  /**
   * Returns signal quality / RSSI in dBm or CSQ (0-31 scale).
   */
  virtual int getSignalQuality() = 0;

  /**
   * Dispatches an HTTP POST request with custom authorization headers and payload.
   */
  virtual bool httpPost(
    const String& endpoint,
    const String& payload,
    const String& authToken,
    String& responseOut
  ) = 0;

  /**
   * Dispatches an HTTP GET request with authorization headers.
   */
  virtual bool httpGet(
    const String& endpoint,
    const String& authToken,
    String& responseOut
  ) = 0;

  /**
   * Non-blocking loop cycle for servicing AT queues and monitoring carrier status.
   */
  virtual void loop() = 0;
};

#endif // INETWORK_DRIVER_H
