import { useState, useEffect, useCallback } from 'react';
import { auditAPI } from '../../services/apiService';
import PageHeader from '../../components/common/PageHeader';
import { formatDistanceToNow, format } from 'date-fns';

const ACTION_LABELS = {
  'user.create': 'User created',
  'user.update': 'User updated',
  'user.delete': 'User deleted',
  'user.reset_password': 'Password reset',
  'user.toggle_status': 'Status toggled',
  'meeting.request_create': 'Request submitted',
  'meeting.approve': 'Request approved',
  'meeting.reject': 'Request rejected',
  'meeting.complete': 'Meeting completed',
  'request.attachment.upload': 'File uploaded',
  'request.attachment.delete': 'File deleted',
  'task.create': 'Task created',
  'task.delete': 'Task deleted',
  'token.reset': 'Tokens reset',
  'token.reset_all': 'Bulk token reset',
  'focus_block.add': 'Focus block added',
  'focus_block.remove': 'Focus block removed',
  'availability.status_change': 'CEO status changed',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [expanded, setExpanded] = useState(null);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (actionFilter) params.action = actionFilter;
      const { data } = await auditAPI.getAll(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Audit Log"
        subtitle="Immutable record of admin and platform actions"
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="input w-auto min-w-[200px]"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-surface-500">No audit entries yet</div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {logs.map((log) => (
              <div key={log._id} className="px-4 py-3 hover:bg-surface-50/50 dark:hover:bg-surface-800/30">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">
                      {ACTION_LABELS[log.action] || log.action}
                    </p>
                    <p className="text-sm text-surface-600 dark:text-surface-400 mt-0.5">{log.summary}</p>
                    <p className="text-xs text-surface-400 mt-1">
                      {log.actor?.fullName || 'Unknown'} (@{log.actor?.username}) · {log.actorRole}
                      {' · '}
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-xs text-surface-400 whitespace-nowrap">
                    {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                  </div>
                </div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary-600 mt-2"
                    onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                  >
                    {expanded === log._id ? 'Hide details' : 'Show details'}
                  </button>
                )}
                {expanded === log._id && (
                  <pre className="mt-2 text-xs bg-surface-100 dark:bg-surface-900 p-2 rounded-lg overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {total > limit && (
        <div className="flex justify-center gap-2 mt-4">
          <button className="btn-secondary text-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="text-sm text-surface-500 self-center">Page {page}</span>
          <button className="btn-secondary text-sm" disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
