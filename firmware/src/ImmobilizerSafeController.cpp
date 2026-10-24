#include "ImmobilizerSafeController.h"
#include <ArduinoJson.h>

ImmobilizerSafeController::ImmobilizerSafeController(
  IRelayDriver& relay,
  INetworkDriver& network,
  IGpsDriver& gps,
  const String& deviceId,
  const String& authToken,
  const String& serverHost,
  float maxSafeSpeedKmH
) : _relay(relay),
    _network(network),
    _gps(gps),
    _deviceId(deviceId),
    _authToken(authToken),
    _serverHost(serverHost),
    _maxSafeSpeedKmH(maxSafeSpeedKmH) {
  _pendingCmd.active = false;
}

void ImmobilizerSafeController::init() {
  _relay.init();
  _pendingCmd.active = false;
}

void ImmobilizerSafeController::pollForCommands() {
  if (!_network.isConnected()) return;

  String url = _serverHost + "/api/devices/" + _deviceId + "/immobilizer/pending";
  String response = "";

  if (_network.httpGet(url, _authToken, response)) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);
    if (!error && doc["hasPendingCommand"].as<bool>()) {
      _pendingCmd.active = true;
      _pendingCmd.commandId = doc["commandId"].as<String>();
      _pendingCmd.commandType = doc["commandType"].as<String>();
      _pendingCmd.receivedAtMs = millis();

      Serial.print("[IMMOBILIZER] Received Command: ");
      Serial.print(_pendingCmd.commandType);
      Serial.print(" (ID: ");
      Serial.print(_pendingCmd.commandId);
      Serial.println(")");

      // Immediately evaluate safety
      evaluatePendingSafety();
    }
  }
}

void ImmobilizerSafeController::evaluatePendingSafety() {
  if (!_pendingCmd.active) return;

  GpsTelemetryData telemetry = _gps.getTelemetry();
  float currentSpeed = telemetry.isValid ? telemetry.speedKmH : 0.0f;

  if (_pendingCmd.commandType == "IMMOBILIZE") {
    // CRITICAL AUTOMOTIVE SAFETY CHECK
    // Never cut relay while the vehicle is in motion (> 5 km/h)
    if (currentSpeed > _maxSafeSpeedKmH) {
      Serial.print("[IMMOBILIZER SAFETY INTERLOCK] Vehicle speed (");
      Serial.print(currentSpeed);
      Serial.println(" km/h) exceeds safe threshold (5.0 km/h). Holding actuation until vehicle halts.");

      // Send intermediate ACK notifying backend that device received command but is safely waiting for zero speed
      sendAcknowledgment(
        _pendingCmd.commandId,
        _relay.isTriggered() ? "ACTIVE" : "INACTIVE",
        currentSpeed,
        false, // Not yet complete
        "Safety interlock holding: Vehicle is in motion (" + String(currentSpeed, 1) + " km/h)"
      );
      return;
    }

    // Vehicle is safely stationary: Actuate relay
    Serial.println("[IMMOBILIZER] Vehicle stationary. Actuating safe immobilization relay cut-off.");
    _relay.setTriggered(true);

    sendAcknowledgment(
      _pendingCmd.commandId,
      "ACTIVE",
      currentSpeed,
      true // Completed
    );

    _pendingCmd.active = false;
  } else if (_pendingCmd.commandType == "RESTORE") {
    // Restore normal ignition circuit
    Serial.println("[IMMOBILIZER] Restoring normal ignition circuit.");
    _relay.setTriggered(false);

    sendAcknowledgment(
      _pendingCmd.commandId,
      "INACTIVE",
      currentSpeed,
      true // Completed
    );

    _pendingCmd.active = false;
  }
}

bool ImmobilizerSafeController::sendAcknowledgment(
  const String& commandId,
  const String& relayState,
  float speedAtAck,
  bool isComplete,
  const String& failureReason
) {
  if (!_network.isConnected()) return false;

  StaticJsonDocument<512> doc;
  doc["commandId"] = commandId;
  doc["deviceId"] = _deviceId;
  doc["relayState"] = relayState;
  doc["vehicleSpeedAtAckKmH"] = speedAtAck;
  doc["isExecutionComplete"] = isComplete;
  if (failureReason.length() > 0) {
    doc["failureReason"] = failureReason;
  }

  String payload;
  serializeJson(doc, payload);

  String url = _serverHost + "/api/devices/" + _deviceId + "/immobilizer/ack";
  String response = "";

  return _network.httpPost(url, payload, _authToken, response);
}
