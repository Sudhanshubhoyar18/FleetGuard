# FleetGuard - Physical Hardware Acceptance Testing Checklist

Use this formal checklist before installing the FleetGuard hardware unit into a physical vehicle.

---

## Phase 1: Bench Power & Electrical Verification

- [ ] **Power Supply Voltage Test**: Measure the voltage across the SIM800L `VCC` and `GND` pins with a digital multimeter. Verify it reads between **3.8V and 4.2V DC**.
- [ ] **Decoupling Capacitor Inspection**: Confirm that a **1000 µF or 2200 µF low-ESR capacitor** is soldered directly across the SIM800L power terminals.
- [ ] **Common Ground Verification**: Use a continuity buzzer on the multimeter to confirm that ESP32 GND, power supply GND, NEO-6M GND, and SIM800L GND are all connected.
- [ ] **Relay Default State Check**: Power on the ESP32. Confirm the relay module remains **UNTRIGGERED (LED OFF)** upon power-on and reboot (fail-safe test).

---

## Phase 2: Cellular Modem & GPRS Connection

- [ ] **SIM Card PIN Test**: Verify that the SIM card does not require a PIN code (test by inserting in a smartphone first).
- [ ] **Cellular Carrier Registration**: Power on the unit and observe the SIM800L net LED. Verify that the blink pattern changes from fast (searching) to **one blink every 3 seconds** (registered to carrier network).
- [ ] **Serial Diagnostics**: Connect USB to a computer, open Serial Monitor at 115200 baud, and confirm `[SIM800L] Hardware ready. SIM detected.` and `[SIM800L] GPRS connected. Bearer established successfully.`
- [ ] **Heartbeat Ingestion**: Confirm that within 15 seconds, the FleetGuard web dashboard displays the device status transition from **OFFLINE** to **ONLINE (LIVE)**.

---

## Phase 3: GPS Fix Acquisition

- [ ] **Antenna Orientation**: Place the NEO-6M antenna outdoors or near an open window facing the sky.
- [ ] **Satellite Lock Indicator**: Wait 45–90 seconds until the tiny green pulse LED on the NEO-6M module begins flashing once per second.
- [ ] **Serial NMEA Telemetry**: Verify serial monitor shows valid non-zero latitude and longitude coordinates.
- [ ] **Map Live Marker**: Confirm that the vehicle marker on the FleetGuard dashboard snaps to the exact physical coordinates and displays current speed.

---

## Phase 4: Network Loss & Offline Buffer Recovery

- [ ] **Disconnect Antenna / Pull SIM**: Disconnect the cellular antenna or kill the backend server temporarily.
- [ ] **Local Buffer Storage**: Move the module or change GPS coordinates. Confirm serial monitor displays `[OFFLINE] Cellular disconnected. Buffering GPS telemetry locally.`
- [ ] **Reconnection & Replay**: Restore cellular connectivity. Confirm that the ESP32 flushes buffered points via `[BUFFER] Cellular restored. Replaying X buffered offline telemetry points...` without losing travel distance.

---

## Phase 5: Safe Engine Immobilizer Actuation Test

- [ ] **Submit Command While Stationary (Speed = 0)**: In the dashboard, click **Request Vehicle Immobilization**.
- [ ] **Relay Click**: Listen for the audible click of the relay armature. Verify the relay LED turns ON.
- [ ] **ACK Received**: Confirm the dashboard command status moves to **COMPLETED** and the vehicle status updates to **IMMOBILIZED**.
- [ ] **In-Motion Interlock Verification**: With vehicle moving (> 5 km/h) or simulated moving telemetry, submit **IMMOBILIZE**. Confirm the firmware logs `[IMMOBILIZER SAFETY INTERLOCK] Holding actuation until vehicle halts.` and DOES NOT click the relay until the speed drops to 0 km/h.
- [ ] **Restore Command**: Click **Restore Normal Ignition Circuit**. Verify relay clicks back to un-triggered normal state and status updates to **NORMAL**.
