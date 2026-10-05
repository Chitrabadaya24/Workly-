import { useState, useEffect, useCallback } from 'react';
import { userAPI } from '../../services/apiService';
import PageHeader from '../../components/common/PageHeader';
import Modal from '../../components/common/Modal';
import { RoleBadge } from '../../components/common/Badges';
import useDebounce from '../../hooks/useDebounce';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const ROLES = ['admin', 'ceo', 'employee'];

const emptyForm = {
  username: '',
  password: '',
  fullName: '',
  email: '',
  department: '',
  role: 'employee'
};

// Validation Regex
const fullNameRegex = /^[A-Za-z]+(?: [A-Za-z]+)+$/;

const usernameRegex = /^[a-z0-9._-]{3,30}$/;

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

const UserForm = ({onSubmit, isEdit, form, setForm, saving, setShowEdit, setShowCreate}) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Username (login ID) *</label>
        <input
          className="input"
          value={form.username}
          onChange={(e) => {
            const value = e.target.value.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
            setForm((p) => ({ ...p, username: value }));
          }}
          placeholder="johndoe"
          autoComplete="username"
          minLength={3}
          maxLength={30}
          required
          readOnly={isEdit}
          title={isEdit ? 'Username cannot be changed after creation' : undefined}
        />
        <p className="text-xs text-surface-500 mt-1">
          {isEdit ? 'Used to sign in — contact support if it must change.' : '3–30 characters: letters, numbers, dots, underscores, hyphens.'}
        </p>
      </div>
      <div>
        <label className="label">Full Name *</label>
        <input
          className="input"
          value={form.fullName}
          onChange={(e) => {
            const value = e.target.value.replace(/[^a-zA-Z ]/g, '');
            setForm((p) => ({ ...p, fullName: value }));
          }}
          placeholder="John Doe"
          autoComplete="name"
          required
        />
      </div>
      {!isEdit && (
        <div>
          <label className="label">Password *</label>
          <input className="input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 chars, Aa1@" required minLength={8} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="john@gmail.com"
            pattern="^[A-Za-z0-9._%+]+@gmail\.com$"
            title="Please enter a valid Gmail address"
          />
        </div>
        <div>
          <label className="label">Department</label>
          <input className="input" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} placeholder="Engineering" />
        </div>
      </div>
      <div>
        <label className="label">Role *</label>
        <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
          {ROLES.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={() => isEdit ? setShowEdit(null) : setShowCreate(false)}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  );

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showReset, setShowReset] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.getAll({ search: debouncedSearch, role: roleFilter, page, limit });
      setUsers(data.users);
      setTotal(data.total);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [debouncedSearch, roleFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const username = form.username.trim().toLowerCase();
    if (!username || !form.password || !form.fullName) {
      return toast.error('Username, full name, and password are required');
    }

    if (!usernameRegex.test(username)) {
      return toast.error('Username must be 3–30 characters (letters, numbers, . _ -)');
    }

// Full Name Validation
if (!fullNameRegex.test(form.fullName)) {
  return toast.error(
    'Full Name must contain First and Last name with Capital first letters'
  );
}

// Password Validation
if (!passwordRegex.test(form.password)) {
  return toast.error(
    'Password must be 8+ chars with uppercase, lowercase, number and special character'
  );
}

// Gmail Validation
if (form.email && !gmailRegex.test(form.email)) {
  return toast.error('Email must be a valid @gmail.com address');
}

    setSaving(true);
    try {
      await userAPI.create({ ...form, username });
      toast.success('User created successfully');
      setShowCreate(false);
      setForm(emptyForm);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create user'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await userAPI.update(showEdit._id, form);
      toast.success('User updated');
      setShowEdit(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id) => {
    try {
      const { data } = await userAPI.toggleStatus(id);
      toast.success(data.message);
      load();
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await userAPI.delete(id);
      toast.success('User deleted');
      load();
    } catch { toast.error('Failed to delete user'); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!passwordRegex.test(newPassword)) return toast.error('Password must contain uppercase, lowercase, number, special character and minimum 8 characters');
    setSaving(true);
    try {
      await userAPI.resetPassword(showReset._id, { newPassword });
      toast.success('Password reset successfully');
      setShowReset(null);
      setNewPassword('');
    } catch { toast.error('Failed to reset password'); }
    finally { setSaving(false); }
  };

  const handleResetTokens = async (userId) => {
    try {
      await userAPI.resetEmergencyTokens(userId, {});
      toast.success('Emergency tokens reset');
      load();
    } catch {
      toast.error('Failed to reset tokens');
    }
  };

  const handleBulkResetTokens = async () => {
    if (!confirm('Reset emergency tokens for ALL active employees?')) return;
    try {
      const { data } = await userAPI.resetAllEmergencyTokens({});
      toast.success(data.message);
      load();
    } catch {
      toast.error('Bulk reset failed');
    }
  };

  const openEdit = (u) => {
    setForm({ username: u.username, fullName: u.fullName, email: u.email || '', department: u.department || '', role: u.role, password: '' });
    setShowEdit(u);
  };

  

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="User Management"
        subtitle={`${total} total users`}
        actions={
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={handleBulkResetTokens}>
              Reset All Tokens
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={() => { setForm(emptyForm); setShowCreate(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add User
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input pl-9"
            placeholder="Search users..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-40" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100 dark:border-surface-800">
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3">User</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wide px-3 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wide px-3 py-3 hidden sm:table-cell">Department</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wide px-3 py-3 hidden md:table-cell">Joined</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wide px-3 py-3 hidden lg:table-cell">Tokens</th>
                <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wide px-3 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50 dark:divide-surface-800">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-surface-400">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-surface-200 border-t-primary-600 rounded-full animate-spin" /></div>
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-surface-400 text-sm">No users found</td></tr>
              ) : users.map((u) => (
                <tr key={u._id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                        u.role === 'admin' ? 'bg-purple-500' : u.role === 'ceo' ? 'bg-amber-500' : 'bg-primary-500'
                      }`}>
                        {u.fullName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{u.fullName}</p>
                        <p className="text-xs text-surface-500">@{u.username} {u.email && `· ${u.email}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-3 py-3 hidden sm:table-cell text-sm text-surface-500">{u.department || '—'}</td>
                  <td className="px-3 py-3 hidden md:table-cell text-xs text-surface-400">
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell text-sm text-surface-500">
                    {u.role === 'employee' ? `${u.emergencyTokens ?? 0}/3` : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`badge ${u.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="btn-ghost p-1.5 rounded-lg" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => setShowReset(u)} className="btn-ghost p-1.5 rounded-lg" title="Reset Password">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </button>
                      {u.role === 'employee' && (
                        <button onClick={() => handleResetTokens(u._id)} className="btn-ghost p-1.5 rounded-lg" title="Reset emergency tokens">
                          🎫
                        </button>
                      )}
                      <button onClick={() => handleToggle(u._id)} className="btn-ghost p-1.5 rounded-lg" title={u.isActive ? 'Deactivate' : 'Activate'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                      </button>
                      <button onClick={() => handleDelete(u._id)} className="btn-ghost p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-surface-100 dark:border-surface-800">
            <p className="text-sm text-surface-500">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
            <div className="flex gap-2">
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Prev</button>
              <button className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New User" size="lg">
        <UserForm
          onSubmit={handleCreate}
          isEdit={false}
          form={form}
          setForm={setForm}
          saving={saving}
          setShowCreate={setShowCreate}
          setShowEdit={setShowEdit}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!showEdit} onClose={() => setShowEdit(null)} title="Edit User">
        <UserForm
          onSubmit={handleUpdate}
          isEdit={true}
          form={form}
          setForm={setForm}
          saving={saving}
          setShowCreate={setShowCreate}
          setShowEdit={setShowEdit}
        />
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={!!showReset} onClose={() => setShowReset(null)} title="Reset Password" size="sm">
        <p className="text-sm text-surface-500 mb-4">Reset password for <strong className="text-surface-900 dark:text-white">{showReset?.fullName}</strong></p>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowReset(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Resetting...' : 'Reset Password'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UsersPage;
