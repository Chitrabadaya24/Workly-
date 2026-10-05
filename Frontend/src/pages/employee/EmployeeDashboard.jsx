import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SidebarLayout from '../../layouts/SidebarLayout';
import EmployeeHome from './EmployeeHome';
import NewRequestPage from './NewRequestPage';
import MyRequestsPage from './MyRequestsPage';
import EmployeeMessagesPage from './EmployeeMessagesPage';
import ProfileSettings from '../../components/common/ProfileSettings';
import NotificationBell from '../../components/notifications/NotificationBell';
import MessagesPanel from '../../components/chat/MessagesPanel';
import { availabilityAPI } from '../../services/apiService';
import { CEOStatusBadge } from '../../components/common/Badges';
import { getSocket } from '../../socket/socket';
import MeetingsPage from '../ceo/MeetingsPage';
import MeetingTrashPage from '../shared/MeetingTrashPage';
import TeamCalendarPage, { CALENDAR_ICON } from '../shared/TeamCalendarPage';
import TodoPanel from '../../components/todo/TodoPanel';
import { MEETINGS_NAV_ICON, MEETING_TRASH_NAV_ICON } from '../../components/meetings/meetingNavIcons';
import { useMeetingTrashCount } from '../../hooks/useMeetingTrashCount';

const EmployeeDashboard = () => {
  const [ceoStatus, setCeoStatus] = useState('available');
  const trashCount = useMeetingTrashCount();

  useEffect(() => {
    availabilityAPI.get()
      .then(({ data }) => setCeoStatus(data.availability?.status || 'available'))
      .catch(() => {});

    const socket = getSocket();
    if (socket) {
      socket.on('ceo_status_changed', ({ status }) => setCeoStatus(status));
      return () => socket.off('ceo_status_changed');
    }
  }, []);

  const navItems = [
    {
      path: '/employee', end: true, label: 'Dashboard',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    },
    {
      path: '/employee/new-request', label: 'New Request',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    },
    {
      path: '/employee/my-requests', label: 'My Requests',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
      path: '/employee/calendar', label: 'Calendar',
      icon: CALENDAR_ICON,
    },
    {
      path: '/employee/messages', label: 'Meeting discussions',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    },
    {
      path: '/employee/profile', label: 'Profile',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    },
    {
      path: '/employee/meetings', label: 'Meetings',
      icon: MEETINGS_NAV_ICON,
    },
    {
      path: '/employee/meeting-trash', label: 'Trash', badge: trashCount,
      icon: MEETING_TRASH_NAV_ICON,
    },
  ];

  return (
    <SidebarLayout navItems={navItems} title="Employee">
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-surface-500 dark:text-surface-400">CEO Status:</span>
            <CEOStatusBadge status={ceoStatus} />
          </div>
          <div className="flex items-center gap-1">
            <TodoPanel />
            <MessagesPanel />
            <NotificationBell />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <Routes>
            <Route index element={<EmployeeHome ceoStatus={ceoStatus} />} />
            <Route path="new-request" element={<NewRequestPage ceoStatus={ceoStatus} />} />
            <Route path="my-requests" element={<MyRequestsPage />} />
            <Route path="calendar" element={<TeamCalendarPage />} />
            <Route path="messages" element={<EmployeeMessagesPage />} />
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="meetings" element={<MeetingsPage />} />
            <Route path="meeting-trash" element={<MeetingTrashPage />} />
            <Route path="*" element={<Navigate to="/employee" replace />} />
          </Routes>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default EmployeeDashboard;
