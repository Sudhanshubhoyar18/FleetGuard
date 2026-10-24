/**
 * FleetGuard ESP32 Firmware Configuration
 * 
 * Target Microcontroller: ESP32-WROOM-32 / NodeMCU-32S
 * Cellular Module:        SIM800L (2G GSM/GPRS)
 * GPS Module:             NEO-6M
 * Relay Module:           Optocoupler Isolated Relay (Active LOW / Active HIGH)
 */

#ifndef FLEETGUARD_CONFIG_H
#define FLEETGUARD_CONFIG_H

#include <Arduino.h>

// ==========================================
// 1. PIN DEFINITIONS
// ==========================================

// SIM800L Cellular Modem UART2
#define SIM800L_RX_PIN       16   // ESP32 RX2 <- SIM800L TXD (Direct 3.3V)
#define SIM800L_TX_PIN       17   // ESP32 TX2 -> SIM800L RXD (Recommended: 1k/2k voltage divider or diode)
#define SIM800L_RST_PIN      4    // ESP32 GPIO4 -> SIM800L RST (Active LOW reset pulse, optional)
#define SIM800L_BAUD         9600 // Default SIM800L baud rate

// NEO-6M GPS UART1
#define GPS_RX_PIN           18   // ESP32 RX1 <- NEO-6M TX
#define GPS_TX_PIN           19   // ESP32 TX1 -> NEO-6M RX
#define GPS_BAUD             9600 // Default NEO-6M baud rate

// Relay Actuator (Engine Immobilizer Safe Interface)
#define RELAY_PIN            23   // ESP32 GPIO23 -> Relay IN
#define RELAY_ACTIVE_LOW     true // Most optocoupler modules trigger ON at LOW

// Status Indicator LEDs
#define LED_STATUS_PIN       2    // ESP32 Onboard Blue LED (Network/Heartbeat indicator)
#define LED_GPS_LOCK_PIN     22   // External LED (Solid = GPS fix acquired, Blinking = Searching)

// ==========================================
// 2. BACKEND & DEVICE CREDENTIALS
// ==========================================

// Unique Device Identifier registered in FleetGuard Dashboard
#define FLEETGUARD_DEVICE_ID       "FG-ESP32-001"
#define FLEETGUARD_AUTH_TOKEN      "fleetguard_device_shared_secret_token_2026"
#define FLEETGUARD_FIRMWARE_VER    "1.0.0"

// FleetGuard Backend Ingestion Server Endpoint
// Configured for your current local IP (192.168.1.12) or set to your public domain/ngrok URL
#define FLEETGUARD_SERVER_HOST     "http://192.168.1.12:5000"
#define TELEMETRY_ENDPOINT         "/api/telemetry"
#define HEARTBEAT_ENDPOINT         "/api/devices/" FLEETGUARD_DEVICE_ID "/heartbeat"
#define IMMOBILIZER_POLL_ENDPOINT  "/api/devices/" FLEETGUARD_DEVICE_ID "/immobilizer/pending"
#define IMMOBILIZER_ACK_ENDPOINT   "/api/devices/" FLEETGUARD_DEVICE_ID "/immobilizer/ack"

// ==========================================
// 3. CELLULAR NETWORK (GPRS APN)
// ==========================================
// Replace with your local SIM card operator's APN settings
#define GPRS_APN             "airtelgprs.com"  // Examples: "fast.t-mobile.com", "iot.vodafone.com", "airtelgprs.com"
#define GPRS_USER            ""
#define GPRS_PASS            ""

// ==========================================
// 4. TIMING & THRESHOLDS (Milliseconds)
// ==========================================
#define TELEMETRY_INTERVAL_MOVING_MS      5000   // 5s update interval while vehicle is in motion
#define TELEMETRY_INTERVAL_PARKED_MS      30000  // 30s update interval while stationary
#define HEARTBEAT_INTERVAL_MS             15000  // 15s heartbeat ping
#define IMMOBILIZER_POLL_INTERVAL_MS      10000  // 10s command polling
#define MAX_OFFLINE_BUFFER_SIZE           50     // Capacity of circular telemetry buffer during outages

// Critical Safety Threshold: Maximum vehicle speed allowed for physical immobilization
#define IMMOBILIZER_MAX_SAFE_SPEED_KMH    5.0f

#endif // FLEETGUARD_CONFIG_H
