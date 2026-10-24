import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import type { SpeedAlert } from '../types/index.js';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Clock,
  Gauge,
  Filter,
  RefreshCw
} from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<SpeedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAcknowledged, setFilterAcknowledged] = useState<string>('all');

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleAcknowledge = async (id: string) => {
    try {
      const updated = await api.acknowledgeAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err: any) {
      alert(`Error acknowledging alert: ${err.message}`);
    }
  };

  const filtered = alerts.filter((a) => {
    if (filterAcknowledged === 'pending') return !a.isAcknowledged;
    if (filterAcknowledged === 'acknowledged') return a.isAcknowledged;
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <AlertTriangle size={26} color="var(--accent-rose)" />
            Speed Violation Monitoring
          </h1>
          <p className="page-subtitle">
            Autonomous GPS speed threshold triggers, cooldown windows, and audit records
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={loadAlerts} className="btn btn-secondary">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setFilterAcknowledged('all')}
          className={`btn ${filterAcknowledged === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
        >
          All Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setFilterAcknowledged('pending')}
          className={`btn ${filterAcknowledged === 'pending' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
        >
          Pending Review ({alerts.filter((a) => !a.isAcknowledged).length})
        </button>
        <button
          onClick={() => setFilterAcknowledged('acknowledged')}
          className={`btn ${filterAcknowledged === 'acknowledged' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
        >
          Acknowledged ({alerts.filter((a) => a.isAcknowledged).length})
        </button>
      </div>

      {/* Alerts Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Speed Recorded</th>
              <th>Configured Limit</th>
              <th>GPS Coordinates</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong className="mono">{a.vehicle?.plateNumber || 'Vehicle'}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {a.vehicle?.make} {a.vehicle?.model}
                  </div>
                </td>
                <td>
                  <span className="mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-rose)' }}>
                    {a.speedRecordedKmH} km/h
                  </span>
                </td>
                <td>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {a.speedLimitKmH} km/h
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={14} color="var(--accent-cyan)" />
                    <span className="mono">{a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}</span>
                  </div>
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  {new Date(a.timestamp).toLocaleString()}
                </td>
                <td>
                  {a.isAcknowledged ? (
                    <span className="badge badge-online">
                      ACK BY {a.acknowledgedBy || 'OPERATOR'}
                    </span>
                  ) : (
                    <span className="badge badge-alert">PENDING REVIEW</span>
                  )}
                </td>
                <td>
                  {!a.isAcknowledged && (
                    <button
                      onClick={() => handleAcknowledge(a.id)}
                      className="btn btn-secondary btn-sm"
                      style={{ borderColor: 'var(--accent-emerald)', color: 'var(--accent-emerald)' }}
                    >
                      <CheckCircle2 size={14} /> Acknowledge
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
