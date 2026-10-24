/**
 * ==============================================================================
 * 🛡️ FleetGuard - All-in-One ESP32 IoT Vehicle Tracker & Safe Immobilizer Sketch
 * ==============================================================================
 * 
 * Hardware Required:
 * - ESP32-WROOM-32 / NodeMCU-32S
 * - SIM800L 2G GSM/GPRS Cellular Modem (External 4.0V DC / 2.5A Buck Converter + 2200uF Capacitor)
 * - u-blox NEO-6M GPS Receiver (3.3V)
 * - 1-Channel 5V/3.3V Optocoupler Relay Module (Active-LOW)
 * 
 * Required Libraries (Install via Arduino Library Manager):
 * 1. TinyGPSPlus by Mikal Hart (v1.0.3+)
 * 2. ArduinoJson by Benoit Blanchon (v7.x or v6.x)
 * 
 * Target Board in Arduino IDE: "ESP32 Dev Module"
 * Upload Speed: 921600 (or 115200)
 * Serial Monitor Baud Rate: 115200
 */

#include <Arduino.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>
#include <ArduinoJson.h>

// ==============================================================================
// 1. PIN DEFINITIONS & WIRING
// ==============================================================================

// SIM800L Cellular Modem (UART2)
#define SIM800L_RX_PIN        16   // ESP32 RX2 <- SIM800L TXD (3.3V logic)
#define SIM800L_TX_PIN        17   // ESP32 TX2 -> SIM800L RXD
#define SIM800L_RST_PIN       4    // ESP32 GPIO4 -> SIM800L RST (optional)
#define SIM800L_BAUD          9600

// NEO-6M GPS Receiver (UART1)
#define GPS_RX_PIN            18   // ESP32 RX1 <- NEO-6M TX
#define GPS_TX_PIN            19   // ESP32 TX1 -> NEO-6M RX
#define GPS_BAUD              9600

// Optocoupler Relay Actuator (Active-LOW)
#define RELAY_PIN             23   // ESP32 GPIO23 -> Relay IN
#define RELAY_TRIGGER_STATE   LOW  // LOW = Relay ENERGIZED (Cuts starter/ignition)
#define RELAY_NORMAL_STATE    HIGH // HIGH = Relay OFF (Car starts/drives normally)

// Status LEDs
#define LED_STATUS_PIN        2    // Onboard Blue LED (Network/Heartbeat)
#define LED_GPS_LOCK_PIN      22   // External LED (Solid = GPS Lock, Blink = Searching)

// ==============================================================================
// 2. NETWORK, CREDENTIALS & SERVER SETTINGS
// ==============================================================================

#define FLEETGUARD_DEVICE_ID        "FG-ESP32-001"
#define FLEETGUARD_AUTH_TOKEN       "fleetguard_device_shared_secret_token_2026"

// Set this to your computer's IP (e.g. "http://192.168.1.12:5000") or your ngrok/domain URL
#define FLEETGUARD_SERVER_HOST      "http://192.168.1.12:5000"

// SIM Card APN (e.g. "airtelgprs.com", "viweb.in", "fast.t-mobile.com", "iot.vodafone.com")
#define GPRS_APN                    "airtelgprs.com"
#define GPRS_USER                   ""
#define GPRS_PASS                   ""

// Timing Intervals (Milliseconds)
#define TELEMETRY_INTERVAL_MOVING   5000   // 5s while vehicle is driving (> 5 km/h)
#define TELEMETRY_INTERVAL_PARKED   30000  // 30s while vehicle is parked
#define HEARTBEAT_INTERVAL          15000  // 15s health check ping
#define IMMOBILIZER_POLL_INTERVAL   10000  // 10s pending command polling
#define SAFE_IMMOBILIZE_MAX_SPEED   5.0f   // Max speed (km/h) permitted for relay cut-off

// ==============================================================================
// 3. OBJECTS & STATE
// ==============================================================================

HardwareSerial SerialSIM(2);
HardwareSerial SerialGPS(1);
TinyGPSPlus gps;

unsigned long lastTelemetryTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastImmobilizerPollTime = 0;
unsigned long lastLedBlinkTime = 0;
bool statusLedState = false;
bool isGprsConnected = false;
bool isRelayImmobilized = false;

// Pending Immobilizer Command State
struct {
  bool active;
  String commandId;
  String commandType;
} pendingCommand = { false, "", "" };

// ==============================================================================
// 4. AT COMMAND HELPER FUNCTIONS (SIM800L)
// ==============================================================================

