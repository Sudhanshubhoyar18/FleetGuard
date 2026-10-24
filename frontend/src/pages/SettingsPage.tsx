import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import type { AppSettings } from '../types/index.js';
import {
  Settings,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sliders,
  ShieldCheck,
  Bot
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form Fields
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [heartbeatTimeout, setHeartbeatTimeout] = useState('60');
  const [gpsMaxSpeed, setGpsMaxSpeed] = useState('200');
  const [gpsMaxJump, setGpsMaxJump] = useState('5');
  const [speedCooldown, setSpeedCooldown] = useState('120');

  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await api.getSettings();
        setSettings(data);
        setTelegramChatId(data.telegramChatId || '');
        setHeartbeatTimeout(String(data.heartbeatTimeoutSeconds));
        setGpsMaxSpeed(String(data.gpsMaxValidSpeedKmH));
        setGpsMaxJump(String(data.gpsMaxDistanceJumpKm));
        setSpeedCooldown(String(data.speedAlertCooldownSeconds));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      await api.updateSettings({
        telegramBotToken: telegramToken || undefined,
        telegramChatId,
        heartbeatTimeoutSeconds: parseInt(heartbeatTimeout, 10),
        gpsMaxValidSpeedKmH: parseFloat(gpsMaxSpeed),
        gpsMaxDistanceJumpKm: parseFloat(gpsMaxJump),
        speedAlertCooldownSeconds: parseInt(speedCooldown, 10)
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramTestResult(null);

    try {
      const res = await api.testTelegramNotification(telegramChatId || undefined);
      setTelegramTestResult(res);
    } catch (err: any) {
      setTelegramTestResult({
        success: false,
        error: err.message
      });
    } finally {
      setTestingTelegram(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Settings size={26} color="var(--accent-cyan)" />
            FleetGuard System Configuration
          </h1>
          <p className="page-subtitle">
            Configure Telegram Bot notifications, GPS jump filtering, and IoT supervisor parameters
          </p>
        </div>

        {saveSuccess && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.85rem' }}>
            <CheckCircle2 size={18} />
            Settings saved successfully!
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem', marginBottom: '2rem' }}>
          {/* Telegram Notifications Integration */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Bot size={18} color="var(--accent-cyan)" />
                Telegram Bot API Integration
              </span>
              <span className="badge badge-cyan">External Webhook</span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.45 }}>
              Receive instant security alerts on mobile when vehicle speed is exceeded, rental distance boundary is broken, or safe engine cut is requested.
            </p>

            <div className="form-group">
              <label className="form-label">Telegram Bot Token (from @BotFather)</label>
              <input
                type="password"
                className="form-input"
                placeholder={settings?.telegramBotTokenConfigured ? '•••••••••••••••••••••••••••• (Configured)' : 'e.g. 7192839182:AAFDj9...'}
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {settings?.telegramBotTokenConfigured ? '✅ Active in backend environment' : '⚠️ Not configured. Notifications logged locally.'}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Authorized Telegram Chat ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 928371928 or -10012938472"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
              />
            </div>

            {/* Test Action */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                <Send size={16} />
                {testingTelegram ? 'Testing Telegram Webhook...' : 'Send Test Notification Message'}
              </button>

              {telegramTestResult && (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: telegramTestResult.success ? 'var(--accent-emerald-glow)' : 'var(--accent-rose-glow)',
                    border: `1px solid ${telegramTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ fontWeight: 700, color: telegramTestResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {telegramTestResult.success ? '✅ Test Message Delivered' : '❌ Delivery Failed'}
                  </div>
                  <p style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                    {telegramTestResult.error || telegramTestResult.info}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* IoT Telemetry Watchdog Parameters */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Sliders size={18} color="var(--accent-cyan)" />
                IoT Watchdog & Filter Thresholds
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Heartbeat Offline Watchdog (Seconds)</label>
              <input
                type="number"
                className="form-input"
                value={heartbeatTimeout}
                onChange={(e) => setHeartbeatTimeout(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                If no heartbeat arrives within this interval, device is marked OFFLINE.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Max Valid Vehicle Velocity (km/h)</label>
              <input
                type="number"
                className="form-input"
                value={gpsMaxSpeed}
                onChange={(e) => setGpsMaxSpeed(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Coordinates implying speeds above this threshold are rejected as sensor jumps.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Max GPS Displacement Jump (km)</label>
              <input
                type="number"
                className="form-input"
                value={gpsMaxJump}
                onChange={(e) => setGpsMaxJump(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Filters out satellite multi-path jumps and cold-start teleportations.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Speed Alert Cooldown Rate Limit (Seconds)</label>
              <input
                type="number"
                className="form-input"
                value={speedCooldown}
                onChange={(e) => setSpeedCooldown(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Suppresses notification spam while vehicle continuously cruises over limit.
              </span>
            </div>

            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Cellular Modem Target:</span>
              <strong className="mono" style={{ color: 'var(--accent-cyan)' }}>
                SIM800L (2G GSM/GPRS)
              </strong>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
          >
            <Save size={18} />
            {saving ? 'Saving System Changes...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};
