import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { meetingAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { StatusBadge, UrgencyBadge, CEOStatusBadge } from '../../components/common/Badges';
import { formatDistanceToNow, format } from 'date-fns';

const CEOHome = ({ currentStatus }) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [pending, setPending] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [analyticsRes, pendingRes, upcomingRes] = await Promise.all([
          meetingAPI.getAnalytics(),
          meetingAPI.getAll({ status: 'pending', limit: 5 }),
          meetingAPI.getAll({ status: 'approved', limit: 5 }),
        ]);
        setAnalytics(analyticsRes.data.analytics);
        setPending(pendingRes.data.requests);
        setUpcoming(upcomingRes.data.requests);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  const statusMessages = {
    available: { text: 'You are available for meetings', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
    in_meeting: { text: 'Currently in a meeting — new requests are queued', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
    deep_work: { text: 'Deep Work mode — only emergency requests accepted', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800' },
    emergency_only: { text: 'Emergency Only mode — critical requests only', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
    offline: { text: 'You are offline', color: 'text-surface-500', bg: 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700' },
  };
  const sm = statusMessages[currentStatus] || statusMessages.available;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${user?.fullName?.split(' ')[0]}`}
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
      />

      {/* Status Banner */}
      <div className={`border rounded-2xl px-4 py-3 mb-6 flex items-center gap-3 ${sm.bg}`}>
        <CEOStatusBadge status={currentStatus} />
        <p className={`text-sm font-medium ${sm.color}`}>{sm.text}</p>
        <Link to="/ceo" className="ml-auto text-xs text-surface-500 hover:text-primary-600 font-medium">Change status ↗</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Pending Review" value={analytics?.pending || 0} color="amber"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
        <StatCard title="Approved" value={analytics?.approved || 0} color="emerald"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>} />
        <StatCard title="Total Requests" value={analytics?.total || 0} color="primary"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
        <StatCard title="Approval Rate" value={`${analytics?.approvalRate || 0}%`} color="blue"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Requests */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-surface-900 dark:text-white">Needs Your Attention</h2>
            <Link to="/ceo/requests?status=pending" className="text-sm text-primary-600 hover:text-primary-700 font-medium">View all →</Link>
          </div>
          {pending.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-surface-400 text-sm">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(req => (
                <Link key={req._id} to={`/ceo/requests`}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors block">
                  <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                    {req.requestedBy?.fullName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{req.title}</p>
                    <p className="text-xs text-surface-500">{req.requestedBy?.fullName} · {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</p>
                  </div>
                  <UrgencyBadge urgency={req.urgency} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Approved */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-surface-900 dark:text-white">Upcoming Meetings</h2>
            <Link to="/ceo/calendar" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Calendar →</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-4xl mb-2">📅</div>
              <p className="text-surface-400 text-sm">No upcoming meetings</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(req => (
                <div key={req._id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0 flex-col leading-none">
                    <span className="text-[9px] uppercase font-semibold">{format(new Date(req.approvedDate || req.preferredDate), 'MMM')}</span>
                    <span className="text-sm font-bold">{format(new Date(req.approvedDate || req.preferredDate), 'd')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{req.title}</p>
                    <p className="text-xs text-surface-500">{req.requestedBy?.fullName} · {req.approvedTime || req.preferredTime}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CEOHome;
