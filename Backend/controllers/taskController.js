const Task = require('../models/Task');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLog');

const isPrivileged = (role) => role === 'ceo' || role === 'admin';

const isCompleted = (status) => status === 'completed';

const taskOrderKey = (task) => task.sortOrder ?? new Date(task.createdAt).getTime();

const sortTasksForDisplay = (tasks) => {
  return [...tasks].sort((a, b) => {
    const aDone = isCompleted(a.status) ? 1 : 0;
    const bDone = isCompleted(b.status) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return taskOrderKey(a) - taskOrderKey(b);
  });
};

const canManageTaskOrder = (user, task) => {
  if (task.assignedTo.toString() === user.id) return true;
  if (isPrivileged(user.role)) return true;
  return false;
};

// @desc  Get my tasks (or all, for ceo/admin)
// @route GET /api/tasks
const getTasks = async (req, res) => {
  try {
    const { scope, department } = req.query;
    let query = { status: { $ne: 'cancelled' } };

    if (department && isPrivileged(req.user.role)) {
      const deptRegex = new RegExp(department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const userIds = await User.find({ department: deptRegex, isActive: true }).distinct('_id');
      query.$or = [{ team: deptRegex }, { assignedTo: { $in: userIds } }];
    } else if (req.user.role === 'employee' || scope === 'mine') {
      query.assignedTo = req.user.id;
    } else if (scope === 'assigned') {
      query.assignedBy = req.user.id;
      query.assignedTo = { $ne: req.user.id };
    } else if (scope === 'all' && isPrivileged(req.user.role)) {
      query = {
        status: { $ne: 'cancelled' },
        $or: [{ assignedTo: req.user.id }, { assignedBy: req.user.id }],
      };
    } else if (isPrivileged(req.user.role)) {
      query.assignedBy = req.user.id;
    }

    const tasks = sortTasksForDisplay(
      await Task.find(query)
        .populate('assignedTo', 'fullName username department')
        .populate('assignedBy', 'fullName username')
    );
    res.json({ success: true, tasks });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc  Create/assign a task
// @route POST /api/tasks
const createTask = async (req, res) => {
  try {
    const io = req.app.get('io');
    const { title, description, team, priority, dueDate } = req.body;
    let { assignedTo } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    if (req.user.role === 'employee') {
      assignedTo = req.user.id;
    } else if (!assignedTo) {
      assignedTo = req.user.id;
    }

    const assignee = await User.findById(assignedTo).select('fullName role isActive');
    if (!assignee || !assignee.isActive) {
      return res.status(400).json({ success: false, message: 'Assignee not found' });
    }

    if (req.user.role === 'employee' && assignedTo !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Employees can only create personal tasks' });
    }

    const minOrderTask = await Task.findOne({
      assignedTo,
      status: { $nin: ['completed', 'cancelled'] },
    }).sort({ sortOrder: 1 }).select('sortOrder');

    const task = await Task.create({
      title: title.trim(),
      description: description || '',
      assignedTo,
      team: team?.trim() || '',
      priority: priority || 'medium',
      dueDate: dueDate || null,
      assignedBy: req.user.id,
      sortOrder: (minOrderTask?.sortOrder ?? Date.now()) - 1,
    });

    await task.populate('assignedTo', 'fullName username department');
    await task.populate('assignedBy', 'fullName username');

    const isSelf = assignedTo === req.user.id;
    if (!isSelf) {
      const n = await Notification.create({
        recipient: assignedTo,
        type: 'status_update',
        title: '✅ New Task Assigned',
        message: `${req.user.fullName} assigned you: "${title.trim()}"${team ? ` (#${team})` : ''}`,
      });
      if (io) {
        io.to(`user_${assignedTo}`).emit('new_notification', n);
        io.to(`user_${assignedTo}`).emit('new_task', task);
      }
    } else if (io) {
      io.to(`user_${req.user.id}`).emit('new_task', task);
    }

    await logAudit(req, {
      action: 'task.create',
      resourceType: 'Task',
      resourceId: task._id,
      summary: `Created task "${title.trim()}"`,
    });

    res.status(201).json({ success: true, task });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' });
  }
};

// @desc  Update task status
// @route PUT /api/tasks/:id/status
const updateTaskStatus = async (req, res) => {
  try {
    const { status, sortOrder } = req.body;
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Task not found' });

    if (req.user.role === 'employee' && existing.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const update = { status };
    if (status === 'completed') {
      update.completedAt = new Date();
      if (sortOrder == null) {
        const maxCompleted = await Task.findOne({
          assignedTo: existing.assignedTo,
          status: 'completed',
          _id: { $ne: existing._id },
        }).sort({ sortOrder: -1 }).select('sortOrder');
        update.sortOrder = (maxCompleted?.sortOrder ?? Date.now()) + 1;
      }
    } else {
      update.completedAt = null;
      if (sortOrder == null && isCompleted(existing.status)) {
        const maxOpen = await Task.findOne({
          assignedTo: existing.assignedTo,
          status: { $nin: ['completed', 'cancelled'] },
          _id: { $ne: existing._id },
        }).sort({ sortOrder: -1 }).select('sortOrder');
        update.sortOrder = (maxOpen?.sortOrder ?? Date.now()) + 1;
      }
    }
    if (sortOrder != null) update.sortOrder = sortOrder;

    const task = await Task.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('assignedTo', 'fullName username department')
      .populate('assignedBy', 'fullName username');

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${task.assignedTo._id}`).emit('task_updated', task);
      if (task.assignedBy?._id && task.assignedBy._id.toString() !== task.assignedTo._id.toString()) {
        io.to(`user_${task.assignedBy._id}`).emit('task_updated', task);
      }
    }
    res.json({ success: true, task });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc  Delete a task
// @route DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const isOwner = task.assignedBy.toString() === req.user.id;
    const isSelfTask = task.assignedTo.toString() === req.user.id && task.assignedBy.toString() === req.user.id;

    if (req.user.role === 'employee' && !isSelfTask) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (!isOwner && !isPrivileged(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Task.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      action: 'task.delete',
      resourceType: 'Task',
      resourceId: task._id,
      summary: `Deleted task "${task.title}"`,
    });

    res.json({ success: true, message: 'Task deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc  Reorder tasks (incomplete and completed groups keep separate positions)
// @route PUT /api/tasks/reorder
const reorderTasks = async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, message: 'taskIds array is required' });
    }

    const tasks = await Task.find({ _id: { $in: taskIds } });
    if (tasks.length !== taskIds.length) {
      return res.status(400).json({ success: false, message: 'One or more tasks not found' });
    }

    for (const task of tasks) {
      if (!canManageTaskOrder(req.user, task)) {
        return res.status(403).json({ success: false, message: 'Not authorized to reorder tasks' });
      }
    }

    const openIds = taskIds.filter((id) => {
      const task = tasks.find((t) => t._id.toString() === id);
      return task && !isCompleted(task.status);
    });
    const doneIds = taskIds.filter((id) => {
      const task = tasks.find((t) => t._id.toString() === id);
      return task && isCompleted(task.status);
    });

    const updates = [...openIds, ...doneIds].map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder: index } },
      },
    }));

    if (updates.length) await Task.bulkWrite(updates);

    const io = req.app.get('io');
    if (io) {
      const refreshed = await Task.find({ _id: { $in: taskIds } })
        .populate('assignedTo', 'fullName username department')
        .populate('assignedBy', 'fullName username');
      for (const task of refreshed) {
        io.to(`user_${task.assignedTo._id}`).emit('task_updated', task);
        if (task.assignedBy?._id && task.assignedBy._id.toString() !== task.assignedTo._id.toString()) {
          io.to(`user_${task.assignedBy._id}`).emit('task_updated', task);
        }
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getTasks, createTask, updateTaskStatus, deleteTask, reorderTasks };
