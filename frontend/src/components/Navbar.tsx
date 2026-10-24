import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext.js';
import { useAuth } from '../contexts/AuthContext.js';
import { wsClient } from '../services/websocket.js';
import { api } from '../services/api.js';
import type { NotificationItem } from '../types/index.js';
import {
  Shield,
  Sun,
  Moon,
  Bell,
  Radio,
  User as UserIcon,
  Check,
  CheckCircle2,
  AlertTriangle,
  Lock
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [isWsConnected, setIsWsConnected] = useState(wsClient.isConnected);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const unsub = wsClient.onStatusChange((status) => {
      setIsWsConnected(status);
    });

    const unsubNotif = wsClient.on('NOTIFICATION', (notif: NotificationItem) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 19)]);
    });

    // Initial fetch
    api.getNotifications()
      .then((data) => setNotifications(data))
      .catch(() => {});

    return () => {
      unsub();
      unsubNotif();
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (e) {}
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'IMMOBILIZER':
        return <Lock size={14} className="text-rose-500" />;
      case 'SPEED_ALERT':
      case 'RENTAL_LIMIT':
        return <AlertTriangle size={14} className="text-amber-500" />;
      default:
        return <CheckCircle2 size={14} className="text-cyan-500" />;
    }
  };

  return (
    <header
      style={{
        height: '68px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        backdropFilter: 'var(--glass-backdrop)',
        WebkitBackdropFilter: 'var(--glass-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.75rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        transition: 'background var(--transition-normal)'
      }}
    >
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 2px 10px var(--accent-cyan-glow)'
          }}
        >
          <Shield size={20} strokeWidth={2.5} />
        </div>
        <div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Fleet<span style={{ color: 'var(--accent-cyan)' }}>Guard</span>
          </span>
          <span
            style={{
              display: 'block',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 700
            }}
          >
            IoT Vehicle Telemetry & Security
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Live WebSocket Telemetry Link Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            background: isWsConnected ? 'var(--accent-emerald-glow)' : 'rgba(148, 163, 184, 0.15)',
            border: `1px solid ${isWsConnected ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
            fontSize: '0.75rem',
            fontWeight: 600
          }}
        >
          <Radio size={14} color={isWsConnected ? 'var(--accent-emerald)' : 'var(--text-muted)'} />
          <span style={{ color: isWsConnected ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
            {isWsConnected ? 'LIVE STREAM' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Notifications Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn btn-secondary btn-icon"
            style={{ position: 'relative' }}
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'var(--accent-rose)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px var(--accent-rose-glow)'
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: '48px',
                right: 0,
                width: '360px',
                background: 'var(--bg-modal)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Activity Alerts</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {unreadCount} unread
                </span>
              </div>

              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No recent notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: n.isRead ? 'transparent' : 'rgba(6, 182, 212, 0.05)',
                        cursor: 'pointer',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {getCategoryIcon(n.category)}
                          {n.title}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {n.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="btn btn-secondary btn-icon"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} color="var(--accent-amber)" /> : <Moon size={18} color="var(--accent-blue)" />}
        </button>

        {/* User Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--accent-cyan-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}
          >
            <UserIcon size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2 }}>
              {user?.name || 'Fleet Operator'}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {user?.role || 'OPERATOR'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