bool sendAtCommand(const String& cmd, const String& expected, unsigned long timeoutMs = 2000) {
  while (SerialSIM.available()) SerialSIM.read();
  SerialSIM.println(cmd);

  unsigned long start = millis();
  String resp = "";
  while (millis() - start < timeoutMs) {
    while (SerialSIM.available()) {
      char c = SerialSIM.read();
      resp += c;
      if (resp.indexOf(expected) != -1) return true;
    }
    delay(5);
  }
  return false;
}

String sendAtCommandWithReply(const String& cmd, unsigned long timeoutMs = 3000) {
  while (SerialSIM.available()) SerialSIM.read();
  SerialSIM.println(cmd);

  unsigned long start = millis();
  String resp = "";
  while (millis() - start < timeoutMs) {
    while (SerialSIM.available()) {
      resp += (char)SerialSIM.read();
    }
    delay(5);
  }
  return resp;
}

int getSignalQuality() {
  String reply = sendAtCommandWithReply("AT+CSQ", 1000);
  int idx = reply.indexOf("+CSQ: ");
  if (idx != -1) {
    int comma = reply.indexOf(",", idx);
    if (comma != -1) {
      int csq = reply.substring(idx + 6, comma).toInt();
      if (csq >= 0 && csq <= 31) {
        return -113 + (csq * 2); // Convert to dBm
      }
    }
  }
  return -99;
}

bool connectGPRS() {
  Serial.println("[SIM800L] Attaching GPRS Bearer profile...");
  sendAtCommand("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", "OK", 1000);
  sendAtCommand("AT+SAPBR=3,1,\"APN\",\"" + String(GPRS_APN) + "\"", "OK", 1000);
  
  if (strlen(GPRS_USER) > 0) {
    sendAtCommand("AT+SAPBR=3,1,\"USER\",\"" + String(GPRS_USER) + "\"", "OK", 1000);
    sendAtCommand("AT+SAPBR=3,1,\"PWD\",\"" + String(GPRS_PASS) + "\"", "OK", 1000);
  }

  sendAtCommand("AT+SAPBR=1,1", "OK", 5000); // Open bearer
  String ipReply = sendAtCommandWithReply("AT+SAPBR=2,1", 2000);
  
  if (ipReply.indexOf("1,1") != -1) {
    Serial.println("[SIM800L] GPRS connected successfully! IP assigned.");
    isGprsConnected = true;
    return true;
  }
  
  Serial.println("[SIM800L] Failed to get GPRS IP. Will retry in loop.");
  isGprsConnected = false;
  return false;
}

bool httpPostJson(const String& url, const String& jsonPayload, String& responseOut) {
  if (!isGprsConnected) return false;

  sendAtCommand("AT+HTTPTERM", "OK", 500); // Reset existing HTTP session
  if (!sendAtCommand("AT+HTTPINIT", "OK", 2000)) return false;

  sendAtCommand("AT+HTTPPARA=\"CID\",1", "OK", 1000);
  sendAtCommand("AT+HTTPPARA=\"URL\",\"" + url + "\"", "OK", 1000);
  sendAtCommand("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK", 1000);
  sendAtCommand("AT+HTTPPARA=\"USERDATA\",\"x-device-token: " + String(FLEETGUARD_AUTH_TOKEN) + "\"", "OK", 1000);

  // Send payload size
  String dataCmd = "AT+HTTPDATA=" + String(jsonPayload.length()) + ",10000";
  if (!sendAtCommand(dataCmd, "DOWNLOAD", 3000)) {
    sendAtCommand("AT+HTTPTERM", "OK", 500);
    return false;
  }

  // Send JSON body
  SerialSIM.print(jsonPayload);
  delay(100);

  // Trigger POST action
  String actionResp = sendAtCommandWithReply("AT+HTTPACTION=1", 10000);
  if (actionResp.indexOf(",200,") != -1) {
    responseOut = sendAtCommandWithReply("AT+HTTPREAD", 5000);
    sendAtCommand("AT+HTTPTERM", "OK", 500);
    return true;
  }

  sendAtCommand("AT+HTTPTERM", "OK", 500);
  return false;
}

bool httpGetJson(const String& url, String& responseOut) {
  if (!isGprsConnected) return false;

  sendAtCommand("AT+HTTPTERM", "OK", 500);
  if (!sendAtCommand("AT+HTTPINIT", "OK", 2000)) return false;

  sendAtCommand("AT+HTTPPARA=\"CID\",1", "OK", 1000);
  sendAtCommand("AT+HTTPPARA=\"URL\",\"" + url + "\"", "OK", 1000);
  sendAtCommand("AT+HTTPPARA=\"USERDATA\",\"x-device-token: " + String(FLEETGUARD_AUTH_TOKEN) + "\"", "OK", 1000);

  String actionResp = sendAtCommandWithReply("AT+HTTPACTION=0", 10000);
  if (actionResp.indexOf(",200,") != -1) {
    responseOut = sendAtCommandWithReply("AT+HTTPREAD", 5000);
    sendAtCommand("AT+HTTPTERM", "OK", 500);
    return true;
  }

  sendAtCommand("AT+HTTPTERM", "OK", 500);
  return false;
}

