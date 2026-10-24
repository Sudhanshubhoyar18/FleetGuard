import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { wsClient } from '../services/websocket.js';
import type { Vehicle, Trip } from '../types/index.js';
import { MapComponent } from '../components/MapComponent.js';
import { StatusBadge } from '../components/StatusBadge.js';
import {
  Navigation,
  Gauge,
  Compass,
  MapPin,
  Clock,
  Radio,
  Car,
  Target,
  ShieldAlert
} from 'lucide-react';

export const LiveTrackingPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [tripHistory, setTripHistory] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const vList = await api.getVehicles();
        setVehicles(vList);
        if (vList.length > 0) {
          setSelectedVehicleId(vList[0].id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();

    // Stream live telemetry updates
    const unsub = wsClient.on('TELEMETRY_UPDATE', (data: any) => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id === data.vehicleId) {
            return {
              ...v,
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
            };
          }
          return v;
        })
      );

      // Append point to active trip path if currently tracking this vehicle
      if (data.vehicleId === selectedVehicleId) {
        setTripHistory((prev) => [...prev, { latitude: data.latitude, longitude: data.longitude }]);
      }
    });

    return () => {
      unsub();
    };
  }, [selectedVehicleId]);

  // Load historical points when vehicle selection changes
  useEffect(() => {
    if (!selectedVehicleId) return;

    api.getVehicleHistory(selectedVehicleId, 100)
      .then((history) => {
        setTripHistory(history.map((h) => ({ latitude: h.latitude, longitude: h.longitude })));
      })
      .catch(() => setTripHistory([]));
  }, [selectedVehicleId]);

  const currentVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  const loc = currentVehicle?.latestLocation;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Navigation size={26} color="var(--accent-cyan)" />
            Live GPS Tracking & Telemetry Radar
          </h1>
          <p className="page-subtitle">
            Sub-second vehicle telemetry, heading rotation, and geofence tracking
          </p>
        </div>

        {/* Vehicle Quick Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Select Vehicle:
          </span>
          <select
            className="form-select"
            style={{ width: '220px', fontWeight: 700 }}
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber} ({v.make} {v.model})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Full-Height Live Tracking Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* Map Viewport */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <MapComponent
            location={loc}
            plateNumber={currentVehicle?.plateNumber}
            isOnline={currentVehicle?.isOnline}
            tripPath={tripHistory}
            destination={
              currentVehicle?.activeRental?.destinationLatitude && currentVehicle?.activeRental?.destinationLongitude
                ? {
                    latitude: currentVehicle.activeRental.destinationLatitude,
                    longitude: currentVehicle.activeRental.destinationLongitude,
                    address: currentVehicle.activeRental.destinationAddress,
                    radiusKm: currentVehicle.activeRental.geofenceRadiusKm || 15
                  }
                : null
            }
            height="620px"
          />
        </div>

        {/* Live Vehicle Telemetry Gauges Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Target Status Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Car size={18} color="var(--accent-cyan)" />
                Vehicle State
              </span>
              <StatusBadge status={currentVehicle?.isOnline ? 'ONLINE' : 'OFFLINE'} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                {currentVehicle?.plateNumber || 'No Vehicle'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {currentVehicle?.make} {currentVehicle?.model} ({currentVehicle?.year})
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Engine Immobilizer:</span>
                <StatusBadge status={currentVehicle?.immobilizerState || 'NORMAL'} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Speed Limit:</span>
                <strong className="mono">{currentVehicle?.speedLimit || 80} km/h</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Odometer:</span>
                <strong className="mono">{currentVehicle?.totalDistanceKm || 0} km</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Device:</span>
                <strong className="mono">{currentVehicle?.devices?.[0]?.deviceId || 'FG-ESP32-001'}</strong>
              </div>
            </div>
          </div>

          {/* Real-time Telemetry Metrics */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Gauge size={18} color="var(--accent-emerald)" />
                Live Sensor Telemetry
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Speed</div>
                <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
                  {loc?.speedKmH.toFixed(1) || '0.0'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>km/h</div>
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Heading</div>
                <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem' }}>
                  {loc?.headingDegrees || 0}°
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bearing</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <MapPin size={14} color="var(--accent-cyan)" />
                <span>Latitude:</span>
                <strong className="mono" style={{ color: 'var(--text-primary)' }}>{loc?.latitude.toFixed(6) || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <MapPin size={14} color="var(--accent-cyan)" />
                <span>Longitude:</span>
                <strong className="mono" style={{ color: 'var(--text-primary)' }}>{loc?.longitude.toFixed(6) || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <Clock size={14} color="var(--accent-cyan)" />
                <span>Last Fix:</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {loc?.timestamp ? new Date(loc.timestamp).toLocaleTimeString() : 'Waiting for GPS fix'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Rental Destination Info (if in rental) */}
          {currentVehicle?.activeRental && (
            <div className="card" style={{ borderLeft: '3px solid var(--accent-amber)' }}>
              <div className="card-header">
                <span className="card-title">
                  <Target size={18} color="var(--accent-amber)" />
                  Contract Geofence
                </span>
                <StatusBadge status="ACTIVE" />
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {currentVehicle.activeRental.destinationAddress}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Renter: {currentVehicle.activeRental.customerName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Permitted Radius: {currentVehicle.activeRental.geofenceRadiusKm || 15} km
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
