import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import type { RentalOrder, Vehicle } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import {
  FileText,
  Plus,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  User,
  Phone,
  RefreshCw
} from 'lucide-react';

export const RentalsPage: React.FC = () => {
  const [rentals, setRentals] = useState<RentalOrder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [vehicleId, setVehicleId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [startDateTime, setStartDateTime] = useState(new Date().toISOString().slice(0, 16));
  const [expectedReturnDateTime, setExpectedReturnDateTime] = useState(
    new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [destinationAddress, setDestinationAddress] = useState('Palo Alto Tech Campus, CA');
  const [destinationLatitude, setDestinationLatitude] = useState('37.4419');
  const [destinationLongitude, setDestinationLongitude] = useState('-122.1430');
  const [allowedDistanceKm, setAllowedDistanceKm] = useState('200');
  const [geofenceRadiusKm, setGeofenceRadiusKm] = useState('20');
  const [speedLimitKmH, setSpeedLimitKmH] = useState('85');

  const loadRentals = async () => {
    try {
      const [rList, vList] = await Promise.all([
        api.getRentals(),
        api.getVehicles()
      ]);
      setRentals(rList);
      setVehicles(vList);
      if (vList.length > 0 && !vehicleId) {
        setVehicleId(vList[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRentals();
  }, []);

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const created = await api.createRental({
        vehicleId,
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        startDateTime,
        expectedReturnDateTime,
        destinationAddress,
        destinationLatitude: parseFloat(destinationLatitude),
        destinationLongitude: parseFloat(destinationLongitude),
        allowedDistanceKm: parseFloat(allowedDistanceKm),
        geofenceRadiusKm: parseFloat(geofenceRadiusKm),
        speedLimitKmH: parseFloat(speedLimitKmH)
      });

      setRentals((prev) => [created, ...prev]);
      setIsModalOpen(false);
      // Reset
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteRental = async (id: string) => {
    if (!confirm('Are you sure you want to complete and close this rental order?')) return;
    try {
      const updated = await api.completeRental(id);
      setRentals((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err: any) {
      alert(`Error completing rental: ${err.message}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileText size={26} color="var(--accent-cyan)" />
            Rental Fleet Orders & Geofencing
          </h1>
          <p className="page-subtitle">
            Contract limits, distance allowances, destination boundaries, and customer records
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={loadRentals} className="btn btn-secondary">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> New Rental Contract
          </button>
        </div>
      </div>

      {/* Rentals Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Status</th>
              <th>Vehicle</th>
              <th>Renter Information</th>
              <th>Destination Geofence</th>
              <th>Distance Travelled</th>
              <th>Return Deadline</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rentals.map((r) => {
              const distanceRatio = (r.totalDistanceTravelledKm / r.allowedDistanceKm) * 100;
              const isExceeded = r.totalDistanceTravelledKm > r.allowedDistanceKm;

              return (
                <tr key={r.id}>
                  <td>
                    <span className="mono" style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>
                      {r.orderNumber}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <strong>{r.vehicle?.plateNumber}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {r.vehicle?.make} {r.vehicle?.model}
                    </div>
                  </td>
                  <td>
                    <div>{r.customerName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {r.customerPhone}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={14} color="var(--accent-amber)" />
                      <span>{r.destinationAddress}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Radius: {r.geofenceRadiusKm || 15} km
                    </span>
                  </td>
                  <td>
                    <div className="mono" style={{ fontWeight: 700, color: isExceeded ? 'var(--accent-rose)' : 'inherit' }}>
                      {r.totalDistanceTravelledKm.toFixed(1)} / {r.allowedDistanceKm} km
                    </div>
                    {/* Visual Progress Bar */}
                    <div
                      style={{
                        width: '100%',
                        height: '4px',
                        background: 'var(--border-subtle)',
                        borderRadius: '2px',
                        marginTop: '0.3rem',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, distanceRatio)}%`,
                          background: isExceeded ? 'var(--accent-rose)' : 'var(--accent-cyan)',
                          transition: 'width 300ms ease'
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {new Date(r.expectedReturnDateTime).toLocaleString()}
                  </td>
                  <td>
                    {r.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleCompleteRental(r.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ borderColor: 'var(--accent-emerald)', color: 'var(--accent-emerald)' }}
                      >
                        <CheckCircle2 size={14} /> End Rental
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New Rental Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Vehicle Rental Contract"
        maxWidth="640px"
      >
        <form onSubmit={handleCreateRental}>
          {errorMsg && (
            <div style={{ padding: '0.75rem', background: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-md)', color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {errorMsg}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Assign Vehicle *</label>
            <select
              className="form-select"
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} ({v.make} {v.model}) - Status: {v.status}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Customer Full Name *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Alexander Wright"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Customer Phone *</label>
              <input
                type="tel"
                required
                className="form-input"
                placeholder="+1 (555) 234-5678"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Start Date & Time *</label>
              <input
                type="datetime-local"
                required
                className="form-input"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Return *</label>
              <input
                type="datetime-local"
                required
                className="form-input"
                value={expectedReturnDateTime}
                onChange={(e) => setExpectedReturnDateTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Destination Area Address *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Silicon Valley Technology Corridor"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Allowed Distance (km) *</label>
              <input
                type="number"
                required
                className="form-input"
                value={allowedDistanceKm}
                onChange={(e) => setAllowedDistanceKm(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Geofence Radius (km)</label>
              <input
                type="number"
                className="form-input"
                value={geofenceRadiusKm}
                onChange={(e) => setGeofenceRadiusKm(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Speed Limit (km/h)</label>
              <input
                type="number"
                className="form-input"
                value={speedLimitKmH}
                onChange={(e) => setSpeedLimitKmH(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Creating...' : 'Initialize Rental'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
