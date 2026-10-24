#include "HAL/Sim800LDriver.h"

Sim800LDriver::Sim800LDriver(
  HardwareSerial& serial,
  int rxPin,
  int txPin,
  int rstPin,
  uint32_t baud,
  const String& apn,
  const String& user,
  const String& pass
) : _modemSerial(serial),
    _rxPin(rxPin),
    _txPin(txPin),
    _rstPin(rstPin),
    _baud(baud),
    _apn(apn),
    _user(user),
    _pass(pass),
    _connected(false),
    _lastRegistrationCheck(0) {}

bool Sim800LDriver::sendAtCommand(const String& cmd, const String& expectedResponse, unsigned long timeoutMs) {
  while (_modemSerial.available()) _modemSerial.read(); // Flush buffer
  _modemSerial.println(cmd);

  unsigned long start = millis();
  String response = "";
  while (millis() - start < timeoutMs) {
    while (_modemSerial.available()) {
      char c = _modemSerial.read();
      response += c;
      if (response.indexOf(expectedResponse) != -1) {
        return true;
      }
    }
    delay(5);
  }
  return false;
}

String Sim800LDriver::sendAtCommandWithReply(const String& cmd, unsigned long timeoutMs) {
  while (_modemSerial.available()) _modemSerial.read();
  _modemSerial.println(cmd);

  unsigned long start = millis();
  String response = "";
  while (millis() - start < timeoutMs) {
    while (_modemSerial.available()) {
      response += (char)_modemSerial.read();
    }
    delay(5);
  }
  return response;
}

bool Sim800LDriver::init() {
  Serial.println("[SIM800L] Initializing UART interface...");
  if (_rstPin > 0) {
    pinMode(_rstPin, OUTPUT);
    digitalWrite(_rstPin, HIGH);
    delay(100);
    digitalWrite(_rstPin, LOW);
    delay(200);
    digitalWrite(_rstPin, HIGH);
    delay(3000); // Wait for SIM800L power-on cycle
  }

  _modemSerial.begin(_baud, SERIAL_8N1, _rxPin, _txPin);
  delay(1000);

  // Auto-baud sync
  bool synced = false;
  for (int i = 0; i < 5; i++) {
    if (sendAtCommand("AT", "OK", 1000)) {
      synced = true;
      break;
    }
    delay(500);
  }

  if (!synced) {
    Serial.println("[SIM800L] ERROR: Modem not responding to AT sync. Check 4V/2A power supply and TX/RX wiring.");
    return false;
  }

  sendAtCommand("ATE0", "OK", 1000);        // Echo off
  sendAtCommand("AT+CMEE=2", "OK", 1000);    // Verbose error reporting

  // Check SIM card presence
  if (!sendAtCommand("AT+CPIN?", "READY", 3000)) {
    Serial.println("[SIM800L] ERROR: SIM card not detected or PIN required.");
    return false;
  }

  Serial.println("[SIM800L] Hardware ready. SIM detected.");
  return true;
}

