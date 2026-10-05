import { useState, useEffect, useCallback } from 'react';
import { teamAPI } from '../../services/apiService';
import PageHeader from '../../components/common/PageHeader';
import { StatusBadge, UrgencyBadge } from '../../components/common/Badges';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'requests', label: 'Requests' },
  { id: 'tasks', label: 'Tasks' },
];

export default function TeamViewPage() {
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState('');
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    teamAPI.getDepartments()
      .then(({ data }) => {
        const list = data.departments || [];
        setDepartments(list);
        if (list.length && !department) setDepartment(list[0]);
      })
      .catch(() => toast.error('Failed to load departments'));
  }, []);

  const loadDepartment = useCallback(async () => {
    if (!department) return;
    setLoading(true);
    try {
      const [sumRes, reqRes, taskRes] = await Promise.all([
        teamAPI.getSummary(department),
        teamAPI.getRequests(department, { limit: 30 }),
        teamAPI.getTasks(department),
      ]);
      setSummary(sumRes.data);
      setRequests(reqRes.data.requests || []);
      setTasks(taskRes.data.tasks || []);
    } catch {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => { loadDepartment(); }, [loadDepartment]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Team View"
        subtitle="Requests and tasks filtered by department"
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="text-sm text-surface-500">Department</label>
        <select
          className="input w-auto min-w-[180px]"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Members', value: summary.memberCount },
            { label: 'Pending requests', value: summary.pendingRequests },
            { label: 'Open tasks', value: summary.openTasks },
            { label: 'Upcoming meetings', value: summary.upcomingMeetings },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-surface-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4 border-b border-surface-200 dark:border-surface-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-surface-500 hover:text-surface-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-surface-500">Loading…</div>
      ) : tab === 'requests' ? (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-surface-500 text-sm">No requests for this department.</p>
          ) : (
            requests.map((req) => (
              <div key={req._id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <h3 className="font-semibold text-surface-900 dark:text-white">{req.title}</h3>
                  <div className="flex gap-2">
                    <UrgencyBadge urgency={req.urgency} />
                    <StatusBadge status={req.status} />
                  </div>
                </div>
                <p className="text-sm text-surface-500 mt-1">
                  {req.requestedBy?.fullName} · {format(new Date(req.preferredDate), 'MMM d')} at {req.preferredTime}
                </p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-surface-500 text-sm">No tasks for this department.</p>
          ) : (
            tasks.map((task) => (
              <div key={task._id} className="card p-4 flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium text-surface-900 dark:text-white">{task.title}</p>
                  <p className="text-xs text-surface-500">
                    {task.assignedTo?.fullName}
                    {task.team ? ` · #${task.team}` : ''}
                  </p>
                </div>
                <span className="badge bg-surface-100 dark:bg-surface-800 text-xs capitalize">{task.status}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
