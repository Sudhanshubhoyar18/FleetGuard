# 🛡️ FleetGuard

### IoT-Based Live Car Tracking, Security, and Rental Fleet Management System

FleetGuard is an end-to-end IoT vehicle monitoring and security platform connecting embedded ESP32 vehicle hardware to a real-time reactive web dashboard over bi-directional HTTP and WebSockets.

---

## 🌟 Key Capabilities

- **Live GPS Tracking & Telemetry**: Sub-second GPS telemetry rendering with Google Maps JavaScript API (plus built-in Interactive Vector Radar fallback).
- **Physical Hardware Abstraction Layer (HAL)**: PlatformIO C++ firmware with modular drivers for **SIM800L (2G GSM/GPRS)**, **NEO-6M GPS**, and **Optocoupler Relays**.
- **Safe Vehicle Immobilizer (Kill Switch)**: Multi-stage command lifecycle (`REQUESTED` → `DELIVERED` → `ACKNOWLEDGED` → `COMPLETED` / `FAILED`) enforcing automotive moving-vehicle safety interlocks (&le; 5.0 km/h).
- **Autonomous Watchdog Supervision**: Detects device heartbeat timeouts and automatically transitions connection status between `ONLINE` and `OFFLINE`.
- **GPS Jump & Drift Filtering**: Mathematically validates coordinate plausibility using the Great-Circle Haversine formula and rejects Null Island `(0.0, 0.0)` or impossible multi-path teleportations.
- **Rental Fleet & Geofence Management**: Manages rental contracts, odometer allowances, destination radii, return deadlines, and overdue alerts.
- **Telegram Bot API Integration**: Real-time push notifications for overspeed events, geofence breaches, and immobilizer commands.
- **Interactive IoT Hardware Simulator**: Software simulator streaming realistic road trips with simulated deceleration and immobilizer acknowledgment.
- **Automotive UI/UX**: High-contrast light and cyber-tech dark modes, responsive telemetry cards, filterable history, and CSV export.

---

## 📁 Repository Structure

```
FleetGuard/
├── backend/                  # Node.js + Express + TypeScript + Prisma ORM
│   ├── src/
│   │   ├── config/           # Environment and engine thresholds
│   │   ├── middleware/       # JWT auth & device token validation
│   │   ├── routes/           # REST endpoints
│   │   ├── services/         # Telemetry, trips, rentals, immobilizer, telegram
│   │   ├── websocket/        # Real-time WebSocket broadcasting server
│   │   └── __tests__/        # Automated Vitest test suite
│   ├── prisma/               # Database schema & seed scripts
│   └── package.json
│
├── frontend/                 # React 18 + TypeScript + Vite + Lucide Icons
│   ├── src/
│   │   ├── components/       # MapComponent, Navbar, Sidebar, StatCards, Modals
│   │   ├── contexts/         # ThemeContext (Light/Dark) & AuthContext
│   │   ├── pages/            # Dashboard, LiveTracking, Vehicles, Rentals, Alerts...
│   │   ├── services/         # Typed API client & auto-reconnecting WebSocket hook
│   │   └── styles/           # Modern millennial automotive design system
│   └── package.json
│
├── firmware/                 # PlatformIO ESP32 Embedded Firmware
│   ├── include/
│   │   ├── config.h          # Pinout definitions & server host endpoints
│   │   ├── HAL/              # Hardware Abstraction Layer (INetwork, IGps, IRelay)
│   │   ├── OfflineBuffer.h   # Circular ring buffer for cellular outages
│   │   └── ImmobilizerSafeController.h
│   ├── src/
│   │   ├── Sim800LDriver.cpp # AT command GPRS pipeline
│   │   ├── Neo6mGpsDriver.cpp# TinyGPSPlus NMEA parser
│   │   ├── RelayDriver.cpp   # Fail-safe optocoupler driver
│   │   └── main.cpp          # Non-blocking operational loop
│   └── platformio.ini
│
├── simulator/                # IoT Device & Road Telemetry Simulator
│   ├── iot-device-simulator.ts
│   └── package.json
│
├── docs/                     # Comprehensive Engineering Specifications
│   ├── architecture.md       # Architectural diagrams & pipeline design
│   ├── wiring.md             # Electrical pinout & 2A capacitor specifications
│   ├── safety.md             # Automotive safety interlock standards
│   ├── api.md                # REST & WebSocket protocol reference
│   ├── setup.md              # Installation & startup walkthrough
│   ├── deployment.md         # Production PM2, Nginx, and Docker guide
│   ├── troubleshooting.md    # Common hardware & network solutions
│   └── hardware_testing_checklist.md
│
├── docker-compose.yml        # Multi-container production deployment
└── README.md
```

---

## ⚡ Quick Start

### 1. Start the Backend
```bash
cd backend
npm install
npx prisma db push
npx tsx src/prisma/seed.ts
npm test
npm run dev
```
Backend runs at `http://localhost:5000/api` and `ws://localhost:5000/ws`.

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Run the Hardware Simulator
```bash
cd simulator
npm start
```
The simulator will stream live road coordinates, fluctuate speed, and demonstrate safe immobilizer deceleration.

---

## 🔒 Automotive Safety Standard Notice

FleetGuard enforces moving-vehicle interlocks:
Engine immobilization commands are **never** executed while a vehicle is traveling &gt; 5.0 km/h. Commands remain in `REQUESTED` status until the vehicle comes to a complete safe stop, preventing loss of power steering or brake servo vacuum.

---

## 📄 License
ISC License © 2026 FleetGuard Team.