bool Sim800LDriver::connect() {
  Serial.print("[SIM800L] Connecting to GPRS Network APN: ");
  Serial.println(_apn);

  // Check network registration (1 = home network, 5 = roaming)
  String reg = sendAtCommandWithReply("AT+CREG?", 2000);
  if (reg.indexOf(",1") == -1 && reg.indexOf(",5") == -1) {
    Serial.println("[SIM800L] Waiting for cellular carrier registration...");
    return false;
  }

  // Attach GPRS
  sendAtCommand("AT+CGATT=1", "OK", 5000);

  // Setup bearer configuration
  sendAtCommand("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"", "OK", 2000);
  sendAtCommand("AT+SAPBR=3,1,\"APN\",\"" + _apn + "\"", "OK", 2000);
  if (_user.length() > 0) {
    sendAtCommand("AT+SAPBR=3,1,\"USER\",\"" + _user + "\"", "OK", 2000);
    sendAtCommand("AT+SAPBR=3,1,\"PWD\",\"" + _pass + "\"", "OK", 2000);
  }

  // Open bearer profile
  sendAtCommand("AT+SAPBR=1,1", "OK", 10000);

  // Verify IP allocation
  String ipStatus = sendAtCommandWithReply("AT+SAPBR=2,1", 3000);
  if (ipStatus.indexOf("1,1") != -1) {
    _connected = true;
    Serial.println("[SIM800L] GPRS connected. Bearer established successfully.");
    return true;
  }

  _connected = false;
  return false;
}

bool Sim800LDriver::isConnected() {
  return _connected;
}

int Sim800LDriver::getSignalQuality() {
  String reply = sendAtCommandWithReply("AT+CSQ", 1500);
  int idx = reply.indexOf("+CSQ: ");
  if (idx != -1) {
    int comma = reply.indexOf(',', idx);
    if (comma != -1) {
      int csq = reply.substring(idx + 6, comma).toInt();
      // Convert CSQ (0-31) to approximate dBm: dBm = 2 * CSQ - 113
      if (csq >= 0 && csq <= 31) {
        return (2 * csq) - 113;
      }
    }
  }
  return -999;
}

bool Sim800LDriver::httpPost(
  const String& endpoint,
  const String& payload,
  const String& authToken,
  String& responseOut
) {
  if (!_connected) {
    if (!connect()) return false;
  }

  sendAtCommand("AT+HTTPTERM", "OK", 1000); // Clean previous session if any
  if (!sendAtCommand("AT+HTTPINIT", "OK", 3000)) return false;

  sendAtCommand("AT+HTTPPARA=\"CID\",1", "OK", 2000);
  sendAtCommand("AT+HTTPPARA=\"URL\",\"" + endpoint + "\"", "OK", 2000);
  sendAtCommand("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK", 2000);

  // Set custom device authorization header
  sendAtCommand("AT+HTTPPARA=\"USERDATA\",\"x-device-token: " + authToken + "\"", "OK", 2000);

  // Specify payload size and timeout
  String dataCmd = "AT+HTTPDATA=" + String(payload.length()) + ",10000";
  if (!sendAtCommand(dataCmd, "DOWNLOAD", 3000)) {
    sendAtCommand("AT+HTTPTERM", "OK", 1000);
    return false;
  }

  _modemSerial.print(payload);
  delay(100);

  // Action: 1 = POST
  String actionReply = sendAtCommandWithReply("AT+HTTPACTION=1", 12000);
  bool success = (actionReply.indexOf(",200,") != -1 || actionReply.indexOf(",201,") != -1 || actionReply.indexOf(",202,") != -1);

  if (success) {
    responseOut = sendAtCommandWithReply("AT+HTTPREAD", 3000);
  }

  sendAtCommand("AT+HTTPTERM", "OK", 2000);
  return success;
}

bool Sim800LDriver::httpGet(
  const String& endpoint,
  const String& authToken,
  String& responseOut
) {
  if (!_connected) {
    if (!connect()) return false;
  }

  sendAtCommand("AT+HTTPTERM", "OK", 1000);
  if (!sendAtCommand("AT+HTTPINIT", "OK", 3000)) return false;

  sendAtCommand("AT+HTTPPARA=\"CID\",1", "OK", 2000);
  sendAtCommand("AT+HTTPPARA=\"URL\",\"" + endpoint + "\"", "OK", 2000);
  sendAtCommand("AT+HTTPPARA=\"USERDATA\",\"x-device-token: " + authToken + "\"", "OK", 2000);

  // Action: 0 = GET
  String actionReply = sendAtCommandWithReply("AT+HTTPACTION=0", 10000);
  bool success = (actionReply.indexOf(",200,") != -1);

  if (success) {
    responseOut = sendAtCommandWithReply("AT+HTTPREAD", 3000);
  }

  sendAtCommand("AT+HTTPTERM", "OK", 2000);
  return success;
}

void Sim800LDriver::loop() {
  unsigned long now = millis();
  // Periodically check network registration every 30 seconds
  if (now - _lastRegistrationCheck > 30000) {
    _lastRegistrationCheck = now;
    String reg = sendAtCommandWithReply("AT+CREG?", 1500);
    if (reg.indexOf(",1") == -1 && reg.indexOf(",5") == -1) {
      _connected = false;
    }
  }
}
