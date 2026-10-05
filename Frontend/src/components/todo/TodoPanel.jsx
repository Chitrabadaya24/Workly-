import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { taskAPI, userAPI } from '../../services/apiService';
import { getSocket } from '../../socket/socket';
import toast from 'react-hot-toast';

const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  low: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
};

function PencilIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

const taskOrderKey = (task) => task.sortOrder ?? new Date(task.createdAt).getTime();

const sortTasksForDisplay = (tasks) => {
  return [...tasks].sort((a, b) => {
    const aDone = a.status === 'completed' ? 1 : 0;
    const bDone = b.status === 'completed' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return taskOrderKey(a) - taskOrderKey(b);
  });
};

export default function TodoPanel() {
  const { user } = useAuth();
  const isCEO = user?.role === 'ceo' || user?.role === 'admin';
  const userId = user?._id || user?.id;
  const sameId = (a, b) => String(a?._id || a) === String(b);

  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState('all');
  const [form, setForm] = useState({
    title: '',
    team: '',
    assignedTo: '',
    priority: 'medium',
  });
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const scope = isCEO ? 'all' : 'mine';
      const { data } = await taskAPI.getAll({ scope });
      setTasks(data.tasks || []);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [isCEO]);

  const loadEmployees = useCallback(async () => {
    if (!isCEO) return;
    try {
      const { data } = await userAPI.getParticipants();
      const list = (data.users || []).filter((u) => u.role === 'employee');
      setEmployees(list);
    } catch {
      /* non-blocking */
    }
  }, [isCEO]);

  useEffect(() => {
    if (!userId) return;
    taskAPI.getAll({ scope: isCEO ? 'all' : 'mine' })
      .then(({ data }) => setTasks(data.tasks || []))
      .catch(() => {});
  }, [userId, isCEO]);

  useEffect(() => {
    if (!open) return;
    loadTasks();
    loadEmployees();
  }, [open, loadTasks, loadEmployees]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const refresh = () => { loadTasks(); };
    socket.on('new_task', refresh);
    socket.on('task_updated', refresh);
    return () => {
      socket.off('new_task', refresh);
      socket.off('task_updated', refresh);
    };
  }, [loadTasks]);

  const openCount = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;

  const visibleTasks = useMemo(() => tasks.filter((t) => {
    if (t.status === 'cancelled') return false;
    if (!isCEO || tab === 'all') return true;
    if (tab === 'mine') {
      return sameId(t.assignedTo, userId);
    }
    return sameId(t.assignedBy, userId) && !sameId(t.assignedTo, userId);
  }), [tasks, isCEO, tab, userId]);

  const sortedVisibleTasks = useMemo(
    () => sortTasksForDisplay(visibleTasks),
    [visibleTasks],
  );

  const applySortedTasks = useCallback((orderedTasks) => {
    const orderMap = new Map(orderedTasks.map((t, i) => [t._id, i]));
    setTasks((prev) => sortTasksForDisplay(
      prev.map((t) => (orderMap.has(t._id) ? { ...t, sortOrder: orderMap.get(t._id) } : t)),
    ));
  }, []);

  const handleToggle = async (task) => {
    const next = task.status === 'completed' ? 'todo' : 'completed';
    const openTasks = sortedVisibleTasks.filter((t) => t.status !== 'completed' && t._id !== task._id);
    const doneTasks = sortedVisibleTasks.filter((t) => t.status === 'completed' && t._id !== task._id);
    const nextSortOrder = next === 'completed'
      ? (doneTasks.length ? Math.max(...doneTasks.map(taskOrderKey)) + 1 : taskOrderKey(task))
      : (openTasks.length ? Math.max(...openTasks.map(taskOrderKey)) + 1 : taskOrderKey(task));

    try {
      const { data } = await taskAPI.updateStatus(task._id, { status: next, sortOrder: nextSortOrder });
      setTasks((prev) => sortTasksForDisplay(
        prev.map((t) => (t._id === task._id ? { ...data.task, sortOrder: nextSortOrder } : t)),
      ));
    } catch {
      toast.error('Could not update task');
    }
  };

  const handleDragStart = (e, taskId) => {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e, task) => {
    e.preventDefault();
    if (!draggingId || draggingId === task._id) return;

    const dragged = sortedVisibleTasks.find((t) => t._id === draggingId);
    if (!dragged) return;

    const draggedDone = dragged.status === 'completed';
    const targetDone = task.status === 'completed';
    if (draggedDone !== targetDone) return;

    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(task._id);
  };

  const handleDrop = async (e, targetTask) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDropTargetId(null);
    if (!draggedId || draggedId === targetTask._id) return;

    const dragged = sortedVisibleTasks.find((t) => t._id === draggedId);
    if (!dragged) return;

    const draggedDone = dragged.status === 'completed';
    const targetDone = targetTask.status === 'completed';
    if (draggedDone !== targetDone) return;

    const fromIndex = sortedVisibleTasks.findIndex((t) => t._id === draggedId);
    const toIndex = sortedVisibleTasks.findIndex((t) => t._id === targetTask._id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const reordered = [...sortedVisibleTasks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    applySortedTasks(reordered);

    try {
      await taskAPI.reorder(reordered.map((t) => t._id));
    } catch {
      loadTasks();
      toast.error('Could not save task order');
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDelete = async (task) => {
    if (!confirm('Delete this task?')) return;
    try {
      await taskAPI.delete(task._id);
      setTasks((prev) => prev.filter((t) => t._id !== task._id));
      toast.success('Task removed');
    } catch {
      toast.error('Could not delete task');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    setSaving(true);
    try {
      const payload = {
        title,
        team: form.team.trim(),
        priority: form.priority,
      };

      if (isCEO) {
        payload.assignedTo = form.assignedTo || userId;
      }

      const { data } = await taskAPI.create(payload);
      setTasks((prev) => sortTasksForDisplay([data.task, ...prev]));
      setForm({ title: '', team: '', assignedTo: '', priority: 'medium' });
      toast.success(isCEO && form.assignedTo ? 'Task assigned' : 'Task added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative btn-ghost p-2 rounded-xl"
        aria-label="Open to-do list"
        title="To-do list"
      >
        <PencilIcon />
        {openCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-0.5 text-[9px] font-bold text-white">
            {openCount > 9 ? '9+' : openCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed right-0 top-0 z-[111] flex h-full w-full max-w-md flex-col border-l border-surface-200 bg-white shadow-2xl dark:border-surface-700 dark:bg-surface-900"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4 dark:border-surface-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-200">
                    <PencilIcon size={18} />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">To-do</h2>
                    <p className="text-xs text-surface-500">{openCount} open</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {isCEO && (
                <div className="flex gap-1 border-b border-surface-200 px-4 py-2 dark:border-surface-800">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'mine', label: 'My tasks' },
                    { id: 'assigned', label: 'Assigned' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        tab === t.id
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200'
                          : 'text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 border-b border-surface-200 p-4 dark:border-surface-800">
                <input
                  className="input"
                  placeholder={isCEO ? 'Task title…' : 'Add a task…'}
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
                {isCEO && (
                  <>
                    <select
                      className="input"
                      value={form.assignedTo}
                      onChange={(e) => setForm((p) => ({ ...p, assignedTo: e.target.value }))}
                    >
                      <option value="">Assign to me</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.fullName}{emp.department ? ` · ${emp.department}` : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      placeholder="Tag / team (e.g. HR, frontend)"
                      value={form.team}
                      onChange={(e) => setForm((p) => ({ ...p, team: e.target.value }))}
                    />
                  </>
                )}
                <select
                  className="input"
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <button type="submit" className="btn-primary w-full" disabled={saving}>
                  {saving ? 'Saving…' : isCEO ? 'Add / Assign' : 'Add task'}
                </button>
              </form>

              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <p className="text-center text-sm text-surface-500 py-8">Loading…</p>
                ) : sortedVisibleTasks.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-sm text-surface-500">No tasks yet</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sortedVisibleTasks.map((task) => {
                      const done = task.status === 'completed';
                      const isPersonal = sameId(task.assignedTo, task.assignedBy);
                      const canDelete = isCEO
                        ? sameId(task.assignedBy, userId)
                        : isPersonal;
                      const isDragging = draggingId === task._id;
                      const isDropTarget = dropTargetId === task._id && draggingId !== task._id;

                      return (
                        <motion.li
                          layout
                          layoutId={task._id}
                          key={task._id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task._id)}
                          onDragOver={(e) => handleDragOver(e, task)}
                          onDrop={(e) => handleDrop(e, task)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-start gap-2 rounded-xl border p-3 transition-colors ${
                            isDragging ? 'opacity-40' : ''
                          } ${
                            isDropTarget ? 'border-primary-400 ring-2 ring-primary-200 dark:ring-primary-500/30' : ''
                          } ${
                            done
                              ? 'border-surface-200 bg-surface-50/80 opacity-70 dark:border-surface-800 dark:bg-surface-800/40'
                              : 'border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800/60'
                          }`}
                        >
                          <button
                            type="button"
                            className="mt-0.5 flex-shrink-0 cursor-grab rounded p-0.5 text-surface-300 hover:text-surface-500 active:cursor-grabbing dark:text-surface-600 dark:hover:text-surface-400"
                            aria-label="Drag to reorder"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <GripIcon />
                          </button>
                          <button
                            type="button"
                            draggable={false}
                            onClick={() => handleToggle(task)}
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                              done
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-surface-300 dark:border-surface-600 hover:border-primary-500'
                            }`}
                            aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {done && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium text-surface-900 dark:text-white ${done ? 'line-through' : ''}`}>
                              {task.title}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {task.team && (
                                <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-medium text-surface-600 dark:bg-surface-700 dark:text-surface-300">
                                  #{task.team}
                                </span>
                              )}
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                                {task.priority}
                              </span>
                              {isCEO && task.assignedTo && !isPersonal && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                  → {task.assignedTo.fullName || 'Employee'}
                                </span>
                              )}
                              {!isCEO && task.assignedBy && !isPersonal && (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  from {task.assignedBy.fullName}
                                </span>
                              )}
                            </div>
                          </div>
                          {canDelete && (
                            <button
                              type="button"
                              draggable={false}
                              onClick={() => handleDelete(task)}
                              className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                              aria-label="Delete task"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                              </svg>
                            </button>
                          )}
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
