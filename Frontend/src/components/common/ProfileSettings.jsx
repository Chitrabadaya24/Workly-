import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userAPI, authAPI } from '../../services/apiService';
import PageHeader from './PageHeader';
import toast from 'react-hot-toast';

const ProfileSettings = () => {
  const { user, updateUserData } = useAuth();
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    department: user?.department || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await userAPI.updateProfile(profileForm);
      updateUserData(data.user);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
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
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const roleColors = {
    admin: 'from-purple-500 to-violet-600',
    ceo: 'from-amber-500 to-orange-600',
    employee: 'from-emerald-500 to-teal-600',
  };

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader title="Profile Settings" subtitle="Manage your account information" />

      {/* Avatar + role card */}
      <div className="card mb-5 flex items-center gap-4">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${roleColors[user?.role]} flex items-center justify-center text-white font-bold text-2xl flex-shrink-0`}>
          {user?.fullName?.charAt(0)}
        </div>
        <div>
          <p className="font-display font-bold text-lg text-surface-900 dark:text-white">{user?.fullName}</p>
          <p className="text-sm text-surface-500">@{user?.username}</p>
          <span className={`badge capitalize mt-1 ${
            user?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
            user?.role === 'ceo' ? 'bg-amber-100 text-amber-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {user?.role}
          </span>
        </div>
        {user?.role === 'employee' && (
          <div className="ml-auto text-center">
            <p className="text-xs text-surface-500 mb-1">Emergency Tokens</p>
            <div className="flex gap-1 justify-center">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-5 h-5 rounded-full border-2 ${
                  i < (user?.emergencyTokens ?? 0)
                    ? 'bg-red-500 border-red-500'
                    : 'border-surface-300'
                }`} />
              ))}
            </div>
            <p className="text-xs text-surface-400 mt-1">{user?.emergencyTokens ?? 0}/3 remaining</p>
          </div>
        )}
      </div>

      {/* Profile form */}
      <div className="card mb-5">
        <h2 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Personal Information</h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={profileForm.fullName}
                onChange={e => setProfileForm(p => ({ ...p, fullName: e.target.value }))}
                placeholder="Your full name" required />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input bg-surface-100 cursor-not-allowed" value={user?.username} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={profileForm.email}
                onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                placeholder="your@email.com" />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={profileForm.department}
                onChange={e => setProfileForm(p => ({ ...p, department: e.target.value }))}
                placeholder="Engineering, Marketing, etc." />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Password form */}
      <div className="card">
        <h2 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input className="input" type="password" value={passwordForm.currentPassword}
              onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
              placeholder="Enter current password" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">New Password</label>
              <input className="input" type="password" value={passwordForm.newPassword}
                onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                placeholder="Min 6 characters" required minLength={6} />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input className="input" type="password" value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Repeat new password" required />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={savingPassword}>
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
