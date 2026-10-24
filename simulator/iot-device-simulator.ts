/**
 * FleetGuard IoT Device Hardware & Route Simulator
 * 
 * Simulates physical ESP32 + SIM800L + NEO-6M GPS modules over HTTP REST API.
 * Emits real road waypoints, speed fluctuations, battery status, and immobilizer response.
 * 
 * Usage:
 *   npx tsx iot-device-simulator.ts
 *   npx tsx iot-device-simulator.ts --overspeed
 */

const SERVER_BASE_URL = process.env.FLEETGUARD_SERVER_URL || 'http://localhost:5000';
const DEVICE_ID = process.env.SIMULATOR_DEVICE_ID || 'FG-ESP32-001';
const DEVICE_AUTH_TOKEN = 'fleetguard_device_shared_secret_token_2026';

// Realistic Waypoints (San Francisco Mission -> Embarcadero -> Bay Bridge access)
const ROUTE_WAYPOINTS = [
  { lat: 37.7749, lng: -122.4194, speed: 32.0, heading: 45 },
  { lat: 37.7765, lng: -122.4172, speed: 42.5, heading: 48 },
  { lat: 37.7788, lng: -122.4140, speed: 48.0, heading: 52 },
  { lat: 37.7812, lng: -122.4105, speed: 51.5, heading: 55 },
  { lat: 37.7836, lng: -122.4070, speed: 54.0, heading: 56 },
  { lat: 37.7858, lng: -122.4035, speed: 56.5, heading: 58 },
  { lat: 37.7880, lng: -122.4000, speed: 58.0, heading: 60 },
  { lat: 37.7905, lng: -122.3965, speed: 45.0, heading: 65 },
  { lat: 37.7925, lng: -122.3930, speed: 38.0, heading: 70 },
  { lat: 37.7942, lng: -122.3955, speed: 25.0, heading: 140 },
  { lat: 37.7920, lng: -122.3980, speed: 35.0, heading: 220 },
  { lat: 37.7895, lng: -122.4015, speed: 40.0, heading: 225 },
  { lat: 37.7865, lng: -122.4050, speed: 48.0, heading: 230 },
  { lat: 37.7835, lng: -122.4085, speed: 42.0, heading: 232 },
  { lat: 37.7800, lng: -122.4125, speed: 36.0, heading: 235 },
  { lat: 37.7770, lng: -122.4165, speed: 28.0, heading: 240 }
];

let waypointIndex = 0;
let relayCutTriggered = false;
let pendingCommand: any = null;

const isOverspeedTest = process.argv.includes('--overspeed');

console.log('======================================================');
console.log('🤖 FleetGuard IoT Hardware & Vehicle Telemetry Simulator');
console.log(`📡 Target Server: ${SERVER_BASE_URL}`);
console.log(`📟 Simulated Device: ${DEVICE_ID}`);
console.log(` Mode: ${isOverspeedTest ? 'OVERSPEED STRESS TEST (105 km/h)' : 'REALISTIC COMMUTE ROUTE'}`);
console.log('======================================================');

async function sendHeartbeat() {
  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/devices/${DEVICE_ID}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': DEVICE_AUTH_TOKEN
      },
      body: JSON.stringify({
        batteryVoltage: (12.4 + Math.random() * 0.4).toFixed(2),
        gsmSignal: -65 + Math.floor(Math.random() * 10),
        networkStatus: 'GPRS_ATTACHED',
        isGpsLocked: true,
        memoryFreeBytes: 182400
      })
    });
    if (res.ok) {
      console.log(`[SIMULATOR HEARTBEAT] Sent device ping for ${DEVICE_ID} (Status: OK)`);
    }
  } catch (err: any) {
    console.error(`[SIMULATOR HEARTBEAT ERROR] ${err.message}`);
  }
}

