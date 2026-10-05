import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SidebarLayout from '../../layouts/SidebarLayout';
import CEOHome from './CEOHome';
import CEORequestsPage from './CEORequestsPage';
import CEOCalendarPage from './CEOCalendarPage';
import CEOMessagesPage from './CEOMessagesPage';
import ProfileSettings from '../../components/common/ProfileSettings';
import NotificationBell from '../../components/notifications/NotificationBell';
import MessagesPanel from '../../components/chat/MessagesPanel';
import { availabilityAPI } from '../../services/apiService';
import { CEOStatusBadge } from '../../components/common/Badges';
import { getSocket } from '../../socket/socket';
import toast from 'react-hot-toast';
import MeetingsPage from './MeetingsPage';
import MeetingTrashPage from '../shared/MeetingTrashPage';
import TeamViewPage from '../shared/TeamViewPage';
import TodoPanel from '../../components/todo/TodoPanel';
import { MEETINGS_NAV_ICON, MEETING_TRASH_NAV_ICON } from '../../components/meetings/meetingNavIcons';
import { useMeetingTrashCount } from '../../hooks/useMeetingTrashCount';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', dot: 'status-available' },
  { value: 'in_meeting', label: 'In Meeting', dot: 'status-in_meeting' },
  { value: 'deep_work', label: 'Deep Work (DND)', dot: 'status-deep_work' },
  { value: 'emergency_only', label: 'Emergency Only', dot: 'status-emergency_only' },
  { value: 'offline', label: 'Offline', dot: 'status-offline' },
];

const CEODashboard = () => {
  const [status, setStatus] = useState('available');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const trashCount = useMeetingTrashCount();

  useEffect(() => {
    availabilityAPI.get().then(({ data }) => {
      setStatus(data.availability?.status || 'available');
    }).catch(() => {});

    // Listen for count updates from socket
    const socket = getSocket();
    if (socket) {
      socket.on('new_notification', () => {
        setPendingCount(p => p + 1);
      });
    }
  }, []);

  const handleStatusChange = async (newStatus) => {
    try {
      await availabilityAPI.update({ status: newStatus });
      setStatus(newStatus);
      setShowStatusMenu(false);
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const navItems = [
    {
      path: '/ceo', end: true, label: 'Dashboard',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    },
    {
      path: '/ceo/requests', label: 'Meeting Requests', badge: pendingCount,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
      path: '/ceo/calendar', label: 'Calendar',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
      path: '/ceo/team', label: 'Team View',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      path: '/ceo/messages', label: 'Meeting discussions',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    },
    {
      path: '/ceo/profile', label: 'Profile',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    },
    {
      path: '/ceo/meetings', label: 'Meetings',
      icon: MEETINGS_NAV_ICON,
    },
    {
      path: '/ceo/meeting-trash', label: 'Trash', badge: trashCount,
      icon: MEETING_TRASH_NAV_ICON,
    },
  ];

  return (
    <SidebarLayout navItems={navItems} title="CEO">
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between px-6 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors border border-surface-200 dark:border-surface-700"
            >
              <CEOStatusBadge status={status} />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showStatusMenu && (
              <div className="absolute top-11 left-0 w-52 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors text-left ${status === opt.value ? 'text-primary-600 font-medium' : 'text-surface-700 dark:text-surface-300'}`}
                  >
                    <span className={`status-dot ${opt.dot}`} />
                    {opt.label}
                    {status === opt.value && <span className="ml-auto text-primary-600">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <TodoPanel />
            <MessagesPanel />
            <NotificationBell />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <Routes>
            <Route index element={<CEOHome currentStatus={status} />} />
            <Route path="requests" element={<CEORequestsPage onPendingLoad={setPendingCount} />} />
            <Route path="calendar" element={<CEOCalendarPage />} />
            <Route path="team" element={<TeamViewPage />} />
            <Route path="messages" element={<CEOMessagesPage />} />
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="meetings" element={<MeetingsPage />} />
            <Route path="meeting-trash" element={<MeetingTrashPage />} />
            <Route path="*" element={<Navigate to="/ceo" replace />} />
          </Routes>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default CEODashboard;
