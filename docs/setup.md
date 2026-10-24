# FleetGuard - Setup & Execution Guide

Follow this guide to install dependencies, run the backend, start the frontend, simulate vehicle telemetry, and flash the ESP32 microcontroller.

---

## Prerequisites
- **Node.js**: v18.0.0 or higher (v24.x tested and verified)
- **NPM**: v9.0.0 or higher
- **PlatformIO CLI / VSCode Extension** (for physical ESP32 flashing)

---

## 1. Backend Setup & Startup

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd FleetGuard/backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the database and apply schema:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. Seed verified sample fleet vehicles, devices, and demo accounts:
   ```bash
   npx tsx src/prisma/seed.ts
   ```
   *Default Demo Accounts:*
   - **Admin**: `admin@fleetguard.io` / `FleetGuard2026!`
   - **Operator**: `operator@fleetguard.io` / `FleetGuard2026!`

5. Run unit & integration tests:
   ```bash
   npm test
   ```

6. Start the backend development server:
   ```bash
   npm run dev
   ```
   Backend will start at:
   - **HTTP REST API**: `http://localhost:5000/api`
   - **WebSocket Stream**: `ws://localhost:5000/ws`

---

## 2. Frontend Setup & Startup

1. Open a second terminal and navigate to the frontend folder:
   ```bash
   cd FleetGuard/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Configure Google Maps API Key in `frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   VITE_WS_URL=ws://localhost:5000/ws
   VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
   ```
   *(Note: If left blank, FleetGuard automatically uses its built-in interactive vector radar fallback mode.)*

4. Start the frontend development server:
   ```bash
   npm run dev
   ```
5. Open your browser at `http://localhost:3000`.

---

## 3. IoT Hardware & Telemetry Simulator

If physical ESP32 hardware is not yet attached, test real-time tracking, speed alerts, and safe engine cut-offs using the built-in simulator:

1. Open a third terminal and navigate to the simulator folder:
   ```bash
   cd FleetGuard/simulator
   ```
2. Start the interactive vehicle telemetry stream:
   ```bash
   npm start
   ```
   The simulator will:
   - Transmit realistic road GPS coordinates every 3 seconds to the backend.
   - Send periodic device heartbeat pings.
   - Poll for immobilizer safety commands.
   - Safely decelerate to a complete stop when an immobilization command is received, then actuate relay and report `COMPLETED` ACK in real time!

3. To test speed limit violation alerts specifically:
   ```bash
   npm run speed-test
   ```

---

## 4. ESP32 Firmware Build & Flashing (Physical Hardware)

1. Navigate to the firmware directory:
   ```bash
   cd FleetGuard/firmware
   ```
2. Edit `include/config.h`:
   - Set `FLEETGUARD_SERVER_HOST` to your backend server's IP address (e.g. `http://192.168.1.100:5000`).
   - Set `GPRS_APN` to your cellular SIM operator's APN (e.g. `airtelgprs.com`, `fast.t-mobile.com`).
3. Connect ESP32 via USB and flash using PlatformIO:
   ```bash
   pio run -t upload
   ```
4. Monitor serial diagnostics at 115200 baud:
   ```bash
   pio device monitor -b 115200
   ```
