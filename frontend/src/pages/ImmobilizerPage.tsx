import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { wsClient } from '../services/websocket.js';
import type { Vehicle, ImmobilizerCommand } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import {
  Lock,
  Unlock,
  AlertOctagon,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Gauge,
  AlertTriangle,
  RefreshCw,
  Info
} from 'lucide-react';

export const ImmobilizerPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [vehicleStatus, setVehicleStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Command Action Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [commandTypeToSubmit, setCommandTypeToSubmit] = useState<'IMMOBILIZE' | 'RESTORE'>('IMMOBILIZE');
  const [justificationReason, setJustificationReason] = useState('');
  const [isSimulationMode, setIsSimulationMode] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const loadData = async () => {
    try {
      const vList = await api.getVehicles();
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
    loadData();
  }, []);

  // Fetch immobilizer status for selected vehicle
  const loadImmobilizerStatus = async () => {
    if (!selectedVehicleId) return;
    try {
      const status = await api.getImmobilizerStatus(selectedVehicleId);
      setVehicleStatus(status);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadImmobilizerStatus();

    // Listen to real-time status transitions over WebSocket
    const unsub = wsClient.on('IMMOBILIZER_STATUS', (data: any) => {
      if (data.vehicleId === selectedVehicleId) {
        loadImmobilizerStatus();
      }
    });

    return () => unsub();
  }, [selectedVehicleId]);

  const handleOpenCommandModal = (type: 'IMMOBILIZE' | 'RESTORE') => {
    setCommandTypeToSubmit(type);
    setJustificationReason('');
    setSubmissionResult(null);
    setIsConfirmModalOpen(true);
  };

  const handleSubmitCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificationReason.trim()) {
      alert('A specific justification reason is mandatory for engine safety commands.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.submitImmobilizerCommand({
        vehicleId: selectedVehicleId,
        commandType: commandTypeToSubmit,
        reason: justificationReason,
        isSimulated: isSimulationMode
      });

      setSubmissionResult(result);
      loadImmobilizerStatus();
      // Re-sync vehicle list state
      api.getVehicles().then((vList) => setVehicles(vList));
    } catch (err: any) {
      alert(`Error submitting command: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  const currentSpeed = vehicleStatus?.currentSpeedKmH || 0;
  const isMovingUnsafe = currentSpeed > 5.0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Lock size={26} color="var(--accent-rose)" />
            Safe Vehicle Immobilization Management
          </h1>
          <p className="page-subtitle">
            Controlled ignition circuit cut-off, moving-vehicle safety interlocks, and cryptographic acknowledgments
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={loadImmobilizerStatus} className="btn btn-secondary">
            <RefreshCw size={16} /> Refresh State
          </button>
        </div>
      </div>

      {/* Mandatory Automotive Safety Banner */}
      <div
        style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem'
        }}
      >
        <AlertOctagon size={24} color="var(--accent-rose)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ color: 'var(--accent-rose)', marginBottom: '0.25rem', fontSize: '0.95rem' }}>
            CRITICAL AUTOMOTIVE SAFETY PROTOCOL ENFORCED
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            To prevent fatal traffic hazards, power steering failure, or brake vacuum loss, FleetGuard firmware enforces an autonomous moving-vehicle interlock.
            If a vehicle is traveling at &gt; 5.0 km/h, the immobilizer command is securely held in status <code>REQUESTED</code> and will only actuate once the vehicle has decelerated to a complete safe stop.
          </p>
        </div>
      </div>

      {/* Vehicle Selector and State Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', marginBottom: '1.75rem' }}>
        {/* Current State & Action Control */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <ShieldAlert size={18} color="var(--accent-cyan)" />
              Actuation Control & Safety Verification
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Vehicle Physical Status
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.2rem' }}>
                {selectedVehicle?.plateNumber}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {selectedVehicle?.make} {selectedVehicle?.model} ({selectedVehicle?.year})
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                Relay / Circuit State
              </span>
              <StatusBadge status={vehicleStatus?.immobilizerState || selectedVehicle?.immobilizerState || 'NORMAL'} />
            </div>
          </div>

          {/* Safety Speed Guard Notice */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: isMovingUnsafe ? 'var(--accent-amber-glow)' : 'var(--accent-emerald-glow)',
              border: `1px solid ${isMovingUnsafe ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              fontSize: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Gauge size={18} color={isMovingUnsafe ? 'var(--accent-amber)' : 'var(--accent-emerald)'} />
              <span>
                Vehicle Telemetry Velocity: <strong className="mono">{currentSpeed.toFixed(1)} km/h</strong>
              </span>
            </div>
            <span style={{ fontWeight: 700, color: isMovingUnsafe ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
              {isMovingUnsafe ? '⚠️ MOVING (SAFETY HOLD ACTIVE)' : '✅ SAFE TO ACTUATE (STATIONARY)'}
            </span>
          </div>

          {/* Action Trigger Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => handleOpenCommandModal('IMMOBILIZE')}
              className="btn btn-danger"
              style={{ flex: 1, padding: '0.85rem' }}
              disabled={selectedVehicle?.immobilizerState === 'IMMOBILIZED'}
            >
              <Lock size={18} />
              Request Vehicle Immobilization
            </button>

            <button
              onClick={() => handleOpenCommandModal('RESTORE')}
              className="btn btn-primary"
              style={{ flex: 1, padding: '0.85rem' }}
              disabled={selectedVehicle?.immobilizerState === 'NORMAL'}
            >
              <Unlock size={18} />
              Restore Normal Ignition Circuit
            </button>
          </div>
        </div>

        {/* 5-Stage Command Lifecycle Guide */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Info size={18} color="var(--accent-cyan)" />
              5-Stage Command Lifecycle
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>1. REQUESTED</div>
              <p style={{ color: 'var(--text-muted)' }}>Operator submitted command with audit justification. Placed into secure queue.</p>
            </div>
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-purple)' }}>2. DELIVERED</div>
              <p style={{ color: 'var(--text-muted)' }}>ESP32 device polled server over cellular and successfully received payload.</p>
            </div>
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>3. ACKNOWLEDGED</div>
              <p style={{ color: 'var(--text-muted)' }}>Device verified speed. If moving, holds safely until 0 km/h stop.</p>
            </div>
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>4. COMPLETED</div>
              <p style={{ color: 'var(--text-muted)' }}>Relay physically cut or restored. Cryptographic confirmation returned.</p>
            </div>
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>5. FAILED / EXPIRED</div>
              <p style={{ color: 'var(--text-muted)' }}>Command timed out (&gt; 15m) or device rejected due to hardware fault.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Command Audit Log History Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Clock size={18} color="var(--accent-cyan)" />
            Immobilizer Command Audit Trail
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Cryptographically signed & operator tracked
          </span>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Command ID</th>
                <th>Action</th>
                <th>Lifecycle Status</th>
                <th>Justification Reason</th>
                <th>Requested At</th>
                <th>Acknowledged At</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {(!vehicleStatus?.recentCommands || vehicleStatus.recentCommands.length === 0) ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No immobilization commands issued for this vehicle.
                  </td>
                </tr>
              ) : (
                vehicleStatus.recentCommands.map((cmd: ImmobilizerCommand) => (
                  <tr key={cmd.id}>
                    <td>
                      <span className="mono" style={{ fontSize: '0.75rem' }}>{cmd.id.slice(0, 8)}...</span>
                    </td>
                    <td>
                      <strong style={{ color: cmd.commandType === 'IMMOBILIZE' ? 'var(--accent-rose)' : 'var(--accent-cyan)' }}>
                        {cmd.commandType}
                      </strong>
                    </td>
                    <td>
                      <StatusBadge status={cmd.status} />
                    </td>
                    <td style={{ fontSize: '0.82rem', maxWidth: '300px' }}>
                      {cmd.reason}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {new Date(cmd.requestedAt).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {cmd.acknowledgedAt ? new Date(cmd.acknowledgedAt).toLocaleString() : <span style={{ color: 'var(--text-muted)' }}>Pending device</span>}
                    </td>
                    <td>
                      {cmd.isSimulated ? (
                        <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>SIMULATION</span>
                      ) : (
                        <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>PHYSICAL HW</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation & Authorization Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={`Confirm Safety Command: ${commandTypeToSubmit}`}
        maxWidth="580px"
      >
        <form onSubmit={handleSubmitCommand}>
          {submissionResult ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <CheckCircle2 size={42} color="var(--accent-emerald)" style={{ margin: '0 auto 1rem auto' }} />
              <h4>Command Successfully Dispatched to Queue</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem 0' }}>
                Command ID: <code className="mono">{submissionResult.command.id}</code>
              </p>
              {submissionResult.warning && (
                <div style={{ padding: '0.75rem', background: 'var(--accent-amber-glow)', border: '1px solid var(--accent-amber)', borderRadius: 'var(--radius-md)', color: 'var(--accent-amber)', fontSize: '0.8rem', textAlign: 'left', marginBottom: '1rem' }}>
                  {submissionResult.warning}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="btn btn-primary"
              >
                Close & Monitor Status
              </button>
            </div>
          ) : (
            <div>
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: commandTypeToSubmit === 'IMMOBILIZE' ? 'var(--accent-rose-glow)' : 'var(--accent-cyan-glow)',
                  border: `1px solid ${commandTypeToSubmit === 'IMMOBILIZE' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`,
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem'
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: '0.25rem', color: commandTypeToSubmit === 'IMMOBILIZE' ? 'var(--accent-rose)' : 'var(--accent-cyan)' }}>
                  Target: {selectedVehicle?.plateNumber} ({selectedVehicle?.make} {selectedVehicle?.model})
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {commandTypeToSubmit === 'IMMOBILIZE'
                    ? 'This request will queue an ignition cut-off signal to the optocoupler relay module on the vehicle. If the car is moving, the safety interlock will wait until zero velocity.'
                    : 'This request will signal the relay to restore normal continuous circuit connection to vehicle ignition.'}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Mandatory Audit Justification / Reason *</label>
                <textarea
                  required
                  rows={3}
                  className="form-textarea"
                  placeholder="e.g. Authorized customer rental overdue by 72 hours with unpaid charges; verified parked at warehouse."
                  value={justificationReason}
                  onChange={(e) => setJustificationReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  id="simMode"
                  checked={isSimulationMode}
                  onChange={(e) => setIsSimulationMode(e.target.checked)}
                />
                <label htmlFor="simMode" style={{ color: 'var(--text-secondary)' }}>
                  Tag as <strong>Software Simulation / Lab Verification</strong> (Clear Audit Flag)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={commandTypeToSubmit === 'IMMOBILIZE' ? 'btn btn-danger' : 'btn btn-primary'}
                >
                  {submitting ? 'Dispatching...' : `Confirm & Transmit ${commandTypeToSubmit}`}
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};
