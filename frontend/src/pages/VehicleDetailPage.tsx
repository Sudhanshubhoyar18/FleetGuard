import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { wsClient } from '../services/websocket.js';
import type { Vehicle, Trip, SpeedAlert } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { MapComponent } from '../components/MapComponent.js';
import {
  Car,
  ArrowLeft,
  Navigation,
  Gauge,
  MapPin,
  Clock,
  Compass,
  AlertTriangle,
  Lock,
  Route,
  Cpu
} from 'lucide-react';

interface VehicleDetailPageProps {
  vehicleId: string;
  onBack: () => void;
  onNavigateToImmobilizer: () => void;
}

export const VehicleDetailPage: React.FC<VehicleDetailPageProps> = ({
  vehicleId,
  onBack,
  onNavigateToImmobilizer
}) => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [alerts, setAlerts] = useState<SpeedAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVehicleData() {
      try {
        const [v, tList, aList] = await Promise.all([
          api.getVehicleById(vehicleId),
          api.getTrips(vehicleId),
          api.getAlerts()
        ]);
        setVehicle(v);
        setTrips(tList);
        setAlerts(aList.filter((a) => a.vehicleId === vehicleId));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadVehicleData();

    // Listen to live updates for this specific vehicle
    const unsub = wsClient.on('TELEMETRY_UPDATE', (data: any) => {
      if (data.vehicleId === vehicleId) {
        setVehicle((prev) =>
          prev
            ? {
                ...prev,
                isOnline: true,
                latestLocation: {
                  latitude: data.latitude,
                  longitude: data.longitude,
                  speedKmH: data.speedKmH,
                  headingDegrees: data.headingDegrees,
                  timestamp: data.timestamp,
                  isSimulated: data.isSimulated,
                  isStale: false
                }
              }
            : null
        );
      }
    });

    return () => unsub();
  }, [vehicleId]);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading vehicle telemetry...</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="page-container">
        <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> Back to Vehicles
        </button>
        <div className="card empty-state">
          <h3>Vehicle Not Found</h3>
        </div>
      </div>
    );
  }

  const loc = vehicle.latestLocation;

  return (
    <div className="page-container">
      {/* Back button & Title */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ marginBottom: '0.75rem' }}>
          <ArrowLeft size={14} /> Back to Fleet Registry
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="page-title mono" style={{ fontSize: '1.8rem' }}>{vehicle.plateNumber}</h1>
              <StatusBadge status={vehicle.isOnline ? 'ONLINE' : 'OFFLINE'} />
              <StatusBadge status={vehicle.status} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              {vehicle.make} {vehicle.model} • Year {vehicle.year} {vehicle.vin ? `• VIN: ${vehicle.vin}` : ''}
            </p>
          </div>

          <button
            onClick={onNavigateToImmobilizer}
            className="btn btn-danger"
          >
            <Lock size={16} />
            Immobilizer Safety Controls
          </button>
        </div>
      </div>

      {/* Main Grid: Map & Live Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Map */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <MapComponent
            location={loc}
            plateNumber={vehicle.plateNumber}
            isOnline={vehicle.isOnline}
            destination={
              vehicle.activeRental?.destinationLatitude && vehicle.activeRental?.destinationLongitude
                ? {
                    latitude: vehicle.activeRental.destinationLatitude,
                    longitude: vehicle.activeRental.destinationLongitude,
                    address: vehicle.activeRental.destinationAddress,
                    radiusKm: vehicle.activeRental.geofenceRadiusKm || 15
                  }
                : null
            }
            height="460px"
          />
        </div>

        {/* Telemetry Summary Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Gauge size={18} color="var(--accent-cyan)" />
                Current Sensor Fix
              </span>
              <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {loc?.speedKmH.toFixed(1) || '0.0'} km/h
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Coordinates:</span>
                <strong className="mono">{loc?.latitude.toFixed(5) || 'N/A'}, {loc?.longitude.toFixed(5) || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Heading:</span>
                <strong className="mono">{loc?.headingDegrees || 0}°</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Speed Limit:</span>
                <strong className="mono">{vehicle.speedLimit} km/h</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Last Fix Timestamp:</span>
                <span>{loc?.timestamp ? new Date(loc.timestamp).toLocaleTimeString() : 'No GPS Fix'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Data Status:</span>
                <span>{loc?.isStale ? <span style={{ color: 'var(--accent-amber)' }}>Stale GPS (&gt; 5m)</span> : <span style={{ color: 'var(--accent-emerald)' }}>Live GPS Fix</span>}</span>
              </div>
            </div>
          </div>

          {/* Assigned IoT Hardware */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Cpu size={18} color="var(--accent-purple)" />
                Assigned Tracker Unit
              </span>
              <StatusBadge status={vehicle.devices?.[0]?.isOnline ? 'ONLINE' : 'OFFLINE'} />
            </div>

            {vehicle.devices && vehicle.devices.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Device ID:</span>
                  <strong className="mono">{vehicle.devices[0].deviceId}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Modem:</span>
                  <span>{vehicle.devices[0].model}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Firmware:</span>
                  <span className="mono">v{vehicle.devices[0].firmwareVersion}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Signal Quality:</span>
                  <span className="mono">{vehicle.devices[0].cellularSignalRssi || -70} dBm</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No physical IoT tracker paired with this vehicle.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Trips & Alerts Tables */}
      <div className="grid-cols-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Compass size={18} color="var(--accent-cyan)" />
              Recorded Trips
            </span>
          </div>

          {trips.length === 0 ? (
            <div className="empty-state">
              <Route className="empty-state-icon" />
              <p>No trips recorded for this vehicle yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Start Time</th>
                    <th>Distance</th>
                    <th>Max Speed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(t.startTime).toLocaleString()}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{t.totalDistanceKm.toFixed(2)} km</td>
                      <td className="mono">{t.maxSpeedKmH} km/h</td>
                      <td><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <AlertTriangle size={18} color="var(--accent-rose)" />
              Speed Violations
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="empty-state">
              <p>No speed limit violations recorded.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Speed</th>
                    <th>Limit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(a.timestamp).toLocaleString()}</td>
                      <td className="mono" style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>
                        {a.speedRecordedKmH} km/h
                      </td>
                      <td className="mono">{a.speedLimitKmH} km/h</td>
                      <td>
                        {a.isAcknowledged ? (
                          <span className="badge badge-online">ACKNOWLEDGED</span>
                        ) : (
                          <span className="badge badge-alert">PENDING</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
