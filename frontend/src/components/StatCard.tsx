import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'cyan'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'emerald':
        return { color: 'var(--accent-emerald)', bg: 'var(--accent-emerald-glow)', class: 'emerald' };
      case 'amber':
        return { color: 'var(--accent-amber)', bg: 'var(--accent-amber-glow)', class: 'amber' };
      case 'rose':
        return { color: 'var(--accent-rose)', bg: 'var(--accent-rose-glow)', class: 'rose' };
      case 'purple':
        return { color: 'var(--accent-purple)', bg: 'rgba(168, 85, 247, 0.15)', class: 'purple' };
      default:
        return { color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-glow)', class: 'cyan' };
    }
  };

  const style = getVariantStyles();

  return (
    <div className={`card stat-card ${style.class}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {title}
        </span>
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-md)',
            background: style.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: style.color
          }}
        >
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-value mono">{value}</div>
      {subtext && <div className="stat-subtext">{subtext}</div>}
    </div>
  );
};
