import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { userAPI, meetingAPI } from '../../services/apiService';
import StatCard from '../../components/common/StatCard';
import PageHeader from '../../components/common/PageHeader';
import { RoleBadge, StatusBadge } from '../../components/common/Badges';
import { formatDistanceToNow } from 'date-fns';

const AdminHome = () => {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, analyticsRes, meetingsRes] = await Promise.all([
          userAPI.getAll({ limit: 5 }),
          meetingAPI.getAnalytics(),
          meetingAPI.getAll({ limit: 5 }),
        ]);
        const allUsers = await userAPI.getAll({ limit: 1000 });
        const usersByRole = allUsers.data.users.reduce((acc, u) => {
          acc[u.role] = (acc[u.role] || 0) + 1;
          return acc;
        }, {});
        setStats({
          total: allUsers.data.total,
          ...usersByRole,
          active: allUsers.data.users.filter(u => u.isActive).length,
        });
        setRecentUsers(usersRes.data.users);
        setAnalytics(analyticsRes.data.analytics);
        setRecentMeetings(meetingsRes.data.requests);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Platform Overview"
        subtitle="Welcome back, Administrator"
        actions={
          <Link to="/admin/users" className="btn-primary flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add User
          </Link>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Users"
          value={stats?.total || 0}
          subtitle={`${stats?.active || 0} active`}
          color="primary"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <StatCard
          title="Employees"
          value={stats?.employee || 0}
          color="blue"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
        />
        <StatCard
          title="Total Requests"
          value={analytics?.total || 0}
          subtitle={`${analytics?.pending || 0} pending`}
          color="amber"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />
        <StatCard
          title="Approval Rate"
          value={`${analytics?.approvalRate || 0}%`}
          subtitle={`${analytics?.approved || 0} approved`}
          color="emerald"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-surface-900 dark:text-white">Recent Users</h2>
            <Link to="/admin/users" className="text-sm text-primary-600 hover:text-primary-700 font-medium">View all →</Link>
          </div>
          <div className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-surface-400 text-sm py-4 text-center">No users yet</p>
            ) : recentUsers.map((u) => (
              <div key={u._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                  u.role === 'admin' ? 'bg-purple-500' : u.role === 'ceo' ? 'bg-amber-500' : 'bg-primary-500'
                }`}>
                  {u.fullName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{u.fullName}</p>
                  <p className="text-xs text-surface-500">@{u.username}</p>
                </div>
                <div className="flex items-center gap-2">
                  <RoleBadge role={u.role} />
                  {!u.isActive && <span className="badge bg-red-100 text-red-600 text-xs">Inactive</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Meetings */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-surface-900 dark:text-white">Recent Requests</h2>
            <Link to="/admin/analytics" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Analytics →</Link>
          </div>
          <div className="space-y-3">
            {recentMeetings.length === 0 ? (
              <p className="text-surface-400 text-sm py-4 text-center">No meeting requests yet</p>
            ) : recentMeetings.map((m) => (
              <div key={m._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{m.title}</p>
                  <p className="text-xs text-surface-500">{m.requestedBy?.fullName} · {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}</p>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Meeting stats */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Pending', value: analytics.pending, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
            { label: 'Approved', value: analytics.approved, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
            { label: 'Rejected', value: analytics.rejected, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
            { label: 'Completed', value: analytics.completed, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <p className={`text-2xl font-display font-bold inline-block px-3 py-1 rounded-lg ${s.color}`}>{s.value}</p>
              <p className="text-sm text-surface-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminHome;
