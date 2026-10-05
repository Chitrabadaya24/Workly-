import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { userAPI, authAPI } from '../services/apiService';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';

const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

const navLinkClass = (isActive, sidebarOpen) => {
  const base = `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${!sidebarOpen ? 'justify-center px-2' : ''}`;
  if (isActive) {
    return `${base} bg-gradient-to-r from-primary-500/20 to-accent-500/10 text-primary-300 shadow-sm before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-primary-400 before:to-accent-400`;
  }
  return `${base} text-surface-400 hover:bg-surface-800/80 hover:text-surface-100`;
};

const SidebarLayout = ({ navItems, navSections, children }) => {
  const { user, logout, updateUserData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { darkMode, toggleDarkMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [email, setEmail] = useState(user?.email || '');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const menuRef = useRef(null);

  const sections = navSections || [{ title: null, items: navItems || [] }];

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const openEmailModal = () => {
    setEmail(user?.email || '');
    setMenuOpen(false);
    setEmailModalOpen(true);
  };

  const openPasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMenuOpen(false);
    setPasswordModalOpen(true);
  };

  const handleEmailSave = async (e) => {
    e.preventDefault();
    if (!gmailRegex.test(email.trim())) {
      return toast.error('Email must be a valid @gmail.com address');
    }
    setSavingEmail(true);
    try {
      const { data } = await userAPI.updateProfile({
        fullName: user?.fullName,
        email: email.trim(),
        department: user?.department,
      });
      updateUserData(data.user);
      toast.success('Gmail updated successfully');
      setEmailModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update Gmail');
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    if (passwordForm.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setSavingPassword(true);
    try {
      await authAPI.updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswordModalOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const roleColors = {
    admin: 'from-violet-500 to-purple-600',
    ceo: 'from-amber-500 to-orange-600',
    employee: 'from-emerald-500 to-teal-600',
  };

  const roleLabels = {
    admin: 'Administrator',
    ceo: 'Chief Executive',
    employee: 'Employee',
  };

  const menuItemClass =
    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-surface-300 hover:bg-surface-800 hover:text-white transition-colors text-left';

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-surface-950 overflow-hidden">
      <aside
        className={`sidebar-panel flex flex-col flex-shrink-0 transition-all duration-300 border-r ${
          sidebarOpen ? 'w-[260px]' : 'w-[72px]'
        }`}
      >
        <div className="flex items-center h-16 px-3 border-b border-surface-800">
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex-shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60"
                aria-label="Minimize sidebar"
                title="Minimize sidebar"
              >
                <img
                  src={logo}
                  alt="Workly"
                  className="h-11 w-11 rounded-xl object-cover object-top shadow-lg shadow-primary-500/20 cursor-pointer hover:opacity-90 transition-opacity"
                />
              </button>
              <div className="min-w-0">
                <p className="font-display font-bold text-sm text-white truncate">
                  Work<span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">ly</span>
                </p>
                <p className="text-[10px] text-surface-500 uppercase tracking-wider">Workspace</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mx-auto rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60"
              aria-label="Maximize sidebar"
              title="Maximize sidebar"
            >
              <img
                src={logo}
                alt="Workly"
                className="h-9 w-9 rounded-xl object-cover object-top cursor-pointer hover:opacity-90 transition-opacity"
              />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {sections.map((section) => (
            <div key={section.title || 'default'}>
              {sidebarOpen && section.title && (
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-surface-500">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) => navLinkClass(isActive, sidebarOpen)}
                    title={!sidebarOpen ? item.label : ''}
                  >
                    <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                    {sidebarOpen && item.badge > 0 && (
                      <span className="ml-auto bg-gradient-to-r from-primary-500 to-primary-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-surface-800 p-3 relative" ref={menuRef}>
          {menuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-surface-700 bg-surface-900 shadow-xl shadow-black/40 p-1.5 z-50">
              <button type="button" onClick={openEmailModal} className={menuItemClass}>
                <span className="w-5 h-5 flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <span>Change Gmail</span>
              </button>

              <button type="button" onClick={openPasswordModal} className={menuItemClass}>
                <span className="w-5 h-5 flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <span>Change Password</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleDarkMode();
                }}
                className={menuItemClass}
              >
                <span className="w-5 h-5 flex-shrink-0">
                  {darkMode ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </span>
                <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
              </button>

              <div className="my-1 border-t border-surface-800" />

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors text-left"
              >
                <span className="w-5 h-5 flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span>Logout</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors hover:bg-surface-800 ${
              menuOpen ? 'bg-surface-800' : ''
            } ${!sidebarOpen ? 'justify-center px-2' : ''}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={!sidebarOpen ? user?.fullName : undefined}
          >
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${roleColors[user?.role]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
            >
              {user?.fullName?.charAt(0)}
            </div>
            {sidebarOpen && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold text-white truncate">{user?.fullName}</p>
                  <p className="text-xs text-surface-500">{roleLabels[user?.role]}</p>
                </div>
                <svg
                  className={`w-4 h-4 text-surface-500 flex-shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gradient-to-br from-surface-50 via-white to-primary-50/20 dark:from-surface-950 dark:via-surface-950 dark:to-primary-950/20 text-surface-900 dark:text-surface-100">
        {children}
      </main>

      {emailModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setEmailModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display font-semibold text-lg text-surface-900 dark:text-white mb-1">Change Gmail</h2>
            <p className="text-sm text-surface-500 mb-4">Update the Gmail address on your account.</p>
            <form onSubmit={handleEmailSave} className="space-y-4">
              <div>
                <label className="label">Gmail</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  pattern="^[A-Za-z0-9._%+]+@gmail\.com$"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEmailModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={savingEmail}>
                  {savingEmail ? 'Saving...' : 'Save Gmail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setPasswordModalOpen(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display font-semibold text-lg text-surface-900 dark:text-white mb-1">Change Password</h2>
            <p className="text-sm text-surface-500 mb-4">Enter your current password, then choose a new one.</p>
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <input
                  className="input"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div>
                <label className="label">New Password</label>
                <input
                  className="input"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input
                  className="input"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Repeat new password"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setPasswordModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={savingPassword}>
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarLayout;
