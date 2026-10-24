import React from 'react';
import {
  LayoutDashboard,
  Navigation,
  Car,
  Cpu,
  Compass,
  FileText,
  AlertTriangle,
  History,
  Lock,
  Settings
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Live Tracking', path: '/tracking', icon: Navigation },
    { label: 'Vehicles', path: '/vehicles', icon: Car },
    { label: 'IoT Devices', path: '/devices', icon: Cpu },
    { label: 'Trip Logs', path: '/trips', icon: Compass },
    { label: 'Rental Orders', path: '/rentals', icon: FileText },
    { label: 'Speed Alerts', path: '/alerts', icon: AlertTriangle },
    { label: 'Vehicle History', path: '/history', icon: History },
    { label: 'Safe Immobilizer', path: '/immobilizer', icon: Lock },
    { label: 'System Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside
      style={{
        width: '240px',
        borderRight: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        backdropFilter: 'var(--glass-backdrop)',
        WebkitBackdropFilter: 'var(--glass-backdrop)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.25rem 0.85rem',
        flexShrink: 0,
        transition: 'background var(--transition-normal)'
      }}
    >
      <div style={{ padding: '0 0.5rem 1rem 0.5rem' }}>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)'
          }}
        >
          Fleet Operations
        </span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-cyan-glow)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'var(--border-accent)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.3 : 1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* System Hardware Spec Chip */}
      <div
        style={{
          marginTop: 'auto',
          padding: '0.85rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '0.25rem' }}>
          <Cpu size={14} />
          <span>ESP32 Hardware HAL</span>
        </div>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.3 }}>
          SIM800L 2G GPRS + NEO-6M GPS Receiver + Optocoupler Cut-off
        </p>
      </div>
    </aside>
  );
};
