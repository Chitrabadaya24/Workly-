const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const MeetingRequest = require('../models/MeetingRequest');
const Task = require('../models/Task');
const Meeting = require('../models/Meeting');
const User = require('../models/User');

// @desc    List distinct departments
// @route   GET /api/teams/departments
router.get('/departments', protect, authorize('admin', 'ceo'), async (req, res) => {
  try {
    const departments = await User.distinct('department', {
      department: { $ne: '' },
      isActive: true,
    });
    res.json({ success: true, departments: departments.sort() });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Team summary for a department
// @route   GET /api/teams/:department/summary
router.get('/:department/summary', protect, authorize('admin', 'ceo'), async (req, res) => {
  try {
    const dept = decodeURIComponent(req.params.department);
    const deptRegex = new RegExp(`^${dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const userIds = await User.find({ department: deptRegex, isActive: true }).distinct('_id');

    const [pendingRequests, openTasks, upcomingMeetings] = await Promise.all([
      MeetingRequest.countDocuments({ requestedBy: { $in: userIds }, status: 'pending' }),
      Task.countDocuments({
        assignedTo: { $in: userIds },
        status: { $in: ['todo', 'in-progress'] },
      }),
      Meeting.countDocuments({
        participants: { $in: userIds },
        status: { $in: ['upcoming', 'live'] },
      }),
    ]);

    res.json({
      success: true,
      department: dept,
      memberCount: userIds.length,
      pendingRequests,
      openTasks,
      upcomingMeetings,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Team requests
// @route   GET /api/teams/:department/requests
router.get('/:department/requests', protect, authorize('admin', 'ceo'), async (req, res) => {
  try {
    const dept = decodeURIComponent(req.params.department);
    const deptRegex = new RegExp(`^${dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const userIds = await User.find({ department: deptRegex }).distinct('_id');
    const { status, page = 1, limit = 20 } = req.query;
    const query = { requestedBy: { $in: userIds } };
    if (status) query.status = status;

    const total = await MeetingRequest.countDocuments(query);
    const requests = await MeetingRequest.find(query)
      .populate('requestedBy', 'fullName username department')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, total, requests });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Team tasks
// @route   GET /api/teams/:department/tasks
router.get('/:department/tasks', protect, authorize('admin', 'ceo'), async (req, res) => {
  try {
    const dept = decodeURIComponent(req.params.department);
    const deptRegex = new RegExp(dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const userIds = await User.find({ department: deptRegex, isActive: true }).distinct('_id');

    const tasks = await Task.find({
      status: { $ne: 'cancelled' },
      $or: [
        { team: deptRegex },
        { assignedTo: { $in: userIds } },
      ],
    })
      .populate('assignedTo', 'fullName username department')
      .populate('assignedBy', 'fullName username')
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(50);

    res.json({ success: true, tasks });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
