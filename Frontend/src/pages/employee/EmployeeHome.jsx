import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { meetingAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { StatusBadge, UrgencyBadge, CEOStatusBadge } from '../../components/common/Badges';
import { formatDistanceToNow, format } from 'date-fns';
import { meetAPI } from '../../services/apiService';
import { getSocket } from '../../socket/socket';
import toast from 'react-hot-toast';

const EmployeeHome = ({ ceoStatus }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myMeetings, setMyMeetings] = useState([]);

  useEffect(() => {
  const load = async () => {
    try {
      const [reqRes, meetRes] = await Promise.all([
        meetingAPI.getMy({ limit: 10 }),
        meetAPI.getAll({ limit: 5 }),
      ]);
      setRequests(reqRes.data.requests);
      setMyMeetings(meetRes.data.meetings);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  load();

  // Socket listener
  const socket = getSocket();
  if (socket) {
    socket.on('new_meeting', (meeting) => {
      setMyMeetings(prev => [meeting, ...prev]);
      toast.success(`📹 New meeting: ${meeting.title}`);
    });
    return () => socket.off('new_meeting');
  }
}, []);

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const recentRequests = requests.slice(0, 5);
  const tokensLeft = user?.emergencyTokens ?? 3;

  const statusWarnings = {
    deep_work: {
      show: true,
      icon: '🧠',
      title: 'CEO is in Deep Work Mode',
      body: 'Only emergency requests will be accepted. Use your emergency token if critical.',
      cls: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400',
    },
    emergency_only: {
      show: true,
      icon: '🚨',
      title: 'CEO in Emergency Only Mode',
      body: 'Only emergency token requests are being processed right now.',
      cls: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    },
  };
  const warning = statusWarnings[ceoStatus];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Hello, ${user?.fullName?.split(' ')[0]} 👋`}
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
        actions={
          <Link to="/employee/new-request" className="btn-primary flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Request
          </Link>
        }
      />

      {/* CEO Status Warning */}
      {warning?.show && (
        <div className={`border rounded-2xl p-4 mb-5 ${warning.cls}`}>
          <p className="font-semibold text-sm">{warning.icon} {warning.title}</p>
          <p className="text-xs mt-0.5 opacity-80">{warning.body}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Requests" value={stats.total} color="primary"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
        <StatCard title="Pending" value={stats.pending} color="amber"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
        <StatCard title="Approved" value={stats.approved} color="emerald"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>} />
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <div>
              <p className="text-sm text-surface-500">Emergency Tokens</p>
              <div className="flex items-center gap-1 mt-0.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`w-5 h-5 rounded-full border-2 ${i < tokensLeft ? 'bg-red-500 border-red-500' : 'border-surface-300 dark:border-surface-600'}`} />
                ))}
                <span className="text-xs text-surface-500 ml-1">{tokensLeft}/3</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-surface-900 dark:text-white">Recent Requests</h2>
          <Link to="/employee/my-requests" className="text-sm text-primary-600 hover:text-primary-700 font-medium">View all →</Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : recentRequests.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-surface-400 text-sm mb-3">No requests yet</p>
            <Link to="/employee/new-request" className="btn-primary text-sm">Submit Your First Request</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentRequests.map(req => (
              <div key={req._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{req.title}</p>
                  <p className="text-xs text-surface-500">
                    {format(new Date(req.preferredDate), 'MMM d')} at {req.preferredTime} ·{' '}
                    {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <UrgencyBadge urgency={req.urgency} />
                  <StatusBadge status={req.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Meetings */}
      {myMeetings.length > 0 && (
        <div className="card mt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-surface-900 dark:text-white">
              📹 My Upcoming Meetings
            </h2>
            <Link to="/employee/calendar" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Calendar →</Link>
          </div>
          <div className="space-y-3">
            {myMeetings.map(meet => {
              const isLive = meet.status === 'live';
              const isDone = meet.status === 'completed';
              return (
                <div key={meet._id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                    isLive ? 'bg-red-500 animate-pulse' :
                    isDone ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}>
                    📹
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                      {meet.title}
                    </p>
                    <p className="text-xs text-surface-500">
                      {new Date(meet.date).toLocaleDateString()} at {meet.time} · {meet.duration} min
                    </p>
                  </div>
                  <button
                    onClick={() => meet.meetLink && window.open(meet.meetLink, '_blank')}
                    disabled={isDone || !meet.meetLink}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      isDone || !meet.meetLink
                        ? 'bg-surface-100 text-surface-400 cursor-not-allowed'
                        : isLive
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {isDone ? '✓ Done' : !meet.meetLink ? '📅' : isLive ? '🔴 Join' : 'Join'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeHome;