// ==============================================================================
// 5. IMMOBILIZER SAFE INTERLOCK & ACKNOWLEDGMENT
// ==============================================================================

void sendImmobilizerAck(const String& cmdId, const String& relayState, float speed, bool complete, const String& reason = "") {
  StaticJsonDocument<256> doc;
  doc["commandId"] = cmdId;
  doc["deviceId"] = FLEETGUARD_DEVICE_ID;
  doc["relayState"] = relayState;
  doc["vehicleSpeedAtAckKmH"] = speed;
  doc["isExecutionComplete"] = complete;
  if (reason.length() > 0) doc["failureReason"] = reason;

  String payload;
  serializeJson(doc, payload);

  String url = String(FLEETGUARD_SERVER_HOST) + "/api/devices/" + FLEETGUARD_DEVICE_ID + "/immobilizer/ack";
  String resp;
  httpPostJson(url, payload, resp);
}

void evaluateImmobilizerSafety() {
  if (!pendingCommand.active) return;

  float currentSpeed = gps.speed.isValid() ? gps.speed.kmph() : 0.0f;

  if (pendingCommand.commandType == "IMMOBILIZE") {
    // AUTOMOTIVE SAFETY CHECK: Never cut ignition if moving > 5.0 km/h
    if (currentSpeed > SAFE_IMMOBILIZE_MAX_SPEED) {
      Serial.printf("[SAFETY HOLD] Speed is %.1f km/h (> 5.0 km/h). Holding relay cut until vehicle stops.\n", currentSpeed);
      sendImmobilizerAck(pendingCommand.commandId, isRelayImmobilized ? "ACTIVE" : "INACTIVE", currentSpeed, false, "Speed exceeds 5km/h safety threshold");
      return;
    }

    // Vehicle stationary: Actuate relay
    Serial.println("[IMMOBILIZER] Vehicle stationary! Triggering Relay CUT.");
    digitalWrite(RELAY_PIN, RELAY_TRIGGER_STATE); // Energize relay to cut starter circuit
    isRelayImmobilized = true;
    sendImmobilizerAck(pendingCommand.commandId, "ACTIVE", currentSpeed, true);
    pendingCommand.active = false;

  } else if (pendingCommand.commandType == "RESTORE") {
    Serial.println("[IMMOBILIZER] Restoring normal ignition circuit.");
    digitalWrite(RELAY_PIN, RELAY_NORMAL_STATE); // De-energize relay
    isRelayImmobilized = false;
    sendImmobilizerAck(pendingCommand.commandId, "INACTIVE", currentSpeed, true);
    pendingCommand.active = false;
  }
}

void pollImmobilizerCommands() {
  if (!isGprsConnected) return;

  String url = String(FLEETGUARD_SERVER_HOST) + "/api/devices/" + FLEETGUARD_DEVICE_ID + "/immobilizer/pending";
  String response = "";

  if (httpGetJson(url, response)) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);
    if (!error && doc["hasPendingCommand"].as<bool>()) {
      pendingCommand.active = true;
      pendingCommand.commandId = doc["commandId"].as<String>();
      pendingCommand.commandType = doc["commandType"].as<String>();

      Serial.print("[COMMAND INCOMING] Received: ");
      Serial.print(pendingCommand.commandType);
      Serial.print(" (ID: ");
      Serial.print(pendingCommand.commandId);
      Serial.println(")");

      evaluateImmobilizerSafety();
    }
  }
}

// ==============================================================================
// 6. TELEMETRY & HEARTBEAT DISPATCHERS
// ==============================================================================

void sendTelemetry() {
  if (!gps.location.isValid()) {
    Serial.println("[GPS] Searching for satellite lock (no valid 3D fix yet)...");
    return;
  }

  StaticJsonDocument<512> doc;
  doc["deviceId"] = FLEETGUARD_DEVICE_ID;
  doc["latitude"] = gps.location.lat();
  doc["longitude"] = gps.location.lng();
  doc["altitude"] = gps.altitude.meters();
  doc["speedKmH"] = gps.speed.kmph();
  doc["headingDegrees"] = gps.course.deg();
  doc["hdop"] = gps.hdop.hdop();
  doc["satelliteCount"] = gps.satellites.value();
  doc["isGpsValid"] = true;
  doc["cellularSignalRssi"] = getSignalQuality();
  doc["isSimulated"] = false;

  String payload;
  serializeJson(doc, payload);

  String url = String(FLEETGUARD_SERVER_HOST) + "/api/telemetry";
  String response;

  Serial.printf("[TELEMETRY] Lat: %.5f, Lng: %.5f | Speed: %.1f km/h | Sats: %d\n",
    gps.location.lat(), gps.location.lng(), gps.speed.kmph(), gps.satellites.value());

  if (httpPostJson(url, payload, response)) {
    Serial.println("[TELEMETRY] Server acknowledged packet (HTTP 200)");
  } else {
    Serial.println("[TELEMETRY] POST failed or timeout.");
  }
}

