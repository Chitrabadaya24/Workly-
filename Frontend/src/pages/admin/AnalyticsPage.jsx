import { useState, useEffect } from 'react';
import { meetingAPI } from '../../services/apiService';
import PageHeader from '../../components/common/PageHeader';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  completed: '#6366f1',
  emergency: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const AnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    meetingAPI.getAnalytics()
      .then(({ data }) => setAnalytics(data.analytics))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  if (!analytics) return null;

  const statusData = [
    { name: 'Pending', value: analytics.pending, color: COLORS.pending },
    { name: 'Approved', value: analytics.approved, color: COLORS.approved },
    { name: 'Rejected', value: analytics.rejected, color: COLORS.rejected },
    { name: 'Completed', value: analytics.completed, color: COLORS.completed },
  ].filter(d => d.value > 0);

  const urgencyData = (analytics.urgencyDistribution || []).map(u => ({
    name: u._id.charAt(0).toUpperCase() + u._id.slice(1),
    value: u.count,
    color: COLORS[u._id] || '#6366f1',
  }));

  const topEmployeesData = (analytics.topEmployees || []).map(e => ({
    name: e.user?.fullName?.split(' ')[0] || 'Unknown',
    requests: e.count,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-600 rounded-xl px-3 py-2 shadow-lg dark:shadow-xl text-sm">
          <p className="font-medium text-surface-900 dark:text-surface-100">{payload[0].name}</p>
          <p className="text-surface-500">{payload[0].value} requests</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Analytics" subtitle="Platform usage insights and productivity metrics" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Requests', value: analytics.total, bg: 'bg-primary-50 dark:bg-primary-950/30', text: 'text-primary-700 dark:text-primary-400' },
          { label: 'Approval Rate', value: `${analytics.approvalRate}%`, bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Pending Review', value: analytics.pending, bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400' },
          { label: 'Completed', value: analytics.completed, bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400' },
        ].map(c => (
          <div key={c.label} className={`card ${c.bg} border-0`}>
            <p className={`text-3xl font-display font-bold ${c.text}`}>{c.value}</p>
            <p className="text-sm text-surface-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status Distribution */}
        <div className="card">
          <h2 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Request Status Distribution</h2>
          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-surface-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(value) => <span className="text-xs text-surface-600 dark:text-surface-400">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Urgency Distribution */}
        <div className="card">
          <h2 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Urgency Distribution</h2>
          {urgencyData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-surface-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={urgencyData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {urgencyData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(value) => <span className="text-xs text-surface-600 dark:text-surface-400">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Employees */}
      {topEmployeesData.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Most Active Employees</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topEmployeesData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="requests" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top employees table */}
      {analytics.topEmployees?.length > 0 && (
        <div className="card">
          <h2 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Top Requesters Detail</h2>
          <div className="space-y-3">
            {analytics.topEmployees.map((e, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="w-6 text-center font-display font-bold text-surface-400 text-sm">#{i + 1}</span>
                <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-400 font-bold text-sm">
                  {e.user?.fullName?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{e.user?.fullName}</p>
                  <p className="text-xs text-surface-500">{e.user?.department || 'No department'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-primary-100 dark:bg-primary-900/30 rounded-full overflow-hidden" style={{ width: 80 }}>
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${(e.count / (analytics.topEmployees[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-surface-700 dark:text-surface-300 w-8 text-right">{e.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
