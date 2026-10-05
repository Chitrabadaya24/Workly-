import { useState, useEffect, useCallback } from 'react';
import { meetingAPI } from '../../services/apiService';
import PageHeader from '../../components/common/PageHeader';
import Modal from '../../components/common/Modal';
import { StatusBadge, UrgencyBadge } from '../../components/common/Badges';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import { getSocket } from '../../socket/socket';
import { toCalendarDateString } from '../../utils/calendarDate';
import RequestAttachments from '../../components/common/RequestAttachments';

const CEORequestsPage = ({ onPendingLoad }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [approveForm, setApproveForm] = useState({ ceoComment: '', approvedDate: '', approvedTime: '' });
  const [rejectForm, setRejectForm] = useState({ rejectionReason: '', ceoComment: '' });
  const [completeForm, setCompleteForm] = useState({ meetingSummary: '', decisions: [] });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await meetingAPI.getAll({ status: statusFilter, urgency: urgencyFilter, page, limit: 15 });
      setRequests(data.requests);
      setTotal(data.total);
      const pending = data.requests.filter(r => r.status === 'pending').length;
      if (onPendingLoad) onPendingLoad(pending);
    } catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); }
  }, [statusFilter, urgencyFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.on('new_notification', () => load());
      return () => socket.off('new_notification');
    }
  }, [load]);

  const handleApprove = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await meetingAPI.approve(selected._id, approveForm);
      toast.success('Meeting approved!');
      setShowApprove(false);
      load();
    } catch { toast.error('Failed to approve'); }
    finally { setSaving(false); }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await meetingAPI.reject(selected._id, rejectForm);
      toast.success('Request rejected');
      setShowReject(false);
      load();
    } catch { toast.error('Failed to reject'); }
    finally { setSaving(false); }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await meetingAPI.complete(selected._id, completeForm);
      toast.success('Meeting marked complete');
      setShowComplete(false);
      load();
    } catch { toast.error('Failed to complete'); }
    finally { setSaving(false); }
  };

  const openApprove = (req) => {
    setSelected(req);
    setApproveForm({
      ceoComment: '',
      approvedDate: toCalendarDateString(req.preferredDate) || '',
      approvedTime: req.preferredTime || '',
    });
    setShowApprove(true);
  };

  const openReject = (req) => {
    setSelected(req);
    setRejectForm({ rejectionReason: '', ceoComment: '' });
    setShowReject(true);
  };

  const openComplete = (req) => {
    setSelected(req);
    setCompleteForm({ meetingSummary: '', decisions: [] });
    setShowComplete(true);
  };

  const addDecision = () => {
    setCompleteForm(p => ({
      ...p,
      decisions: [...p.decisions, { decision: '', deadline: '', status: 'pending' }],
    }));
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Meeting Requests" subtitle={`${total} total requests`} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {['', 'pending', 'approved', 'rejected', 'completed'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              statusFilter === s
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <select
          className="input w-36 ml-auto"
          value={urgencyFilter}
          onChange={e => { setUrgencyFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Urgency</option>
          {['emergency', 'high', 'medium', 'low'].map(u => (
            <option key={u} value={u} className="capitalize">{u}</option>
          ))}
        </select>
      </div>

      {/* Requests list */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" /></div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-surface-500 font-medium">No requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req._id} className="card hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {req.requestedBy?.fullName?.charAt(0)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-surface-900 dark:text-white">{req.title}</h3>
                        {req.isEmergencyToken && (
                          <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">🚨 Emergency Token</span>
                        )}
                      </div>
                      <p className="text-sm text-surface-500 mt-0.5">
                        {req.requestedBy?.fullName} ({req.requestedBy?.department || 'No dept'}) ·{' '}
                        {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <UrgencyBadge urgency={req.urgency} />
                      <StatusBadge status={req.status} />
                    </div>
                  </div>

                  <p className="text-sm text-surface-600 dark:text-surface-400 mt-2 line-clamp-2">{req.purpose}</p>

                  <div className="flex items-center gap-4 mt-3 text-xs text-surface-400">
                    <span>📅 {format(new Date(req.preferredDate), 'MMM d, yyyy')} at {req.preferredTime}</span>
                    <span>⏱ {req.duration || 30} min</span>
                  </div>

                  <RequestAttachments requestId={req._id} attachments={req.attachments} />

                  {req.rejectionReason && (
                    <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900">
                      <p className="text-xs text-red-600 dark:text-red-400"><strong>Rejection reason:</strong> {req.rejectionReason}</p>
                    </div>
                  )}

                  {req.ceoComment && (
                    <div className="mt-2 px-3 py-2 bg-primary-50 dark:bg-primary-950/30 rounded-lg border border-primary-100 dark:border-primary-900">
                      <p className="text-xs text-primary-600 dark:text-primary-400"><strong>Your comment:</strong> {req.ceoComment}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openApprove(req)} className="btn-primary py-1.5 text-xs flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Approve
                      </button>
                      <button onClick={() => openReject(req)} className="btn-danger py-1.5 text-xs flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Reject
                      </button>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openComplete(req)} className="btn-secondary py-1.5 text-xs flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Mark Complete
                      </button>
                    </div>
                  )}
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

      {/* Approve Modal */}
      <Modal isOpen={showApprove} onClose={() => setShowApprove(false)} title="Approve Meeting Request">
        <div className="mb-4 p-3 bg-surface-50 dark:bg-surface-800 rounded-xl">
          <p className="font-medium text-surface-900 dark:text-white text-sm">{selected?.title}</p>
          <p className="text-xs text-surface-500 mt-0.5">Requested by {selected?.requestedBy?.fullName}</p>
        </div>
        <form onSubmit={handleApprove} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Approved Date</label>
              <input className="input" type="date" value={approveForm.approvedDate}
                onChange={e => setApproveForm(p => ({ ...p, approvedDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">Approved Time</label>
              <input className="input" type="time" value={approveForm.approvedTime}
                onChange={e => setApproveForm(p => ({ ...p, approvedTime: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Comment (optional)</label>
            <textarea className="input resize-none" rows={3} value={approveForm.ceoComment}
              onChange={e => setApproveForm(p => ({ ...p, ceoComment: e.target.value }))}
              placeholder="Add a comment for the employee..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowApprove(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Approving...' : '✅ Approve Meeting'}</button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={showReject} onClose={() => setShowReject(false)} title="Reject Meeting Request" size="sm">
        <form onSubmit={handleReject} className="space-y-4">
          <div>
            <label className="label">Rejection Reason *</label>
            <textarea className="input resize-none" rows={3} value={rejectForm.rejectionReason}
              onChange={e => setRejectForm(p => ({ ...p, rejectionReason: e.target.value }))}
              placeholder="Explain why this request is being rejected..." required />
          </div>
          <div>
            <label className="label">Suggestion / Comment</label>
            <textarea className="input resize-none" rows={2} value={rejectForm.ceoComment}
              onChange={e => setRejectForm(p => ({ ...p, ceoComment: e.target.value }))}
              placeholder="Suggest async communication or alternative..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowReject(false)}>Cancel</button>
            <button type="submit" className="btn-danger" disabled={saving}>{saving ? 'Rejecting...' : '❌ Reject Request'}</button>
          </div>
        </form>
      </Modal>

      {/* Complete Modal */}
      <Modal isOpen={showComplete} onClose={() => setShowComplete(false)} title="Complete Meeting" size="lg">
        <form onSubmit={handleComplete} className="space-y-4">
          <div>
            <label className="label">Meeting Summary *</label>
            <textarea className="input resize-none" rows={4} value={completeForm.meetingSummary}
              onChange={e => setCompleteForm(p => ({ ...p, meetingSummary: e.target.value }))}
              placeholder="Summarize what was discussed in this meeting..." required />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Decisions & Action Items</label>
              <button type="button" onClick={addDecision} className="btn-ghost text-xs py-1 px-2 text-primary-600">+ Add Decision</button>
            </div>
            {completeForm.decisions.map((d, i) => (
              <div key={i} className="p-3 bg-surface-50 dark:bg-surface-800 rounded-xl mb-2 space-y-2">
                <input className="input text-sm" value={d.decision}
                  onChange={e => {
                    const decisions = [...completeForm.decisions];
                    decisions[i].decision = e.target.value;
                    setCompleteForm(p => ({ ...p, decisions }));
                  }}
                  placeholder="Decision or action item..." />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input text-sm" type="date" value={d.deadline}
                    onChange={e => {
                      const decisions = [...completeForm.decisions];
                      decisions[i].deadline = e.target.value;
                      setCompleteForm(p => ({ ...p, decisions }));
                    }} />
                  <button type="button" className="btn-ghost text-xs text-red-500"
                    onClick={() => setCompleteForm(p => ({ ...p, decisions: p.decisions.filter((_, j) => j !== i) }))}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowComplete(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : '🏁 Complete Meeting'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CEORequestsPage;
