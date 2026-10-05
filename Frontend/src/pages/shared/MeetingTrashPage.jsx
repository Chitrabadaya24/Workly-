import { useState, useEffect, useCallback, useMemo } from 'react';
import { meetAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import MeetingCard from '../../components/meetings/MeetingCard';
import { getSocket } from '../../socket/socket';
import toast from 'react-hot-toast';

const MeetingTrashPage = () => {
  const { user } = useAuth();
  const isCEO = user?.role === 'ceo' || user?.role === 'admin';
  const [meetings, setMeetings] = useState([]);
  const [trashedCount, setTrashedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meetRes, statsRes] = await Promise.all([
        meetAPI.getAll({ search, page, limit: 10, trash: 'true' }),
        meetAPI.getStats(),
      ]);
      setMeetings(meetRes.data.meetings);
      setTotal(meetRes.data.total);
      setTrashedCount(statsRes.data.stats?.trashed ?? 0);
    } catch {
      toast.error('Failed to load trash');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const selectedCount = selectedIds.size;
  const allOnPageSelected = meetings.length > 0 && meetings.every((m) => selectedIds.has(m._id));
  const someOnPageSelected = meetings.some((m) => selectedIds.has(m._id));

  const pageSelectedCount = useMemo(
    () => meetings.filter((m) => selectedIds.has(m._id)).length,
    [meetings, selectedIds],
  );

  const toggleSelect = useCallback((id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        meetings.forEach((m) => next.delete(m._id));
      } else {
        meetings.forEach((m) => next.add(m._id));
      }
      return next;
    });
  }, [allOnPageSelected, meetings]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onTrashed = (meeting) => {
      setMeetings((prev) => {
        if (prev.some((m) => m._id === meeting._id)) return prev;
        return [meeting, ...prev];
      });
      setTrashedCount((c) => c + 1);
    };

    const onRestored = (meeting) => {
      setMeetings((prev) => prev.filter((m) => m._id !== meeting._id));
      setTrashedCount((c) => Math.max(0, c - 1));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(meeting._id);
        return next;
      });
    };

    const onDeleted = ({ id }) => {
      setMeetings((prev) => prev.filter((m) => m._id !== id));
      setTrashedCount((c) => Math.max(0, c - 1));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };

    const onTrashEmptied = () => {
      setMeetings([]);
      setTotal(0);
      setTrashedCount(0);
      setPage(1);
      clearSelection();
    };

    const onBulkDeleted = ({ ids = [] }) => {
      const idSet = new Set(ids.map(String));
      setMeetings((prev) => prev.filter((m) => !idSet.has(String(m._id))));
      setTrashedCount((c) => Math.max(0, c - idSet.size));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        idSet.forEach((id) => next.delete(id));
        return next;
      });
    };

    socket.on('meeting_trashed', onTrashed);
    socket.on('meeting_restored', onRestored);
    socket.on('meeting_deleted', onDeleted);
    socket.on('trash_emptied', onTrashEmptied);
    socket.on('trash_bulk_deleted', onBulkDeleted);

    return () => {
      socket.off('meeting_trashed', onTrashed);
      socket.off('meeting_restored', onRestored);
      socket.off('meeting_deleted', onDeleted);
      socket.off('trash_emptied', onTrashEmptied);
      socket.off('trash_bulk_deleted', onBulkDeleted);
    };
  }, [clearSelection]);

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this meeting? This cannot be undone.')) return;
    try {
      await meetAPI.delete(id, { permanent: 'true' });
      toast.success('Meeting permanently deleted');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      load();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleRestore = async (id) => {
    try {
      await meetAPI.restore(id);
      toast.success('Meeting restored');
      load();
    } catch {
      toast.error('Failed to restore');
    }
  };

  const handleBulkDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      toast.error('Select meetings to delete');
      return;
    }
    if (!confirm(`Permanently delete ${ids.length} selected meeting(s)? This cannot be undone.`)) return;
    setClearing(true);
    try {
      const { data } = await meetAPI.bulkDeleteTrash(ids);
      toast.success(data.message || 'Selected meetings deleted');
      clearSelection();
      load();
    } catch {
      toast.error('Failed to delete selected meetings');
    } finally {
      setClearing(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm(`Permanently delete all ${trashedCount} meeting(s) in trash? This cannot be undone.`)) return;
    setClearing(true);
    try {
      const { data } = await meetAPI.emptyTrash();
      toast.success(data.message || 'Trash cleared');
      clearSelection();
      setMeetings([]);
      setTotal(0);
      setTrashedCount(0);
      setPage(1);
    } catch {
      toast.error('Failed to clear trash');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Trash"
        subtitle="Select meetings to permanently delete, or delete all at once"
        actions={trashedCount > 0 && (
          <button
            type="button"
            onClick={handleEmptyTrash}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {clearing ? 'Deleting…' : 'Delete All'}
          </button>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="In Trash"
          value={trashedCount}
          color="emerald"
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          )}
        />
        <StatCard title="Selected" value={selectedCount} color="primary"
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          )}
        />
        <StatCard title="On This Page" value={meetings.length} color="blue"
          icon={(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
            </svg>
          )}
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Search trash…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {!loading && meetings.length > 0 && (
        <div className="card mb-4 flex flex-wrap items-center gap-3 py-3 px-4">
          <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              checked={allOnPageSelected}
              ref={(el) => {
                if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
              }}
              onChange={toggleSelectAllPage}
            />
            Select all on this page
            {pageSelectedCount > 0 && (
              <span className="text-surface-500 font-normal">({pageSelectedCount} on page)</span>
            )}
          </label>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="btn-secondary py-1.5 px-3 text-sm"
              >
                Clear selection
              </button>
            )}
            <button
              type="button"
              onClick={handleBulkDeleteSelected}
              disabled={clearing || selectedCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Permanent Delete Selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">🗑</div>
          <p className="text-surface-500 font-medium">Trash is empty</p>
          <p className="text-sm text-surface-400 mt-2">Meetings move here when they finish</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard
              key={m._id}
              meeting={m}
              isCEO={isCEO}
              inTrash
              canDeleteFromTrash
              selectable
              selected={selectedIds.has(m._id)}
              onSelectChange={toggleSelect}
              onDelete={handleDelete}
              onRestore={isCEO ? handleRestore : undefined}
            />
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
    </div>
  );
};

export default MeetingTrashPage;
