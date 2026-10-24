# FleetGuard - Hardware & Software Troubleshooting Guide

## 1. SIM800L Cellular Modem Issues

### Problem: SIM800L keeps blinking every second and restarts or reports "UNDER-VOLTAGE WARN"
- **Cause**: Voltage sag due to insufficient peak current during GSM network registration bursts (draws up to 2.0A).
- **Solution**:
  1. Never power SIM800L from the ESP32's 3.3V or 5V pin.
  2. Use a dedicated DC-DC buck converter adjusted to **4.0V DC (rated for 2.5A minimum)**.
  3. Solder a **1000 µF to 2200 µF low-ESR capacitor** directly across the module's `VCC` and `GND` pins.
  4. Ensure a common ground wire connects the power supply, SIM800L, and ESP32.

### Problem: SIM800L LED blinks once every 3 seconds (Registered), but GPRS won't attach
- **Cause**: Incorrect APN configured in `include/config.h` or no 2G GPRS data plan active on the SIM card.
- **Solution**:
  1. Confirm your cellular provider supports 2G GSM in your region.
  2. Verify the APN string with your carrier (e.g. `airtelgprs.com`, `fast.t-mobile.com`, `iot.vodafone.com`).
  3. Ensure the SIM card PIN lock is disabled using a phone before inserting it into SIM800L.

---

## 2. NEO-6M GPS Receiver Issues

### Problem: GPS LED blinks on ESP32, but dashboard shows "No GPS Telemetry Available"
- **Cause**: GPS module is indoors or has not acquired a satellite lock.
- **Solution**:
  1. The NEO-6M ceramic patch antenna must have an unobstructed view of the open sky. GPS satellite signals (L1 1575.42 MHz) cannot penetrate concrete ceilings.
  2. First fix from cold start takes **35 to 90 seconds** outdoors.
  3. When the tiny green LED on the NEO-6M module itself starts blinking once per second, a valid 3D satellite fix has been acquired.

### Problem: Coordinates are reported as 0.0, 0.0 (Null Island)
- **Cause**: GPS UART parser was read before satellite lock was valid.
- **Solution**: FleetGuard's firmware and backend validation filter automatically reject `(0.0, 0.0)` packets to prevent invalid drift data from polluting history.

---

## 3. Google Maps API Key Issues

### Problem: Map shows "For development purposes only" or a gray error box
- **Cause**: The Google Maps API key is invalid, missing billing enablement, or restricted to other domains.
- **Solution**:
  1. Go to Google Cloud Console > APIs & Services > Credentials.
  2. Ensure **Maps JavaScript API** is enabled.
  3. Set Website Restrictions to allow `localhost:3000` during development.
  4. Note that if no key is supplied, FleetGuard seamlessly switches to the built-in **Interactive Vector Radar / OpenStreetMap Fallback**, ensuring the application remains 100% operational.