async function checkPendingCommands() {
  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/devices/${DEVICE_ID}/immobilizer/pending`, {
      headers: {
        'x-device-token': DEVICE_AUTH_TOKEN
      }
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.hasPendingCommand && (!pendingCommand || pendingCommand.commandId !== data.commandId)) {
        pendingCommand = data;
        console.log(`\n🔒 [SIMULATOR IMMOBILIZER EVENT] Received Pending Command: ${data.commandType} (ID: ${data.commandId})`);
      }
    }
  } catch (err: any) {
    console.error(`[SIMULATOR COMMAND POLL ERROR] ${err.message}`);
  }
}

async function executePendingImmobilizerCommand(currentSpeed: number) {
  if (!pendingCommand) return;

  const { commandId, commandType } = pendingCommand;

  if (commandType === 'IMMOBILIZE') {
    // Check automotive safety interlock
    if (currentSpeed > 5.0) {
      console.log(`⚠️ [SAFETY INTERLOCK ACTIVE] Current speed is ${currentSpeed.toFixed(1)} km/h (> 5 km/h limit). Engine cut postponed until vehicle safely stops.`);

      // Send holding intermediate ACK
      await fetch(`${SERVER_BASE_URL}/api/devices/${DEVICE_ID}/immobilizer/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': DEVICE_AUTH_TOKEN
        },
        body: JSON.stringify({
          commandId,
          relayState: relayCutTriggered ? 'ACTIVE' : 'INACTIVE',
          vehicleSpeedAtAckKmH: currentSpeed,
          isExecutionComplete: false,
          failureReason: `Safety interlock: Vehicle in motion at ${currentSpeed.toFixed(1)} km/h. Waiting for full stop.`
        })
      });
      return;
    }

    // Vehicle is stopped (speed <= 5.0 km/h)
    console.log(`✅ [SAFETY VERIFIED] Vehicle has come to a complete safe stop (Speed: ${currentSpeed.toFixed(1)} km/h). Actuating immobilizer relay cut-off.`);
    relayCutTriggered = true;

    await fetch(`${SERVER_BASE_URL}/api/devices/${DEVICE_ID}/immobilizer/ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': DEVICE_AUTH_TOKEN
      },
      body: JSON.stringify({
        commandId,
        relayState: 'ACTIVE',
        vehicleSpeedAtAckKmH: currentSpeed,
        isExecutionComplete: true
      })
    });

    console.log(`🔌 [RELAY STATE] Circuit CUT. Engine immobilized successfully. (Command: ${commandId})`);
    pendingCommand = null;
  } else if (commandType === 'RESTORE') {
    console.log(`✅ [IMMOBILIZER RESTORE] Re-enabling normal vehicle ignition circuit.`);
    relayCutTriggered = false;

    await fetch(`${SERVER_BASE_URL}/api/devices/${DEVICE_ID}/immobilizer/ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': DEVICE_AUTH_TOKEN
      },
      body: JSON.stringify({
        commandId,
        relayState: 'INACTIVE',
        vehicleSpeedAtAckKmH: currentSpeed,
        isExecutionComplete: true
      })
    });

    console.log(`🔌 [RELAY STATE] Normal ignition circuit restored. (Command: ${commandId})`);
    pendingCommand = null;
  }
}

async function sendTelemetryPoint() {
  const waypoint = ROUTE_WAYPOINTS[waypointIndex];
  waypointIndex = (waypointIndex + 1) % ROUTE_WAYPOINTS.length;

  let speed = waypoint.speed;
  if (isOverspeedTest) {
    speed = 105.0; // Deliberate speed violation test
  }

  // If immobilizer is cut or command is pending to immobilize, simulate vehicle decelerating
  if (pendingCommand && pendingCommand.commandType === 'IMMOBILIZE') {
    speed = Math.max(0, speed * 0.3); // Safe deceleration
  }
  if (relayCutTriggered) {
    speed = 0.0; // Engine cut
  }

  // Check and process immobilizer state
  if (pendingCommand) {
    await executePendingImmobilizerCommand(speed);
  }

  const payload = {
    deviceId: DEVICE_ID,
    timestamp: new Date().toISOString(),
    latitude: waypoint.lat + (Math.random() - 0.5) * 0.0001,
    longitude: waypoint.lng + (Math.random() - 0.5) * 0.0001,
    altitude: 15.0 + Math.random() * 5,
    speedKmH: Math.round(speed * 10) / 10,
    headingDegrees: waypoint.heading,
    hdop: 0.9,
    satelliteCount: 10,
    isGpsValid: true,
    cellularSignalRssi: -70 + Math.floor(Math.random() * 8),
    isSimulated: true // Clearly flagged as simulated telemetry
  };

  try {
    const res = await fetch(`${SERVER_BASE_URL}/api/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': DEVICE_AUTH_TOKEN
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(
        `[SIMULATOR TELEMETRY] Lat: ${payload.latitude.toFixed(5)}, Lng: ${payload.longitude.toFixed(5)} | Speed: ${payload.speedKmH} km/h | Heading: ${payload.headingDegrees}° | Relay: ${relayCutTriggered ? 'CUT' : 'NORMAL'}`
      );
    } else {
      const err = await res.text();
      console.error(`[SIMULATOR TELEMETRY ERROR] Server returned ${res.status}: ${err}`);
    }
  } catch (err: any) {
    console.error(`[SIMULATOR NETWORK ERROR] ${err.message}`);
  }
}

// Start simulation loops
sendHeartbeat();
sendTelemetryPoint();

// Send telemetry every 3 seconds
setInterval(sendTelemetryPoint, 3000);

// Send heartbeat every 15 seconds
setInterval(sendHeartbeat, 15000);

// Poll for immobilizer commands every 5 seconds
setInterval(checkPendingCommands, 5000);
