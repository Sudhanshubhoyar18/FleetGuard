# FleetGuard - Automotive Immobilization Safety Protocols & Legal Standards

## 1. Why Direct In-Motion Engine Cut-Off is Hazardous & Prohibited

> [!CAUTION]
> **UNDER NO CIRCUMSTANCES SHOULD A RELAY BE DIRECTLY WIRED TO CUT THE PRIMARY IGNITION, FUEL PUMP, OR ENGINE CONTROL UNIT (ECU) OF A MOVING MOTOR VEHICLE.**

Abruptly de-energizing an internal combustion engine or electric vehicle drivetrain while traveling on public roadways creates catastrophic safety failures:

1. **Loss of Hydraulic Power Steering**: When the engine ceases rotation, belt-driven hydraulic power steering pumps or electric power steering racks enter limp/fail-safe mode, causing immediate steering heaviness and potential crash into oncoming traffic.
2. **Depletion of Power Brake Vacuum**: Vacuum brake boosters rely on engine intake manifold vacuum. Within 1 to 2 pedal presses after engine shutdown, the vacuum reservoir is exhausted, requiring up to 400% more physical foot pressure to stop the vehicle.
3. **Loss of Lighting & Collision Hazards**: Improper relay cuts can interrupt headlight and hazard flasher circuits at night, leaving the vehicle invisible to following highway traffic.
4. **Starter Circuit Interlock Standard**: Automotive electrical engineering standards mandate that vehicle immobilization be applied **exclusively to the starter motor solenoid circuit** or through a certified OEM CAN-bus immobilizer handshake that prevents the engine from **cranking after being keyed off**, rather than killing a running engine in traffic.

---

## 2. FleetGuard 5-Stage Moving-Vehicle Safety Interlock

FleetGuard implements an autonomous safety interlock both at the backend ingestion layer and in the embedded ESP32 firmware:

```
[ Operator Requests Immobilize ]
               |
               v
  Status: REQUESTED (Enters Audit Queue)
               |
               v
  ESP32 Polls Command over Cellular
               |
               v
  Status: DELIVERED
               |
               v
  ESP32 Checks Current GPS Speed
         /           \
        /             \
[ Speed > 5 km/h ]    [ Speed <= 5 km/h ]
       |                       |
       v                       v
Safety Hold:             Actuate Relay
Send Interim ACK         Send Final Completion ACK
Wait for Full Stop             |
       |                       v
       +---------------> Status: COMPLETED
```

### Automotive Fail-Safe Rules:
- **Default Untriggered State**: The ESP32 firmware initializes `GPIO23` to the normal closed circuit state immediately upon boot to prevent vehicle stall if the tracker restarts or browns out.
- **Speed Verification**: The firmware explicitly inspects `TinyGPSPlus::speed::kmph()`. If velocity exceeds `5.0 km/h`, physical relay actuation is aborted and queued.
- **Operator Audit Trail**: All requests record the operator ID, justification reason, IP address, and vehicle speed at the moment of request.
