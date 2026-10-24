import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import type { DeviceInfo, Vehicle } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import {
  Cpu,
  Plus,
  Radio,
  WifiOff,
  Signal,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';

export const DevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newModel, setNewModel] = useState('ESP32-SIM800L');
  const [newFirmware, setNewFirmware] = useState('1.0.0');
  const [assignedVehicleId, setAssignedVehicleId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [dList, vList] = await Promise.all([
        api.getDevices(),
        api.getVehicles()
      ]);
      setDevices(dList);
      setVehicles(vList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const registered = await api.registerDevice({
        deviceId: newDeviceId,
        model: newModel,
        firmwareVersion: newFirmware,
        vehicleId: assignedVehicleId || undefined
      });
      setDevices((prev) => [registered, ...prev]);
      setIsModalOpen(false);
      setNewDeviceId('');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Cpu size={26} color="var(--accent-cyan)" />
            IoT Microcontroller Registry
          </h1>
          <p className="page-subtitle">
            ESP32 devices, SIM800L cellular modems, and heartbeat watchdog status
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={loadData} className="btn btn-secondary">
            <RefreshCw size={16} /> Refresh Status
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Register Device
          </button>
        </div>
      </div>

      {/* Device Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Device Identifier</th>
              <th>Status</th>
              <th>Modem Architecture</th>
              <th>Firmware</th>
              <th>Cellular Signal</th>
              <th>Last Heartbeat</th>
              <th>Last GPS Fix</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id}>
                <td>
                  <span className="mono" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                    {d.deviceId}
                  </span>
                </td>
                <td>
                  <StatusBadge status={d.isOnline ? 'ONLINE' : 'OFFLINE'} />
                </td>
                <td>
                  <span className="badge badge-purple">{d.model}</span>
                </td>
                <td>
                  <span className="mono" style={{ fontSize: '0.8rem' }}>v{d.firmwareVersion}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Signal size={14} color={d.cellularSignalRssi ? 'var(--accent-emerald)' : 'var(--text-muted)'} />
                    <span className="mono" style={{ fontSize: '0.8rem' }}>
                      {d.cellularSignalRssi ? `${d.cellularSignalRssi} dBm` : 'No Signal'}
                    </span>
                  </div>
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  {d.lastHeartbeatAt ? (
                    <div>
                      <div>{new Date(d.lastHeartbeatAt).toLocaleTimeString()}</div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {d.secondsSinceHeartbeat !== undefined ? `${d.secondsSinceHeartbeat}s ago` : ''}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Never seen</span>
                  )}
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  {d.lastGpsFixAt ? (
                    <div>
                      <div style={{ color: 'var(--accent-cyan)' }}>{new Date(d.lastGpsFixAt).toLocaleTimeString()}</div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Valid Sat Lock</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>No fix logged</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Register Device Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New IoT Microcontroller Unit"
      >
        <form onSubmit={handleRegisterDevice}>
          {errorMsg && (
            <div style={{ padding: '0.75rem', background: 'var(--accent-rose-glow)', border: '1px solid var(--accent-rose)', borderRadius: 'var(--radius-md)', color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {errorMsg}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Device Identifier (HW Unique ID) *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. FG-ESP32-003"
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Hardware Architecture</label>
            <select
              className="form-select"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
            >
              <option value="ESP32-SIM800L">ESP32 + SIM800L (2G GSM/GPRS)</option>
              <option value="ESP32-SIM7600">ESP32 + SIM7600 (4G LTE CAT-4)</option>
              <option value="ESP32-A7670">ESP32 + A7670 (4G LTE CAT-1)</option>
              <option value="ESP32-WIFI-DEV">ESP32 Lab WiFi Simulator</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Firmware Version</label>
            <input
              type="text"
              className="form-input"
              value={newFirmware}
              onChange={(e) => setNewFirmware(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Pair with Vehicle (Optional)</label>
            <select
              className="form-select"
              value={assignedVehicleId}
              onChange={(e) => setAssignedVehicleId(e.target.value)}
            >
              <option value="">Unassigned (Standby)</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} ({v.make} {v.model})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Registering...' : 'Complete Registration'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
