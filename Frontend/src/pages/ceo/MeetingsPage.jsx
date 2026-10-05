import { useState, useEffect, useCallback } from 'react';
import { meetAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import MeetingCard from '../../components/meetings/MeetingCard';
import CreateMeetingModal from '../../components/meetings/CreateMeetingModal';
import { getSocket } from '../../socket/socket';
import toast from 'react-hot-toast';

const MeetingsPage = () => {
  const { user } = useAuth();
  const isCEO = user?.role === 'ceo' || user?.role === 'admin';
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState({ total: 0, upcoming: 0, live: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editData, setEditData] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meetRes, statsRes] = await Promise.all([
        meetAPI.getAll({ status: statusFilter, search, page, limit: 10 }),
        meetAPI.getStats(),
      ]);
      setMeetings(meetRes.data.meetings);
      setTotal(meetRes.data.total);
      setStats(statsRes.data.stats);
    } catch { toast.error('Failed to load meetings'); }
    finally { setLoading(false); }
  }, [statusFilter, search, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onNew = (meeting) => {
      setMeetings((prev) => [meeting, ...prev]);
      setStats((s) => ({ ...s, total: s.total + 1, upcoming: s.upcoming + 1 }));
      toast.success(`📅 New meeting: ${meeting.title}`);
    };

    const onUpdated = (updated) => {
      setMeetings((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
    };

    const onTrashed = ({ _id }) => {
      setMeetings((prev) => prev.filter((m) => m._id !== _id));
      load();
      toast('Meeting moved to trash', { icon: '🗑' });
    };

    const onDeleted = ({ id }) => {
      setMeetings((prev) => prev.filter((m) => m._id !== id));
      load();
    };

    socket.on('new_meeting', onNew);
    socket.on('meeting_updated', onUpdated);
    socket.on('meeting_trashed', onTrashed);
    socket.on('meeting_deleted', onDeleted);

    return () => {
      socket.off('new_meeting', onNew);
      socket.off('meeting_updated', onUpdated);
      socket.off('meeting_trashed', onTrashed);
      socket.off('meeting_deleted', onDeleted);
    };
  }, [load]);

  const handleJoin = (link) => window.open(link, '_blank');
  const handleEdit = (meeting) => { setEditData(meeting); setShowCreate(true); };

  const handleDelete = async (id) => {
    if (!confirm('Move this meeting to trash?')) return;
    try {
      await meetAPI.delete(id);
      toast.success('Moved to trash');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const handleCreated = () => load();

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Meetings"
        subtitle="Schedule and manage video meetings"
        actions={isCEO && (
          <button onClick={() => { setEditData(null); setShowCreate(true); }}
            className="btn-primary flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Schedule Meeting
          </button>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Active" value={stats.total} color="primary"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
        <StatCard title="Upcoming" value={stats.upcoming} color="blue"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
        <StatCard title="Live Now" value={stats.live} color="red"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>} />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="input pl-9" placeholder="Search meetings…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {['', 'upcoming', 'live', 'cancelled'].map((s) => (
          <button key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50'
            }`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">📹</div>
          <p className="text-surface-500 font-medium">No meetings found</p>
          {isCEO && (
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 mx-auto">
              Schedule First Meeting
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard key={m._id} meeting={m} isCEO={isCEO}
              onJoin={handleJoin} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {total > 10 && (
        <div className="flex justify-center gap-2 mt-6">
          <button className="btn-secondary py-1.5 px-4 text-sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>← Prev</button>
          <span className="flex items-center px-3 text-sm text-surface-500">Page {page}</span>
          <button className="btn-secondary py-1.5 px-4 text-sm" onClick={() => setPage((p) => p + 1)} disabled={page * 10 >= total}>Next →</button>
        </div>
      )}

      <CreateMeetingModal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditData(null); }}
        onCreated={handleCreated}
        editData={editData}
      />
    </div>
  );
};

export default MeetingsPage;
