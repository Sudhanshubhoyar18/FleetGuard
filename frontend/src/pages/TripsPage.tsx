import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import type { Trip, Vehicle } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import {
  Compass,
  Plus,
  Route,
  Clock,
  Gauge,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export const TripsPage: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTrips = async () => {
    try {
      const [tList, vList] = await Promise.all([
        api.getTrips(),
        api.getVehicles()
      ]);
      setTrips(tList);
      setVehicles(vList);
      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const newTrip = await api.startTrip({ vehicleId: selectedVehicleId });
      setTrips((prev) => [newTrip, ...prev]);
      setIsStartModalOpen(false);
    } catch (err: any) {
      alert(`Error starting trip: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndTrip = async (id: string) => {
    try {
      const ended = await api.endTrip(id);
      setTrips((prev) => prev.map((t) => (t.id === id ? ended : t)));
    } catch (err: any) {
      alert(`Error ending trip: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Compass size={26} color="var(--accent-cyan)" />
            Vehicle Trip Telemetry Logs
          </h1>
          <p className="page-subtitle">
            Historical driving sessions, point count, Haversine distance, and velocity metrics
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={loadTrips} className="btn btn-secondary">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => setIsStartModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Start New Trip
          </button>
        </div>
      </div>

      {/* Trips Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Distance (Haversine)</th>
              <th>Speed (Avg / Max)</th>
              <th>GPS Points</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong className="mono">{t.vehicle?.plateNumber || 'Vehicle'}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t.vehicle?.make} {t.vehicle?.model}
                  </div>
                </td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  {new Date(t.startTime).toLocaleString()}
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  {t.endTime ? new Date(t.endTime).toLocaleString() : <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>In Progress</span>}
                </td>
                <td>
                  <span className="mono" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                    {t.totalDistanceKm.toFixed(2)} km
                  </span>
                </td>
                <td>
                  <span className="mono">
                    {t.averageSpeedKmH.toFixed(1)} / {t.maxSpeedKmH.toFixed(1)} km/h
                  </span>
                </td>
                <td>
                  <span className="badge badge-purple">{t.pointCount} fixes</span>
                </td>
                <td>
                  {t.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleEndTrip(t.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}
                    >
                      <CheckCircle2 size={14} /> End Trip
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Start Trip Modal */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        title="Start Vehicle Driving Session"
      >
        <form onSubmit={handleStartTrip}>
          <div className="form-group">
            <label className="form-label">Select Vehicle *</label>
            <select
              className="form-select"
              required
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

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Starting a session will associate incoming GPS fixes and compute distance travelled using Great-Circle Haversine calculations.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={() => setIsStartModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Starting...' : 'Initiate Session'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
