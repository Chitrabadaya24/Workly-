import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { meetingAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import { CEOStatusBadge } from '../../components/common/Badges';
import toast from 'react-hot-toast';
import { toCalendarDateString } from '../../utils/calendarDate';

const URGENCY_OPTIONS = [
  {
    value: 'low',
    label: 'Low',
    icon: '🟢',
    desc: 'No time pressure. Can wait for availability.',
    color: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400',
    active: 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900',
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: '🟡',
    desc: 'Should happen within the week.',
    color: 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400',
    active: 'border-yellow-500 ring-2 ring-yellow-200 dark:ring-yellow-900',
  },
  {
    value: 'high',
    label: 'High',
    icon: '🔴',
    desc: 'Needs attention soon — within 1-2 days.',
    color: 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400',
    active: 'border-orange-500 ring-2 ring-orange-200 dark:ring-orange-900',
  },
  {
    value: 'emergency',
    label: 'Emergency',
    icon: '🚨',
    desc: 'Critical. Uses 1 emergency token.',
    color: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400',
    active: 'border-red-500 ring-2 ring-red-200 dark:ring-red-900',
  },
];

const NewRequestPage = ({ ceoStatus }) => {
  const { user, updateUserData } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    purpose: '',
    agenda: '',
    urgency: 'low',
    preferredDate: '',
    preferredTime: '09:00',
    duration: 30,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState([]);

  const isBlocked = (
    (ceoStatus === 'deep_work' || ceoStatus === 'emergency_only') &&
    form.urgency !== 'emergency'
  );

  const noTokens = form.urgency === 'emergency' && (user?.emergencyTokens ?? 0) <= 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.purpose || !form.agenda || !form.preferredDate) {
      return toast.error('Please fill in all required fields');
    }
    if (isBlocked) return toast.error('CEO is in restricted mode. Only emergency requests allowed.');
    if (noTokens) return toast.error('You have no emergency tokens left.');

    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => formData.append(key, String(val)));
      files.forEach((file) => formData.append('files', file));
      await meetingAPI.create(formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Deduct token from local state immediately if emergency
      if (form.urgency === 'emergency') {
        updateUserData({ emergencyTokens: (user?.emergencyTokens ?? 1) - 1 });
      }
      toast.success('Meeting request submitted!');
      navigate('/employee/my-requests');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = toCalendarDateString(new Date());

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title="New Meeting Request"
        subtitle="Submit a structured request to the CEO"
      />

      {/* CEO Status Banner */}
      <div className="flex items-center gap-3 p-4 bg-surface-50 dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 mb-6">
        <span className="text-sm text-surface-500 dark:text-surface-400">CEO is currently:</span>
        <CEOStatusBadge status={ceoStatus} />
        {(ceoStatus === 'deep_work' || ceoStatus === 'emergency_only') && (
          <span className="ml-auto text-xs text-amber-600 font-medium">⚠️ Emergency requests only</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div className="card">
          <h3 className="font-semibold text-surface-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Basic Info</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Meeting Title *</label>
              <input className="input" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Q4 Budget Review Discussion" required />
            </div>
            <div>
              <label className="label">Purpose *</label>
              <textarea className="input resize-none" rows={2} value={form.purpose}
                onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}
                placeholder="Why is this meeting necessary?" required />
            </div>
            <div>
              <label className="label">Agenda *</label>
              <textarea className="input resize-none" rows={3} value={form.agenda}
                onChange={e => setForm(p => ({ ...p, agenda: e.target.value }))}
                placeholder="List the key discussion points and expected outcomes..." required />
            </div>
          </div>
        </div>

        {/* Urgency */}
        <div className="card">
          <h3 className="font-semibold text-surface-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Urgency Level</h3>
          <div className="grid grid-cols-2 gap-3">
            {URGENCY_OPTIONS.map(opt => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setForm(p => ({ ...p, urgency: opt.value }))}
                className={`border-2 rounded-xl p-3 text-left transition-all ${
                  form.urgency === opt.value
                    ? `${opt.color} ${opt.active}`
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{opt.icon}</span>
                  <span className="font-semibold text-sm text-surface-900 dark:text-white">{opt.label}</span>
                  {form.urgency === opt.value && <span className="ml-auto text-primary-600">✓</span>}
                </div>
                <p className="text-xs text-surface-500">{opt.desc}</p>
                {opt.value === 'emergency' && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    Tokens: {user?.emergencyTokens ?? 0}/3 remaining
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div className="card">
          <h3 className="font-semibold text-surface-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Preferred Schedule</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3 sm:col-span-1">
              <label className="label">Preferred Date *</label>
              <input className="input" type="date" min={minDate} value={form.preferredDate}
                onChange={e => setForm(p => ({ ...p, preferredDate: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Preferred Time *</label>
              <input className="input" type="time" value={form.preferredTime}
                onChange={e => setForm(p => ({ ...p, preferredTime: e.target.value }))} />
            </div>
            <div>
              <label className="label">Duration</label>
              <select className="input" value={form.duration}
                onChange={e => setForm(p => ({ ...p, duration: Number(e.target.value) }))}>
                {[15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <h3 className="font-semibold text-surface-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Additional Notes</h3>
          <textarea className="input resize-none" rows={3} value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Any additional context, documents, or pre-reading materials..." />
        </div>

        {/* Attachments */}
        <div className="card">
          <h3 className="font-semibold text-surface-900 dark:text-white mb-2 text-sm uppercase tracking-wide">Attachments</h3>
          <p className="text-xs text-surface-500 mb-3">Optional — PDF, PNG, JPG, or DOCX (max 3 files, 5 MB each)</p>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.docx,.doc"
            multiple
            className="input text-sm"
            onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 3))}
          />
          {files.length > 0 && (
            <ul className="mt-2 text-xs text-surface-600 dark:text-surface-400 space-y-1">
              {files.map((f) => (
                <li key={f.name}>📎 {f.name}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Warnings */}
        {isBlocked && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">⚠️ CEO is in restricted mode</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Select Emergency urgency and use a token to bypass restrictions.</p>
          </div>
        )}
        {noTokens && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">🚫 No emergency tokens remaining</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">You have used all your emergency override tokens for this period.</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/employee')}>Cancel</button>
          <button
            type="submit"
            disabled={submitting || isBlocked || noTokens}
            className="btn-primary px-6 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewRequestPage;
