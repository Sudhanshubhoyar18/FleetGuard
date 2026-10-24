import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import type { Vehicle } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import {
  Car,
  Plus,
  Search,
  ExternalLink,
  Shield,
  Gauge,
  Route,
  RefreshCw
} from 'lucide-react';

interface VehiclesPageProps {
  onSelectVehicle: (id: string) => void;
}

export const VehiclesPage: React.FC<VehiclesPageProps> = ({ onSelectVehicle }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [newPlate, setNewPlate] = useState('');
  const [newVin, setNewVin] = useState('');
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState('2024');
  const [newSpeedLimit, setNewSpeedLimit] = useState('80');
  const [formError, setFormError] = useState<string | null>(null);

  const loadVehicles = async () => {
    try {
      const data = await api.getVehicles();
      setVehicles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const created = await api.createVehicle({
        plateNumber: newPlate,
        vin: newVin || undefined,
        make: newMake,
        model: newModel,
        year: parseInt(newYear, 10),
        speedLimit: parseFloat(newSpeedLimit)
      });
      setVehicles((prev) => [created, ...prev]);
      setIsAddModalOpen(false);
      // Reset form
      setNewPlate('');
      setNewVin('');
      setNewMake('');
      setNewModel('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = vehicles.filter(
    (v) =>
      v.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Car size={26} color="var(--accent-cyan)" />
            Vehicle Fleet Registry
          </h1>
          <p className="page-subtitle">
            Manage tracked vehicles, assigned GPS units, and speed thresholds
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Register Vehicle
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ position: 'relative', width: '320px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Search by plate, make, or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {vehicles.length} vehicles
        </span>
      </div>

      {/* Vehicle Grid Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem'
        }}
      >
        {filtered.map((v) => (
          <div
            key={v.id}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
            onClick={() => onSelectVehicle(v.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span className="mono" style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {v.plateNumber}
              </span>
              <StatusBadge status={v.isOnline ? 'ONLINE' : 'OFFLINE'} />
            </div>

            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {v.make} {v.model} ({v.year})
            </div>
            {v.vin && (
              <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                VIN: {v.vin}
              </div>
            )}

            <div
              style={{
                marginTop: 'auto',
                paddingTop: '0.85rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                fontSize: '0.8rem'
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Speed Limit</span>
                <strong className="mono">{v.speedLimit} km/h</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Distance</span>
                <strong className="mono">{v.totalDistanceKm || 0} km</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Status</span>
                <StatusBadge status={v.status} />
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Immobilizer</span>
                <StatusBadge status={v.immobilizerState} />
              </div>
            </div>

            <div
              style={{
                marginTop: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.35rem',
                color: 'var(--accent-cyan)',
                fontSize: '0.8rem',
                fontWeight: 700
              }}
            >
              <span>View Telemetry Details</span>
              <ExternalLink size={14} />
            </div>
          </div>
        ))}
      </div>

      {/* Add Vehicle Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Fleet Vehicle"
      >
        <form onSubmit={handleCreateVehicle}>
          {formError && (
            <div style={{ padding: '0.75rem', background: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-md)', color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">License Plate Number *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. FG-9281-CA"
              value={newPlate}
              onChange={(e) => setNewPlate(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Make *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Toyota"
                value={newMake}
                onChange={(e) => setNewMake(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Model *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. RAV4"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Year *</label>
              <input
                type="number"
                required
                className="form-input"
                placeholder="2024"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Speed Limit (km/h) *</label>
              <input
                type="number"
                required
                className="form-input"
                placeholder="80"
                value={newSpeedLimit}
                onChange={(e) => setNewSpeedLimit(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Vehicle Identification Number (VIN)</label>
            <input
              type="text"
              className="form-input"
              placeholder="17-character VIN"
              value={newVin}
              onChange={(e) => setNewVin(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? 'Registering...' : 'Save Vehicle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
