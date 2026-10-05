import { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { meetingAPI, availabilityAPI, meetAPI } from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { getSocket } from '../../socket/socket';
import { buildCalendarEventStart, toCalendarDateString } from '../../utils/calendarDate';

const REQUEST_COLORS = {
  approved: { bg: '#4f46e5', border: '#4338ca' },
  pending: { bg: '#f59e0b', border: '#d97706' },
  rejected: { bg: '#94a3b8', border: '#64748b' },
  completed: { bg: '#10b981', border: '#059669' },
};

const REQUEST_PREFIX = {
  approved: '📅',
  pending: '⏳',
  rejected: '✗',
  completed: '✓',
};

function mapRequestToEvent(req) {
  const isApproved = req.status === 'approved' || req.status === 'completed';
  const date = isApproved ? (req.approvedDate || req.preferredDate) : req.preferredDate;
  const time = isApproved ? (req.approvedTime || req.preferredTime) : req.preferredTime;
  const start = buildCalendarEventStart(date, time);
  if (!start) return null;

  const colors = REQUEST_COLORS[req.status] || REQUEST_COLORS.pending;
  const prefix = REQUEST_PREFIX[req.status] || '📅';

  return {
    id: `req_${req._id}`,
    title: `${prefix} ${req.title}`,
    start,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    extendedProps: { type: 'meeting_request', data: req },
  };
}

function mapVideoToEvent(meet) {
  const start = buildCalendarEventStart(meet.date, meet.time);
  const dateStr = toCalendarDateString(meet.date);
  if (!start || !dateStr) return null;

  const color =
    meet.status === 'live' ? '#ef4444' :
    meet.status === 'completed' ? '#10b981' :
    '#f59e0b';

  return {
    id: `video_${meet._id}`,
    title: `📹 ${meet.title}`,
    start,
    end: new Date(new Date(start).getTime() + (meet.duration || 30) * 60000).toISOString(),
    backgroundColor: color,
    borderColor: color,
    extendedProps: { type: 'video_meeting', data: meet },
  };
}

const CALENDAR_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export { CALENDAR_ICON };

export default function TeamCalendarPage() {
  const { user } = useAuth();
  const role = user?.role;
  const isCEO = role === 'ceo';
  const isAdmin = role === 'admin';
  const isEmployee = role === 'employee';

  const [events, setEvents] = useState([]);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [focusForm, setFocusForm] = useState({
    title: '',
    startTime: '',
    endTime: '',
    type: 'deep_work',
    recurrence: {
      enabled: false,
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1, 2, 3, 4, 5],
      endDate: '',
    },
  });
  const [saving, setSaving] = useState(false);

  const subtitle = isCEO
    ? 'Manage your schedule, focus blocks and meetings'
    : isAdmin
    ? 'All team meetings and video calls in one place'
    : 'Your meeting requests and scheduled video calls';

  const loadEvents = useCallback(async () => {
    try {
      const requestParams = isCEO
        ? { status: 'approved', limit: 100 }
        : { limit: 100 };

      const promises = [
        isEmployee ? meetingAPI.getMy(requestParams) : meetingAPI.getAll(requestParams),
        meetAPI.getAll({ limit: 100 }),
      ];

      if (isCEO) promises.push(availabilityAPI.get());

      const [requestsRes, videoRes, availRes] = await Promise.all(promises);

      const meetingEvents = (requestsRes.data.requests || [])
        .map(mapRequestToEvent)
        .filter(Boolean);

      const videoEvents = (videoRes.data.meetings || [])
        .map(mapVideoToEvent)
        .filter(Boolean);

      const focusEvents = isCEO
        ? (availRes?.data?.availability?.focusBlocks || []).map((block) => ({
            id: block._id,
            title: block.type === 'deep_work' ? `🧠 ${block.title}` : `⏸ ${block.title}`,
            start: block.startTime,
            end: block.endTime,
            backgroundColor: block.type === 'deep_work' ? '#6366f1' : '#94a3b8',
            borderColor: block.type === 'deep_work' ? '#4f46e5' : '#64748b',
            extendedProps: { type: 'focus', blockId: block._id, parentSeriesId: block.parentSeriesId },
          }))
        : [];

      setEvents([...meetingEvents, ...focusEvents, ...videoEvents]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load calendar');
    }
  }, [isCEO, isEmployee]);

  useEffect(() => {
    loadEvents();
    const socket = getSocket();
    if (!socket) return undefined;

    const refresh = () => loadEvents();
    socket.on('new_meeting', refresh);
    socket.on('meeting_updated', refresh);
    socket.on('meeting_deleted', refresh);
    socket.on('focus_blocks_updated', refresh);

    return () => {
      socket.off('new_meeting', refresh);
      socket.off('meeting_updated', refresh);
      socket.off('meeting_deleted', refresh);
      socket.off('focus_blocks_updated', refresh);
    };
  }, [loadEvents]);

  const handleDateSelect = (selectInfo) => {
    if (!isCEO) return;
    setFocusForm({
      title: 'Focus Block',
      startTime: selectInfo.startStr,
      endTime: selectInfo.endStr || selectInfo.startStr,
      type: 'deep_work',
      recurrence: {
        enabled: false,
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 2, 3, 4, 5],
        endDate: '',
      },
    });
    setShowFocusModal(true);
  };

  const handleAddFocusBlock = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...focusForm,
        recurrence: focusForm.recurrence.enabled
          ? {
              ...focusForm.recurrence,
              endDate: focusForm.recurrence.endDate || undefined,
            }
          : { enabled: false },
      };
      await availabilityAPI.addFocusBlock(payload);
      toast.success(focusForm.recurrence.enabled ? 'Recurring focus blocks added' : 'Focus block added');
      setShowFocusModal(false);
      loadEvents();
    } catch {
      toast.error('Failed to add focus block');
    } finally {
      setSaving(false);
    }
  };

  const handleEventClick = async (clickInfo) => {
    const { type, blockId, parentSeriesId, data } = clickInfo.event.extendedProps;

    if (type === 'focus' && isCEO) {
      if (!confirm(`Remove focus block "${clickInfo.event.title}"?`)) return;
      let scope = 'this';
      if (parentSeriesId && confirm('Remove the entire recurring series?')) {
        scope = 'series';
      }
      try {
        await availabilityAPI.removeFocusBlock(blockId, { scope });
        toast.success('Focus block removed');
        loadEvents();
      } catch {
        toast.error('Failed to remove focus block');
      }
      return;
    }

    if (type === 'meeting_request') {
      const req = data;
      const date = req.approvedDate || req.preferredDate;
      const time = req.approvedTime || req.preferredTime;
      const lines = [
        `${REQUEST_PREFIX[req.status] || '📅'} ${req.title}`,
        `Status: ${req.status}`,
        date ? `📅 ${new Date(date).toLocaleDateString()}${time ? ` at ${time}` : ''}` : null,
        req.requestedBy?.fullName ? `👤 ${req.requestedBy.fullName}` : null,
        req.purpose ? `📝 ${req.purpose}` : null,
      ].filter(Boolean);
      alert(lines.join('\n'));
      return;
    }

    if (type === 'video_meeting') {
      const meet = data;
      const info = [
        `📹 ${meet.title}`,
        `📅 ${new Date(meet.date).toLocaleDateString()} at ${meet.time}`,
        `⏱ ${meet.duration} min`,
        `👥 ${meet.participants?.length || 0} participants`,
        meet.meetLink ? `🔗 ${meet.meetLink}` : '📅 No meet link',
      ].join('\n');

      if (meet.meetLink && meet.status !== 'completed') {
        if (confirm(`${info}\n\nJoin meeting?`)) window.open(meet.meetLink, '_blank');
      } else {
        alert(info);
      }
    }
  };

  const legend = [
    ...(isCEO ? [
      { color: '#4f46e5', label: 'Approved Requests' },
      { color: '#6366f1', label: 'Deep Work' },
      { color: '#94a3b8', label: 'Unavailable' },
    ] : isAdmin ? [
      { color: '#4f46e5', label: 'Meeting Requests' },
      { color: '#f59e0b', label: 'Pending Requests' },
    ] : [
      { color: '#4f46e5', label: 'Approved Requests' },
      { color: '#f59e0b', label: 'Pending Requests' },
      { color: '#94a3b8', label: 'Rejected' },
    ]),
    { color: '#f59e0b', label: 'Scheduled Video' },
    { color: '#ef4444', label: 'Live Video' },
    { color: '#10b981', label: 'Completed Video' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Calendar"
        subtitle={subtitle}
        actions={isCEO ? (
          <button type="button" onClick={() => setShowFocusModal(true)} className="btn-primary flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Focus Block
          </button>
        ) : null}
      />

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {legend.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-surface-500">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: l.color }} />
            {l.label}
          </div>
        ))}
        <p className="text-xs text-surface-400 ml-auto">
          {isCEO ? 'Click a date to add focus block · Click event for details' : 'Click any event for details'}
        </p>
      </div>

      <div className="card p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          selectable={isCEO}
          selectMirror={isCEO}
          select={isCEO ? handleDateSelect : undefined}
          eventClick={handleEventClick}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="20:00:00"
          nowIndicator
          eventDisplay="block"
        />
      </div>

      {isCEO && (
        <Modal isOpen={showFocusModal} onClose={() => setShowFocusModal(false)} title="Add Focus Block" size="sm">
          <form onSubmit={handleAddFocusBlock} className="space-y-4">
            <div>
              <label className="label">Block Title</label>
              <input
                className="input"
                value={focusForm.title}
                onChange={(e) => setFocusForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Product Strategy Deep Work"
                required
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={focusForm.type}
                onChange={(e) => setFocusForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="deep_work">🧠 Deep Work (DND)</option>
                <option value="focus">🎯 Focus Time</option>
                <option value="unavailable">⏸ Unavailable</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={focusForm.startTime}
                  onChange={(e) => setFocusForm((p) => ({ ...p, startTime: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">End</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={focusForm.endTime}
                  onChange={(e) => setFocusForm((p) => ({ ...p, endTime: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="border-t border-surface-200 dark:border-surface-700 pt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-surface-900 dark:text-white mb-3">
                <input
                  type="checkbox"
                  checked={focusForm.recurrence.enabled}
                  onChange={(e) => setFocusForm((p) => ({
                    ...p,
                    recurrence: { ...p.recurrence, enabled: e.target.checked },
                  }))}
                />
                Repeat this block
              </label>
              {focusForm.recurrence.enabled && (
                <div className="space-y-3 pl-1">
                  <div>
                    <label className="label">Frequency</label>
                    <select
                      className="input"
                      value={focusForm.recurrence.frequency}
                      onChange={(e) => setFocusForm((p) => ({
                        ...p,
                        recurrence: { ...p.recurrence, frequency: e.target.value },
                      }))}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {focusForm.recurrence.frequency === 'weekly' && (
                    <div>
                      <label className="label">Days</label>
                      <div className="flex flex-wrap gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => (
                          <button
                            key={label}
                            type="button"
                            className={`px-2 py-1 rounded-lg text-xs border ${
                              focusForm.recurrence.daysOfWeek.includes(i)
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'border-surface-300 dark:border-surface-600'
                            }`}
                            onClick={() => setFocusForm((p) => {
                              const days = p.recurrence.daysOfWeek.includes(i)
                                ? p.recurrence.daysOfWeek.filter((d) => d !== i)
                                : [...p.recurrence.daysOfWeek, i].sort();
                              return { ...p, recurrence: { ...p.recurrence, daysOfWeek: days } };
                            })}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="label">Repeat until (optional)</label>
                    <input
                      className="input"
                      type="date"
                      value={focusForm.recurrence.endDate}
                      onChange={(e) => setFocusForm((p) => ({
                        ...p,
                        recurrence: { ...p.recurrence, endDate: e.target.value },
                      }))}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowFocusModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Block'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