void sendHeartbeat() {
  if (!isGprsConnected) return;

  StaticJsonDocument<256> doc;
  doc["deviceId"] = FLEETGUARD_DEVICE_ID;
  doc["gsmSignal"] = getSignalQuality();
  doc["isGpsLocked"] = gps.location.isValid();
  doc["memoryFreeBytes"] = ESP.getFreeHeap();
  doc["networkStatus"] = "GPRS_ATTACHED";

  String payload;
  serializeJson(doc, payload);

  String url = String(FLEETGUARD_SERVER_HOST) + "/api/devices/" + FLEETGUARD_DEVICE_ID + "/heartbeat";
  String resp;
  httpPostJson(url, payload, resp);
  Serial.println("[HEARTBEAT] Ping sent to server.");
}

// ==============================================================================
// 7. ARDUINO SETUP & LOOP
// ==============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==================================================");
  Serial.println("🛡️  FleetGuard IoT Embedded Vehicle Tracker");
  Serial.println("📟  Device: " FLEETGUARD_DEVICE_ID);
  Serial.println("🛰️  GPS Module: NEO-6M (UART1: RX=18, TX=19)");
  Serial.println("📶  Modem: SIM800L 2G (UART2: RX=16, TX=17)");
  Serial.println("⚡  Relay Pin: GPIO 23 (Active-LOW)");
  Serial.println("==================================================");

  // Setup Relay - Default to SAFE NORMAL (Car can start) immediately!
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_NORMAL_STATE);

  // Setup LEDs
  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(LED_GPS_LOCK_PIN, OUTPUT);
  digitalWrite(LED_STATUS_PIN, LOW);
  digitalWrite(LED_GPS_LOCK_PIN, LOW);

  // Optional SIM800L hardware reset
  pinMode(SIM800L_RST_PIN, OUTPUT);
  digitalWrite(SIM800L_RST_PIN, HIGH);

  // Initialize UART ports
  SerialGPS.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  SerialSIM.begin(SIM800L_BAUD, SERIAL_8N1, SIM800L_RX_PIN, SIM800L_TX_PIN);

  Serial.println("[SYSTEM] Syncing with SIM800L modem...");
  for (int i = 0; i < 5; i++) {
    if (sendAtCommand("AT", "OK", 1000)) break;
    delay(500);
  }

  sendAtCommand("ATE0", "OK", 1000); // Echo off
  connectGPRS();

  Serial.println("[SYSTEM] Setup complete. Entering operational loop.");
}

void loop() {
  unsigned long now = millis();

  // 1. Stream GPS NMEA characters from UART1
  while (SerialGPS.available()) {
    gps.encode(SerialGPS.read());
  }

  // 2. Status LEDs blinking
  if (now - lastLedBlinkTime >= 500) {
    lastLedBlinkTime = now;
    statusLedState = !statusLedState;

    // Heartbeat LED: Solid when GPRS connected, Off when disconnected
    digitalWrite(LED_STATUS_PIN, isGprsConnected ? HIGH : LOW);

    // GPS LED: Solid when 3D fix locked, Blinking when searching
    if (gps.location.isValid()) {
      digitalWrite(LED_GPS_LOCK_PIN, HIGH);
    } else {
      digitalWrite(LED_GPS_LOCK_PIN, statusLedState ? HIGH : LOW);
    }
  }

  // 3. Evaluate safety interlock continuously
  evaluateImmobilizerSafety();

  // 4. Send Heartbeat Ping every 15s
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = now;
    sendHeartbeat();
  }

  // 5. Poll for pending immobilizer commands every 10s
  if (now - lastImmobilizerPollTime >= IMMOBILIZER_POLL_INTERVAL) {
    lastImmobilizerPollTime = now;
    pollImmobilizerCommands();
  }

  // 6. Transmit Telemetry (every 5s driving, 30s parked)
  unsigned long interval = (gps.location.isValid() && gps.speed.kmph() > 5.0f)
    ? TELEMETRY_INTERVAL_MOVING
    : TELEMETRY_INTERVAL_PARKED;

  if (now - lastTelemetryTime >= interval) {
    lastTelemetryTime = now;
    sendTelemetry();
  }
}
