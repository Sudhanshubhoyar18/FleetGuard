import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = (status || '').toUpperCase();

  switch (normalized) {
    case 'ONLINE':
    case 'ACTIVE':
    case 'COMPLETED':
      return <span className="badge badge-online">● {status}</span>;
    case 'OFFLINE':
    case 'CANCELLED':
    case 'DECOMMISSIONED':
      return <span className="badge badge-offline">○ {status}</span>;
    case 'IN_RENTAL':
    case 'SCHEDULED':
      return <span className="badge badge-cyan">◈ {status}</span>;
    case 'OVERDUE':
    case 'IMMOBILIZED':
    case 'FAILED':
      return <span className="badge badge-alert">▲ {status}</span>;
    case 'PENDING_IMMOBILIZATION':
    case 'REQUESTED':
    case 'DELIVERED':
    case 'ACKNOWLEDGED':
    case 'MAINTENANCE':
      return <span className="badge badge-warning">◐ {status}</span>;
    default:
      return <span className="badge badge-purple">{status}</span>;
  }
};
