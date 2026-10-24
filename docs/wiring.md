# FleetGuard - Hardware Pinout & Wiring Specifications

## Target Hardware Modules

1. **Microcontroller**: ESP32-WROOM-32 / NodeMCU-32S (38-pin or 30-pin)
2. **Cellular Modem**: SIM800L (2G GSM/GPRS)
3. **GPS Receiver**: u-blox NEO-6M with ceramic patch antenna
4. **Relay Module**: 1-Channel 5V/3.3V Optocoupler-Isolated Relay (Active LOW)

---

## ⚠️ Critical Electrical Power Specifications (SIM800L)

> [!CAUTION]
> **DO NOT CONNECT SIM800L VCC DIRECTLY TO THE ESP32 3.3V OR 5V PIN.**
> 
> The SIM800L requires **3.7V to 4.2V** (nominal 4.0V) and draws **up to 2.0 Amps in microsecond bursts** during GSM RF transmission and network registration.
> Connecting SIM800L directly to the ESP32 onboard LDO regulator will cause immediate voltage drop, microcontroller brownout resets, and permanent SIM800L failure.

### Required Power Supply Configuration:
- Use an external DC-DC Buck Converter (e.g. **LM2596** or **MP1584EN**) stepped down from vehicle 12V/24V or lithium cell to **4.0V DC (rated for 2.5A to 3.0A minimum)**.
- Solder a **1000 µF to 2200 µF 16V Low-ESR Electrolytic Capacitor** in parallel with a **100 nF ceramic capacitor** directly across the SIM800L `VCC` and `GND` pins to absorb GSM 2A current spikes.
- **Common Ground**: Connect the Ground (`GND`) of the external power supply, ESP32, SIM800L, and NEO-6M together.

---

## Complete Wiring Table

| ESP32 Pin | Connected Module | Module Pin | Signal / Function | Wiring Notes |
| :--- | :--- | :--- | :--- | :--- |
| **GPIO 16** | SIM800L | **TXD** | UART2 RX (ESP32) | Direct connection (3.3V logic) |
| **GPIO 17** | SIM800L | **RXD** | UART2 TX (ESP32) | Direct or 1kΩ/2kΩ divider |
| **GPIO 4** | SIM800L | **RST** | Modem Hardware Reset | Active LOW pulse control (optional) |
| **GND** | SIM800L | **GND** | Ground | Common Ground |
| **External 4.0V** | SIM800L | **VCC / NET** | 4.0V DC (2A Peak) | Powered from dedicated 2.5A buck regulator |
| | | | | |
| **GPIO 18** | NEO-6M GPS | **TX** | UART1 RX (ESP32) | Direct connection (9600 Baud NMEA) |
| **GPIO 19** | NEO-6M GPS | **RX** | UART1 TX (ESP32) | Direct connection |
| **3V3** | NEO-6M GPS | **VCC** | 3.3V Power | From ESP32 3V3 rail (current < 50mA) |
| **GND** | NEO-6M GPS | **GND** | Ground | Common Ground |
| | | | | |
| **GPIO 23** | Relay Module | **IN** | Relay Control Trigger | Active LOW trigger (Safe Normal state = HIGH) |
| **5V / VIN** | Relay Module | **VCC** | Relay Coil Power | 5V from USB/Regulator |
| **GND** | Relay Module | **GND** | Ground | Common Ground |
| | | | | |
| **GPIO 2** | ESP32 Onboard | **Blue LED** | Network Heartbeat Status | Solid = GPRS attached; Off = Disconnected |
| **GPIO 22** | External LED | **Anode (+)** | GPS Lock Indicator | Solid = 3D Satellite Fix; Blink = Searching |

---

## Schematic Diagram Representation

```
Vehicle +12V / Battery
       |
       v
+-------------------------------+
| DC-DC Buck Converter (LM2596) | ---> Regulated 4.0V DC (3A Peak)
+-------------------------------+         |
       |                                  +----+--------------------------+
       v                                       |                          |
    Common GND                                 |                     +----+----+
       |                                   [1000uF]                  | SIM800L |
       |                                       |                     |   VCC   |
       +---------------------------------------+-------------------->|   GND   |
       |                                                             |   TXD   | ---> ESP32 GPIO16 (RX2)
       |                                                             |   RXD   | <--- ESP32 GPIO17 (TX2)
       |                                                             +---------+
       |
       |     +-------------------------+
       |     | ESP32 Microcontroller   |
       +---->| GND                     |
             | 3V3 --------------------+--------> NEO-6M VCC
             | GPIO18 (RX1) <----------+--------- NEO-6M TX
             | GPIO19 (TX1) -----------+--------> NEO-6M RX
             |                         |
             | GPIO23 (Relay IN) ------+--------> Optocoupler Relay IN
             +-------------------------+
```
