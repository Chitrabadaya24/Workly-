import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { meetAPI, userAPI } from '../../services/apiService';
import toast from 'react-hot-toast';
import api from '../../services/api';

const CreateMeetingModal = ({ isOpen, onClose, onCreated, editData }) => {
  const [form, setForm] = useState({
    title: '', description: '', date: '', time: '09:00', duration: 30, participants: [],
  });
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [generateLink, setGenerateLink] = useState(true);

  useEffect(() => {
    if (isOpen) {
      api.get('/users/participants').then(({ data }) => {
            setUsers(data.users);
        }).catch(() => {});

      if (editData) {
        setForm({
          title: editData.title || '',
          description: editData.description || '',
          date: editData.date?.split('T')[0] || '',
          time: editData.time || '09:00',
          duration: editData.duration || 30,
          participants: editData.participants?.map(p => p._id || p) || [],
        });
      } else {
        setForm({ title: '', description: '', date: '', time: '09:00', duration: 30, participants: [] });
      }
    }
  }, [isOpen, editData]);

  const toggleParticipant = (id) => {
    setForm(p => ({
      ...p,
      participants: p.participants.includes(id)
        ? p.participants.filter(x => x !== id)
        : [...p.participants, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.time) return toast.error('Fill required fields');
    if (form.participants.length === 0) return toast.error('Select at least one participant');
    setSaving(true);
    try {
      if (editData) {
        const { data } = await meetAPI.update(editData._id, form);
        toast.success('Meeting updated');
        onCreated(data.meeting);
      } else {
        const { data } = await meetAPI.create({ ...form, generateLink });
        toast.success(`Meeting created! 🎉 Link: ${data.meeting.meetLink}`);
        onCreated(data.meeting);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? '✏️ Edit Meeting' : '📅 Schedule New Meeting'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title & Description */}
        <div>
          <label className="label">Meeting Title *</label>
          <input className="input" value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Q4 Strategy Review" required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={2} value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Agenda or notes..." />
        </div>

        {/* Date Time Duration */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" min={minDate} value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Time *</label>
            <input className="input" type="time" value={form.time}
              onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
          </div>
          <div>
            <label className="label">Duration</label>
            <select className="input" value={form.duration}
              onChange={e => setForm(p => ({ ...p, duration: Number(e.target.value) }))}>
              {[15, 30, 45, 60, 90, 120].map(d => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </div>
        </div>

        {/* Meet Link Preview */}
        {!editData && (
            <div className="border border-surface-200 dark:border-surface-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    🔗 Google Meet Link
                </p>
                {/* Toggle switch */}
                <button
                    type="button"
                    onClick={() => setGenerateLink(!generateLink)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    generateLink ? 'bg-primary-600' : 'bg-surface-300'
                    }`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    generateLink ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                </button>
                </div>

                {generateLink ? (
                <div className="p-3 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 rounded-xl">
                    <p className="text-xs text-primary-600 font-medium mb-1">✅ Link auto-generate hoga</p>
                    <p className="text-xs font-mono text-primary-500">https://meet.google.com/xxx-xxxx-xxx</p>
                </div>
                ) : (
                <div className="p-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl">
                    <p className="text-xs text-surface-500">📅 Sirf meeting schedule hogi — koi Meet link nahi banega</p>
                </div>
                )}
            </div>
            )}

        {/* Participants */}
        <div>
          <label className="label">
            Participants * ({form.participants.length} selected)
          </label>
          <input className="input mb-2" placeholder="🔍 Search users..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className="max-h-44 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-xl divide-y divide-surface-50 dark:divide-surface-800">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-surface-400 text-sm py-4">No users found</p>
            ) : filteredUsers.map(u => (
              <label key={u._id}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors ${
                  form.participants.includes(u._id) ? 'bg-primary-50 dark:bg-primary-950/20' : ''
                }`}>
                <input type="checkbox" checked={form.participants.includes(u._id)}
                  onChange={() => toggleParticipant(u._id)} className="accent-primary-600" />
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                  u.role === 'ceo' ? 'bg-amber-500' : 'bg-primary-500'
                }`}>
                  {u.fullName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{u.fullName}</p>
                  <p className="text-xs text-surface-500">@{u.username} · {u.department || u.role}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              : <>{editData ? '💾 Update' : '📅 Schedule & Generate Link'}</>
            }
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateMeetingModal;