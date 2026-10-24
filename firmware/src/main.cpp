/**
 * FleetGuard - IoT Live Car Tracking, Security, and Rental Fleet Management System
 * ESP32 Microcontroller Firmware Entrypoint
 * 
 * Hardware Modules:
 * - ESP32-WROOM-32
 * - SIM800L 2G GSM/GPRS Cellular Modem
 * - NEO-6M GPS Receiver
 * - Optocoupler Relay Actuator
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "HAL/Sim800LDriver.h"
#include "HAL/Neo6mGpsDriver.h"
#include "HAL/RelayDriver.h"
#include "OfflineBuffer.h"
#include "ImmobilizerSafeController.h"

// Hardware Serial instances on ESP32
HardwareSerial SerialSIM(2); // UART2 for SIM800L
HardwareSerial SerialGPS(1); // UART1 for NEO-6M GPS

// HAL Drivers
Sim800LDriver simDriver(
  SerialSIM,
  SIM800L_RX_PIN,
  SIM800L_TX_PIN,
  SIM800L_RST_PIN,
  SIM800L_BAUD,
  GPRS_APN,
  GPRS_USER,
  GPRS_PASS
);

Neo6mGpsDriver gpsDriver(SerialGPS, GPS_RX_PIN, GPS_TX_PIN, GPS_BAUD);
RelayDriver relayDriver(RELAY_PIN, RELAY_ACTIVE_LOW);
OfflineBuffer offlineBuffer(MAX_OFFLINE_BUFFER_SIZE);

ImmobilizerSafeController immobilizer(
  relayDriver,
  simDriver,
  gpsDriver,
  FLEETGUARD_DEVICE_ID,
  FLEETGUARD_AUTH_TOKEN,
  FLEETGUARD_SERVER_HOST,
  IMMOBILIZER_MAX_SAFE_SPEED_KMH
);

// Timing variables
unsigned long lastTelemetryTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastImmobilizerPollTime = 0;
unsigned long lastLedBlinkTime = 0;
bool statusLedState = false;

// Forward Declarations
void sendTelemetryPacket(const GpsTelemetryData& telemetry);
void sendHeartbeatPacket();
void flushOfflineBuffer();

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("==================================================");
  Serial.println("🛡️  FleetGuard IoT Embedded Vehicle System");
  Serial.println("📡  Device ID: " FLEETGUARD_DEVICE_ID);
  Serial.println("📟  Modem:     SIM800L (2G GSM/GPRS)");
  Serial.println("🛰️  GPS:       NEO-6M");
  Serial.println("⚡  Firmware:  v" FLEETGUARD_FIRMWARE_VER);
  Serial.println("==================================================");

  // Setup LEDs
  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(LED_GPS_LOCK_PIN, OUTPUT);
  digitalWrite(LED_STATUS_PIN, LOW);
  digitalWrite(LED_GPS_LOCK_PIN, LOW);

  // Initialize HAL Drivers
  relayDriver.init();
  gpsDriver.init();
  immobilizer.init();

  Serial.println("[SYSTEM] Initializing cellular network module...");
  if (simDriver.init()) {
    simDriver.connect();
  } else {
    Serial.println("[SYSTEM] WARNING: Modem init failed. Will retry in loop.");
  }

  Serial.println("[SYSTEM] Startup sequence complete. Entering main operational loop.");
}

void loop() {
  unsigned long now = millis();

  // 1. Service non-blocking GPS UART stream
  gpsDriver.update();

  // 2. Service cellular driver loop
  simDriver.loop();

  // 3. Update physical LED status indicators
  if (now - lastLedBlinkTime >= 500) {
    lastLedBlinkTime = now;
    statusLedState = !statusLedState;

    // Heartbeat LED: Fast blink if offline, slow heartbeat if connected
    if (simDriver.isConnected()) {
      digitalWrite(LED_STATUS_PIN, statusLedState ? HIGH : LOW);
    } else {
      digitalWrite(LED_STATUS_PIN, LOW);
    }

    // GPS LED: Solid when locked, blinking when searching
    if (gpsDriver.hasValidFix()) {
      digitalWrite(LED_GPS_LOCK_PIN, HIGH);
    } else {
      digitalWrite(LED_GPS_LOCK_PIN, statusLedState ? HIGH : LOW);
    }
  }

  // 4. Continuously evaluate immobilizer safety interlock
  immobilizer.evaluatePendingSafety();

  // 5. Periodic Heartbeat Transmission (every 15s)
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = now;
    sendHeartbeatPacket();
  }

  // 6. Periodic Immobilizer Command Polling (every 10s)
  if (now - lastImmobilizerPollTime >= IMMOBILIZER_POLL_INTERVAL_MS) {
    lastImmobilizerPollTime = now;
    immobilizer.pollForCommands();
  }

  // 7. Periodic Telemetry Transmission
  GpsTelemetryData telemetry = gpsDriver.getTelemetry();
  unsigned long telemetryInterval = (telemetry.isValid && telemetry.speedKmH > 5.0f)
    ? TELEMETRY_INTERVAL_MOVING_MS
    : TELEMETRY_INTERVAL_PARKED_MS;

  if (now - lastTelemetryTime >= telemetryInterval) {
    lastTelemetryTime = now;

    if (telemetry.isValid) {
      if (simDriver.isConnected()) {
        // Flush any buffered points from previous cellular drops first
        flushOfflineBuffer();
        // Send current live point
        sendTelemetryPacket(telemetry);
      } else {
        // Cellular disconnected: store in circular buffer
        Serial.println("[OFFLINE] Cellular disconnected. Buffering GPS telemetry locally.");
        offlineBuffer.push(telemetry, now / 1000);
      }
    } else {
      Serial.println("[GPS] Searching for satellite lock (No valid fix yet)...");
    }
  }
}

void sendTelemetryPacket(const GpsTelemetryData& telemetry) {
  StaticJsonDocument<512> doc;
  doc["deviceId"] = FLEETGUARD_DEVICE_ID;
  doc["latitude"] = telemetry.latitude;
  doc["longitude"] = telemetry.longitude;
  doc["altitude"] = telemetry.altitudeMeters;
  doc["speedKmH"] = telemetry.speedKmH;
  doc["headingDegrees"] = telemetry.headingDegrees;
  doc["hdop"] = telemetry.hdop;
  doc["satelliteCount"] = telemetry.satelliteCount;
  doc["isGpsValid"] = telemetry.isValid;
  doc["cellularSignalRssi"] = simDriver.getSignalQuality();
  doc["isSimulated"] = false;

  String payload;
  serializeJson(doc, payload);

  String url = String(FLEETGUARD_SERVER_HOST) + TELEMETRY_ENDPOINT;
  String response = "";

  Serial.print("[TELEMETRY] Transmitting fix: ");
  Serial.print(telemetry.latitude, 5);
  Serial.print(", ");
  Serial.print(telemetry.longitude, 5);
  Serial.print(" | Speed: ");
  Serial.print(telemetry.speedKmH, 1);
  Serial.println(" km/h");

  bool ok = simDriver.httpPost(url, payload, FLEETGUARD_AUTH_TOKEN, response);
  if (!ok) {
    Serial.println("[TELEMETRY] HTTP POST failed. Storing to offline buffer.");
    offlineBuffer.push(telemetry, millis() / 1000);
  }
}

void sendHeartbeatPacket() {
  if (!simDriver.isConnected()) return;

  StaticJsonDocument<256> doc;
  doc["deviceId"] = FLEETGUARD_DEVICE_ID;
  doc["gsmSignal"] = simDriver.getSignalQuality();
  doc["isGpsLocked"] = gpsDriver.hasValidFix();
  doc["memoryFreeBytes"] = ESP.getFreeHeap();
  doc["networkStatus"] = "GPRS_ATTACHED";

  String payload;
  serializeJson(doc, payload);

  String url = String(FLEETGUARD_SERVER_HOST) + HEARTBEAT_ENDPOINT;
  String response = "";

  simDriver.httpPost(url, payload, FLEETGUARD_AUTH_TOKEN, response);
}

void flushOfflineBuffer() {
  if (offlineBuffer.isEmpty()) return;

  Serial.print("[BUFFER] Cellular restored. Replaying ");
  Serial.print(offlineBuffer.count());
  Serial.println(" buffered offline telemetry points...");

  DynamicJsonDocument doc(4096);
  JsonArray arr = doc.to<JsonArray>();

  BufferedTelemetryItem item;
  while (offlineBuffer.pop(item)) {
    JsonObject obj = arr.createNestedObject();
    obj["deviceId"] = FLEETGUARD_DEVICE_ID;
    obj["latitude"] = item.telemetry.latitude;
    obj["longitude"] = item.telemetry.longitude;
    obj["speedKmH"] = item.telemetry.speedKmH;
    obj["headingDegrees"] = item.telemetry.headingDegrees;
    obj["isGpsValid"] = true;
    obj["isSimulated"] = false;
  }

  String payload;
  serializeJson(doc, payload);

  String url = String(FLEETGUARD_SERVER_HOST) + TELEMETRY_ENDPOINT;
  String response = "";

  simDriver.httpPost(url, payload, FLEETGUARD_AUTH_TOKEN, response);
}
