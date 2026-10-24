import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { wsClient } from '../services/websocket.js';
import type { Vehicle, SpeedAlert, RentalOrder, NotificationItem } from '../types/index.js';
import { StatCard } from '../components/StatCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { MapComponent } from '../components/MapComponent.js';
import {
  Car,
  Radio,
  WifiOff,
  Compass,
  FileText,
  Route,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (path: string, param?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<SpeedAlert[]>([]);
  const [rentals, setRentals] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  const loadData = async () => {
    try {
      const [vList, aList, rList] = await Promise.all([
        api.getVehicles(),
        api.getAlerts(false), // unacknowledged alerts
        api.getRentals('ACTIVE')
      ]);
      setVehicles(vList);
      setAlerts(aList);
      setRentals(rList);
      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0].id);
      }
    } catch (e) {
      console.error('Failed to load dashboard statistics', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time telemetry updates to update vehicle markers live
    const unsubTelemetry = wsClient.on('TELEMETRY_UPDATE', (data: any) => {
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
    });

    const unsubAlert = wsClient.on('SPEED_ALERT', (alert: SpeedAlert) => {
      setAlerts((prev) => [alert, ...prev]);
    });

    return () => {
      unsubTelemetry();
      unsubAlert();
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalVehicles = vehicles.length;
  const onlineDevices = vehicles.filter((v) => v.isOnline).length;
  const offlineDevices = totalVehicles - onlineDevices;
  const activeRentalsCount = rentals.length;
  const activeTripsCount = vehicles.filter((v) => v.currentTripId).length;
  const totalDistance = vehicles.reduce((sum, v) => sum + (v.totalDistanceKm || 0), 0);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ShieldCheck size={26} color="var(--accent-cyan)" />
            Fleet Operations Hub
          </h1>
          <p className="page-subtitle">
            Real-time IoT vehicle telemetry, geofence monitoring, and fleet status
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleRefresh}
            className="btn btn-secondary"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Updating...' : 'Sync Fleet'}
          </button>
          <button
            onClick={() => onNavigate('/tracking')}
            className="btn btn-primary"
          >
            Live Tracking Radar
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* 8 Core Metric Cards */}
      <div className="grid-cols-4">
        <StatCard
          title="Total Vehicles"
          value={totalVehicles}
          subtext="Registered in fleet"
          icon={Car}
          variant="cyan"
        />
        <StatCard
          title="Devices Online"
          value={onlineDevices}
          subtext="Active cellular heartbeat"
          icon={Radio}
          variant="emerald"
        />
        <StatCard
          title="Devices Offline"
          value={offlineDevices}
          subtext="Exceeded heartbeat TTL"
          icon={WifiOff}
          variant={offlineDevices > 0 ? 'amber' : 'cyan'}
        />
        <StatCard
          title="Active Rentals"
          value={activeRentalsCount}
          subtext="Customers on the road"
          icon={FileText}
          variant="purple"
        />
        <StatCard
          title="Active Trips"
          value={activeTripsCount}
          subtext="Vehicles currently moving"
          icon={Compass}
          variant="cyan"
        />
        <StatCard
          title="Total Travelled"
          value={`${totalDistance.toFixed(1)} km`}
          subtext="Verified GPS Haversine"
          icon={Route}
          variant="emerald"
        />
        <StatCard
          title="Speed Alerts"
          value={alerts.length}
          subtext="Pending review"
          icon={AlertTriangle}
          variant={alerts.length > 0 ? 'rose' : 'cyan'}
        />
        <StatCard
          title="Cellular Modem"
          value="SIM800L"
          subtext="2G GPRS + TinyGPSPlus"
          icon={Radio}
          variant="cyan"
        />
      </div>

      {/* Main Section: Interactive Live Map & Vehicle Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', marginBottom: '1.75rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="card-header">
            <span className="card-title">
              <Compass size={18} color="var(--accent-cyan)" />
              Live Vehicle Radar & Telemetry Feed
            </span>
            {selectedVehicle && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target: <strong style={{ color: 'var(--text-primary)' }}>{selectedVehicle.plateNumber}</strong> ({selectedVehicle.make} {selectedVehicle.model})
              </span>
            )}
          </div>

          <MapComponent
            location={selectedVehicle?.latestLocation}
            plateNumber={selectedVehicle?.plateNumber}
            isOnline={selectedVehicle?.isOnline}
            destination={
              selectedVehicle?.activeRental?.destinationLatitude && selectedVehicle?.activeRental?.destinationLongitude
                ? {
                    latitude: selectedVehicle.activeRental.destinationLatitude,
                    longitude: selectedVehicle.activeRental.destinationLongitude,
                    address: selectedVehicle.activeRental.destinationAddress,
                    radiusKm: selectedVehicle.activeRental.geofenceRadiusKm || 15
                  }
                : null
            }
            height="460px"
          />
        </div>

        {/* Vehicle Selection List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <span className="card-title">
              <Car size={18} color="var(--accent-cyan)" />
              Monitored Vehicles
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {vehicles.length} units
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1 }}>
            {vehicles.map((v) => {
              const isSelected = v.id === selectedVehicleId;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicleId(v.id)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'var(--accent-cyan-glow)' : 'var(--bg-secondary)',
                    border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{v.plateNumber}</span>
                    <StatusBadge status={v.isOnline ? 'ONLINE' : 'OFFLINE'} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {v.make} {v.model} ({v.year})
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    <span>Speed: {v.latestLocation?.speedKmH.toFixed(1) || '0.0'} km/h</span>
                    <span>{v.totalDistanceKm || 0} km</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: Active Speed Alerts & Active Rentals Table */}
      <div className="grid-cols-2">
        {/* Active Speed Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <AlertTriangle size={18} color="var(--accent-rose)" />
              Recent Speed Limit Events
            </span>
            <button
              onClick={() => onNavigate('/alerts')}
              className="btn btn-secondary btn-sm"
            >
              View All Alerts
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="empty-state">
              <ShieldCheck className="empty-state-icon" style={{ color: 'var(--accent-emerald)' }} />
              <h4>All Vehicles Within Speed Limits</h4>
              <p>No recent overspeed violations recorded.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Speed</th>
                    <th>Limit</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.slice(0, 5).map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 700 }}>{a.vehicle?.plateNumber || 'Vehicle'}</td>
                      <td className="mono" style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>
                        {a.speedRecordedKmH} km/h
                      </td>
                      <td className="mono">{a.speedLimitKmH} km/h</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Active Rental Checkouts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <FileText size={18} color="var(--accent-purple)" />
              Active Rental Contracts
            </span>
            <button
              onClick={() => onNavigate('/rentals')}
              className="btn btn-secondary btn-sm"
            >
              Manage Rentals
            </button>
          </div>

          {rentals.length === 0 ? (
            <div className="empty-state">
              <FileText className="empty-state-icon" />
              <h4>No Active Rental Orders</h4>
              <p>All fleet vehicles are currently idle at hub.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Destination</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {rentals.slice(0, 5).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{r.orderNumber}</td>
                      <td>{r.customerName}</td>
                      <td style={{ fontSize: '0.8rem' }}>{r.destinationAddress}</td>
                      <td className="mono">
                        {r.totalDistanceTravelledKm.toFixed(1)} / {r.allowedDistanceKm} km
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
