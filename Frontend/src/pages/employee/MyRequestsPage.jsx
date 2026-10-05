import { useState, useEffect, useCallback } from 'react';
import { meetingAPI } from '../../services/apiService';
import PageHeader from '../../components/common/PageHeader';
import Modal from '../../components/common/Modal';
import { StatusBadge, UrgencyBadge } from '../../components/common/Badges';
import MessageThread from '../../components/messages/MessageThread';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';

const MyRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await meetingAPI.getMy({ status: statusFilter, page, limit: 15 });
      setRequests(data.requests);
      setTotal(data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (req) => {
    try {
      const { data } = await meetingAPI.getOne(req._id);
      setSelected(data.request);
      setShowDetail(true);
    } catch {}
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My Requests"
        subtitle={`${total} total meeting requests`}
        actions={
          <Link to="/employee/new-request" className="btn-primary flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Request
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {['', 'pending', 'approved', 'rejected', 'completed'].map(s => (
          <button key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700'
            }`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-surface-500 font-medium mb-3">No requests found</p>
          <Link to="/employee/new-request" className="btn-primary">Submit a Request</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req._id} className="card hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4">
                {/* Date block */}
                <div className="w-12 text-center flex-shrink-0">
                  <div className={`rounded-xl p-2 ${
                    req.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                    req.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' :
                    req.status === 'completed' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    'bg-amber-100 dark:bg-amber-900/30'
                  }`}>
                    <p className="text-[10px] font-semibold uppercase opacity-70">
                      {format(new Date(req.preferredDate), 'MMM')}
                    </p>
                    <p className="text-lg font-display font-bold leading-none">
                      {format(new Date(req.preferredDate), 'd')}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-surface-900 dark:text-white truncate">{req.title}</h3>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {req.preferredTime} · {req.duration || 30} min ·{' '}
                        {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <UrgencyBadge urgency={req.urgency} />
                      <StatusBadge status={req.status} />
                    </div>
                  </div>

                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-2 line-clamp-1">{req.purpose}</p>

                  {/* Feedback */}
                  {req.rejectionReason && (
                    <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <p className="text-xs text-red-600 dark:text-red-400">
                        <strong>Rejected:</strong> {req.rejectionReason}
                      </p>
                      {req.ceoComment && <p className="text-xs text-red-500 mt-0.5">💡 {req.ceoComment}</p>}
                    </div>
                  )}
                  {req.status === 'approved' && req.approvedDate && (
                    <div className="mt-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        ✅ <strong>Approved for:</strong> {format(new Date(req.approvedDate), 'MMM d, yyyy')} at {req.approvedTime}
                      </p>
                      {req.ceoComment && <p className="text-xs text-emerald-600 mt-0.5">{req.ceoComment}</p>}
                    </div>
                  )}
                  {req.status === 'completed' && req.meetingSummary && (
                    <div className="mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        🏁 <strong>Summary:</strong> {req.meetingSummary}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => openDetail(req)} className="btn-ghost text-xs py-1 px-2">
                      View Details
                    </button>
                    <button
                      onClick={() => { setSelected(req); setShowThread(true); }}
                      className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      Message
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 15 && (
        <div className="flex justify-center gap-2 mt-6">
          <button className="btn-secondary py-1.5 px-4 text-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Prev</button>
          <span className="flex items-center px-3 text-sm text-surface-500">Page {page}</span>
          <button className="btn-secondary py-1.5 px-4 text-sm" onClick={() => setPage(p => p + 1)} disabled={page * 15 >= total}>Next →</button>
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="Request Details" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <UrgencyBadge urgency={selected.urgency} />
              <StatusBadge status={selected.status} />
              {selected.isEmergencyToken && <span className="badge bg-red-100 text-red-700">🚨 Emergency Token Used</span>}
            </div>
            {[
              { label: 'Title', value: selected.title },
              { label: 'Purpose', value: selected.purpose },
              { label: 'Agenda', value: selected.agenda },
              { label: 'Preferred Date', value: `${format(new Date(selected.preferredDate), 'MMMM d, yyyy')} at ${selected.preferredTime}` },
              { label: 'Duration', value: `${selected.duration || 30} minutes` },
              selected.notes && { label: 'Notes', value: selected.notes },
            ].filter(Boolean).map(({ label, value }) => (
              <div key={label} className="p-3 bg-surface-50 dark:bg-surface-800 rounded-xl">
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-sm text-surface-900 dark:text-white">{value}</p>
              </div>
            ))}
            {selected.decisions?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Decisions</p>
                <div className="space-y-2">
                  {selected.decisions.map((d, i) => (
                    <div key={i} className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                      <p className="text-sm text-surface-900 dark:text-white">{d.decision}</p>
                      {d.deadline && <p className="text-xs text-surface-500 mt-1">Deadline: {format(new Date(d.deadline), 'MMM d, yyyy')}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Message Thread Modal */}
      <Modal isOpen={showThread} onClose={() => setShowThread(false)} title={`Thread: ${selected?.title}`} size="lg">
        <div style={{ height: '400px' }}>
          <MessageThread requestId={selected?._id} />
        </div>
      </Modal>
    </div>
  );
};

export default MyRequestsPage;
