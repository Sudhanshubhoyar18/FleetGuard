import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import type { UnifiedHistoryEvent, Vehicle } from '../types/index.js';
import {
  History,
  Download,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  Lock,
  AlertTriangle,
  Compass,
  FileText
} from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const [events, setEvents] = useState<UnifiedHistoryEvent[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [eventType, setEventType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [vList, historyRes] = await Promise.all([
        api.getVehicles(),
        api.getHistory({
          vehicleId: vehicleId || undefined,
          eventType: eventType || undefined,
          search: search || undefined,
          page,
          limit: 20
        })
      ]);
      setVehicles(vList);
      setEvents(historyRes.data);
      setTotalPages(historyRes.pagination.totalPages);
      setTotalItems(historyRes.pagination.totalItems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [page, vehicleId, eventType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadHistory();
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'IMMOBILIZER':
        return <Lock size={16} color="var(--accent-rose)" />;
      case 'SPEED_ALERT':
        return <AlertTriangle size={16} color="var(--accent-amber)" />;
      case 'TRIP':
        return <Compass size={16} color="var(--accent-cyan)" />;
      case 'RENTAL_EVENT':
        return <FileText size={16} color="var(--accent-purple)" />;
      default:
        return <MapPin size={16} color="var(--accent-blue)" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="badge badge-alert">CRITICAL</span>;
      case 'WARNING':
        return <span className="badge badge-warning">WARNING</span>;
      default:
        return <span className="badge badge-cyan">INFO</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <History size={26} color="var(--accent-cyan)" />
            Unified Vehicle Audit & Event History
          </h1>
          <p className="page-subtitle">
            Comprehensive audit trail of telemetry, trips, safety commands, and violations
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a
            href={api.getHistoryExportUrl(vehicleId || undefined)}
            download
            className="btn btn-secondary"
          >
            <Download size={16} /> Export to CSV
          </a>
          <button onClick={loadHistory} className="btn btn-primary">
            <RefreshCw size={16} /> Sync History
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.4rem' }}
              placeholder="Filter by description, keyword, or license plate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">
            Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            className="form-select"
            style={{ width: '190px' }}
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Fleet Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            style={{ width: '170px' }}
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Event Categories</option>
            <option value="SPEED_ALERT">Speed Violations</option>
            <option value="TRIP">Trip Sessions</option>
            <option value="IMMOBILIZER">Immobilizer Actions</option>
            <option value="RENTAL_EVENT">Rental Milestones</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Event Category</th>
              <th>Vehicle</th>
              <th>Details & Notes</th>
              <th>GPS Coordinates</th>
              <th>Severity</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No historical records match your filter criteria.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
                      {getEventIcon(e.eventType)}
                      <span>{e.eventType}</span>
                    </div>
                  </td>
                  <td>
                    <span className="mono" style={{ fontWeight: 700 }}>{e.plateNumber || 'N/A'}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{e.description}</div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {e.latitude && e.longitude ? (
                      <span className="mono">
                        {e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
                  </td>
                  <td>{getSeverityBadge(e.severity)}</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '1.25rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)'
        }}
      >
        <span>
          Showing page {page} of {Math.max(1, totalPages)} ({totalItems} total logged events)
        </span>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn btn-secondary btn-sm"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn btn-secondary btn-sm"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
