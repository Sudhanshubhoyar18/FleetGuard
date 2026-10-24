# FleetGuard - API & WebSocket Protocol Reference

## Base URLs
- **HTTP REST API**: `http://localhost:5000/api`
- **WebSocket Telemetry Stream**: `ws://localhost:5000/ws`

---

## 1. Authentication

### User Authentication (JWT)
Send Bearer token in the `Authorization` header for protected operator/admin endpoints:
```http
Authorization: Bearer <jwt_token>
```

- `POST /api/auth/login`: `{ "email": "operator@fleetguard.io", "password": "..." }`
- `POST /api/auth/register`: `{ "email": "...", "password": "...", "name": "...", "role": "OPERATOR" }`
- `GET /api/auth/me`: Returns current authenticated user profile.

### Device Authentication (IoT ESP32 & Simulator)
IoT hardware must provide the device shared secret in the `x-device-token` header:
```http
x-device-token: fleetguard_device_shared_secret_token_2026
```

---

## 2. Telemetry Ingestion Endpoints

### Single Telemetry Packet
`POST /api/telemetry`
```json
{
  "deviceId": "FG-ESP32-001",
  "timestamp": "2026-10-21T14:30:00.000Z",
  "latitude": 37.77492,
  "longitude": -122.41941,
  "altitude": 16.5,
  "speedKmH": 45.2,
  "headingDegrees": 55.0,
  "hdop": 0.9,
  "satelliteCount": 10,
  "isGpsValid": true,
  "cellularSignalRssi": -68,
  "isSimulated": false
}
```

### Batch Buffered Telemetry (Replay after cellular reconnect)
`POST /api/telemetry` (Array of packets):
```json
[
  { "deviceId": "FG-ESP32-001", "latitude": 37.7749, "longitude": -122.4194, "speedKmH": 30.0 },
  { "deviceId": "FG-ESP32-001", "latitude": 37.7765, "longitude": -122.4172, "speedKmH": 42.0 }
]
```

### Device Heartbeat
`POST /api/devices/:id/heartbeat`
```json
{
  "batteryVoltage": 12.6,
  "gsmSignal": -68,
  "networkStatus": "GPRS_ATTACHED",
  "isGpsLocked": true,
  "memoryFreeBytes": 182400
}
```

---

## 3. Vehicles & Live Tracking

- `GET /api/vehicles`: Returns all vehicles with paired device status and latest location.
- `POST /api/vehicles`: Registers a new vehicle in the fleet.
- `GET /api/vehicles/:id`: Returns single vehicle with active rental and recent alerts.
- `GET /api/vehicles/:id/location`: Returns latest valid GPS point vs stale flag.
- `GET /api/vehicles/:id/history?limit=200`: Returns breadcrumb trail points.
- `GET /api/vehicles/:id/trips`: Returns trip summaries with distance metrics.

---

## 4. Safe Engine Immobilizer

- `POST /api/vehicles/:id/immobilizer/commands`
  ```json
  {
    "commandType": "IMMOBILIZE", // or "RESTORE"
    "reason": "Authorized contract termination",
    "isSimulated": false
  }
  ```
- `GET /api/vehicles/:id/immobilizer/status`: Returns current relay state and command history.
- `GET /api/devices/:id/immobilizer/pending`: Polled by ESP32 over cellular.
- `POST /api/devices/:id/immobilizer/ack`:
  ```json
  {
    "commandId": "uuid-...",
    "relayState": "ACTIVE",
    "vehicleSpeedAtAckKmH": 0.0,
    "isExecutionComplete": true
  }
  ```

---

## 5. Rental Orders & Geofencing

- `GET /api/rentals?status=ACTIVE`: Returns active rental orders.
- `POST /api/rentals`: Creates a new rental contract with geofence and distance allowance.
- `POST /api/rentals/:id/complete`: Ends rental and calculates final distance.

---

## 6. Real-Time WebSocket Events

Connect to `ws://localhost:5000/ws`.

Messages are broadcast as JSON:
```json
{
  "type": "TELEMETRY_UPDATE",
  "data": {
    "deviceId": "FG-ESP32-001",
    "vehicleId": "...",
    "plateNumber": "SAMPLE-FG-01",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "speedKmH": 42.5,
    "headingDegrees": 55,
    "timestamp": "2026-10-21T14:30:00.000Z",
    "isOnline": true
  },
  "timestamp": "2026-10-21T14:30:00.000Z"
}
```

Supported event types:
- `TELEMETRY_UPDATE`
- `DEVICE_STATUS` (transitions to ONLINE / OFFLINE)
- `DEVICE_HEARTBEAT`
- `SPEED_ALERT`
- `RENTAL_EVENT` (`DISTANCE_EXCEEDED`, `GEOFENCE_DEVIATION`, `OVERDUE`)
- `IMMOBILIZER_STATUS`
- `NOTIFICATION`
