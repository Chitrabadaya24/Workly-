export const StatusBadge = ({ status }) => {
  const classes = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    completed: 'badge-completed',
    cancelled: 'bg-surface-100 text-surface-500 badge',
  };
  const labels = {
    pending: '⏳ Pending',
    approved: '✅ Approved',
    rejected: '❌ Rejected',
    completed: '🏁 Completed',
    cancelled: 'Cancelled',
  };
  return (
    <span className={classes[status] || 'badge bg-surface-100 text-surface-500'}>
      {labels[status] || status}
    </span>
  );
};

export const UrgencyBadge = ({ urgency }) => {
  const classes = {
    emergency: 'badge-emergency',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  };
  const icons = {
    emergency: '🚨',
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };
  return (
    <span className={`badge ${classes[urgency] || ''} capitalize`}>
      {icons[urgency]} {urgency}
    </span>
  );
};

export const RoleBadge = ({ role }) => {
  const classes = {
    admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    ceo: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    employee: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return (
    <span className={`badge ${classes[role] || ''} capitalize`}>
      {role}
    </span>
  );
};

export const CEOStatusBadge = ({ status }) => {
  const config = {
    available: { label: 'Available', dot: 'status-available', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    in_meeting: { label: 'In Meeting', dot: 'status-in_meeting', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    deep_work: { label: 'Deep Work', dot: 'status-deep_work', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
    emergency_only: { label: 'Emergency Only', dot: 'status-emergency_only', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    offline: { label: 'Offline', dot: 'status-offline', cls: 'bg-surface-100 text-surface-500' },
  };
  const c = config[status] || config.offline;
  return (
    <span className={`badge ${c.cls} gap-1.5`}>
      <span className={`status-dot ${c.dot}`} />
      {c.label}
    </span>
  );
};
