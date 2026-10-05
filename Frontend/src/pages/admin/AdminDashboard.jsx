import { Routes, Route, Navigate } from 'react-router-dom';
import SidebarLayout from '../../layouts/SidebarLayout';
import AdminHome from './AdminHome';
import UsersPage from './UsersPage';
import AnalyticsPage from './AnalyticsPage';
import ProfileSettings from '../../components/common/ProfileSettings';
import NotificationBell from '../../components/notifications/NotificationBell';
import MessagesPanel from '../../components/chat/MessagesPanel';
import MeetingsPage from '../ceo/MeetingsPage';
import MeetingTrashPage from '../shared/MeetingTrashPage';
import AuditLogPage from './AuditLogPage';
import TeamViewPage from '../shared/TeamViewPage';
import { MEETINGS_NAV_ICON, MEETING_TRASH_NAV_ICON } from '../../components/meetings/meetingNavIcons';
import { useMeetingTrashCount } from '../../hooks/useMeetingTrashCount';

const AdminDashboard = () => {
  const trashCount = useMeetingTrashCount();

  const navItems = [
  {
    path: '/admin',
    end: true,
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    path: '/admin/users',
    label: 'User Management',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    path: '/admin/analytics',
    label: 'Analytics',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    path: '/admin/team',
    label: 'Team View',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    path: '/admin/audit',
    label: 'Audit Log',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    path: '/admin/meetings',
    label: 'Meetings',
    icon: MEETINGS_NAV_ICON,
  },
  {
    path: '/admin/meeting-trash',
    label: 'Trash',
    badge: trashCount,
    icon: MEETING_TRASH_NAV_ICON,
  },
  {
    path: '/admin/profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

  return (
  <SidebarLayout navItems={navItems} title="Admin">
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="h-16 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 flex items-center justify-end px-6 flex-shrink-0 gap-1">
        <MessagesPanel />
        <NotificationBell />
      </header>
      <div className="flex-1 overflow-auto p-6">
        <Routes>
          <Route index element={<AdminHome />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="team" element={<TeamViewPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="meeting-trash" element={<MeetingTrashPage />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  </SidebarLayout>
  );
};

export default AdminDashboard;
