const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Generate Google Meet style link
const generateMeetCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const roomName = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return roomName;
};

const meetingEndTime = (meeting) => {
  const start = new Date(`${meeting.date.toISOString().split('T')[0]}T${meeting.time}`);
  return new Date(start.getTime() + meeting.duration * 60000);
};

const roleScope = (user) => (user.role === 'employee' ? { participants: user.id } : {});

const isMeetingParticipant = (meeting, userId) => (
  meeting.participants?.some((p) => String(p._id || p) === String(userId))
);

const canPermanentlyDeleteFromTrash = (req, meeting) => {
  if (req.user.role === 'ceo' || req.user.role === 'admin') return true;
  if (req.user.role !== 'employee') return false;
  return !!meeting.trashedAt && isMeetingParticipant(meeting, req.user.id);
};

/** Mark past meetings completed and move them to trash. */
const syncMeetingStatuses = async (filterQuery = {}, io = null) => {
  const now = new Date();
  const active = await Meeting.find({
    ...filterQuery,
    trashedAt: null,
    status: { $in: ['upcoming', 'live'] },
  }).limit(300);

  for (const m of active) {
    const end = meetingEndTime(m);
    const start = new Date(`${m.date.toISOString().split('T')[0]}T${m.time}`);

    if (now >= start && now <= end && m.status === 'upcoming') {
      m.status = 'live';
      await m.save();
      if (io) io.emit('meeting_updated', m);
    } else if (now > end) {
      m.status = 'completed';
      m.trashedAt = new Date();
      await m.save();
      if (io) io.emit('meeting_trashed', m);
    }
  }
};

// POST /api/meet/create
const createMeeting = async (req, res) => {
  try {
    const { title, description, date, time, duration, participants } = req.body;
    const io = req.app.get('io');

    const { generateLink = true } = req.body;

      let code = null;
      let meetLink = null;

      if (generateLink) {
        code = generateMeetCode();
        meetLink = `https://meet.jit.si/${code}`;
      }

      const meeting = await Meeting.create({
        title, description, date, time,
        duration: duration || 30,
        participants,
        createdBy: req.user.id,
        meetLink: meetLink || '',
        meetingCode: code || '',
        status: 'upcoming',
      });

    await meeting.populate([
      { path: 'participants', select: 'fullName username email department' },
      { path: 'createdBy', select: 'fullName username' },
    ]);

    // Send notification to all participants
    for (const participantId of participants) {
    const notif = await Notification.create({
      recipient: participantId,
      type: 'meeting_pending',
      title: '📹 New Meeting Scheduled',
      message: `${req.user.fullName} ne "${title}" schedule kiya — ${new Date(date).toLocaleDateString()} at ${time}${meetLink ? `. Join: ${meetLink}` : ''}`,
      relatedRequest: meeting._id,
    });

    if (io) {
    
      io.to(`user_${participantId}`).emit('new_notification', notif);
      io.to(`user_${participantId}`).emit('new_meeting', meeting);
    }
  }

    res.status(201).json({ success: true, meeting });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/meet
const getAllMeetings = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20, trash } = req.query;
    const scope = roleScope(req.user);
    const io = req.app.get('io');
    const inTrash = trash === 'true' || trash === '1';

    await syncMeetingStatuses(scope, io);

    // Legacy completed meetings (before trash feature) → trash
    await Meeting.updateMany(
      { ...scope, status: 'completed', trashedAt: null },
      { $set: { trashedAt: new Date() } },
    );

    const query = { ...scope };

    if (inTrash) {
      query.trashedAt = { $ne: null };
    } else {
      query.trashedAt = null;
    }

    if (status) query.status = status;
    if (search) query.title = { $regex: search, $options: 'i' };

    const total = await Meeting.countDocuments(query);
    const meetings = await Meeting.find(query)
      .populate('participants', 'fullName username department')
      .populate('createdBy', 'fullName username')
      .sort(inTrash ? { trashedAt: -1 } : { date: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, meetings, total, trash: inTrash });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/meet/:id
const getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('participants', 'fullName username department email')
      .populate('createdBy', 'fullName username')
      .populate('attendees.user', 'fullName username');
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/meet/:id
const updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('participants', 'fullName username')
      .populate('createdBy', 'fullName username');
    if (!meeting) return res.status(404).json({ success: false, message: 'Not found' });

    // Broadcast update
    const io = req.app.get('io');
    if (io) io.emit('meeting_updated', meeting);

    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/meet/:id — CEO/admin: soft-trash or permanent; employee: permanent from trash only
const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Not found' });

    const io = req.app.get('io');
    const permanent = req.query.permanent === 'true' || req.query.permanent === '1';
    const isPrivileged = req.user.role === 'ceo' || req.user.role === 'admin';

    if (!isPrivileged) {
      if (!canPermanentlyDeleteFromTrash(req, meeting)) {
        return res.status(403).json({ success: false, message: 'Not allowed to delete this meeting' });
      }
      await Meeting.findByIdAndDelete(req.params.id);
      if (io) io.emit('meeting_deleted', { id: req.params.id });
      return res.json({ success: true, message: 'Meeting permanently deleted', permanent: true });
    }

    if (meeting.trashedAt || permanent) {
      await Meeting.findByIdAndDelete(req.params.id);
      if (io) io.emit('meeting_deleted', { id: req.params.id });
      return res.json({ success: true, message: 'Meeting permanently deleted', permanent: true });
    }

    meeting.trashedAt = new Date();
    if (meeting.status === 'upcoming' || meeting.status === 'live') {
      meeting.status = 'cancelled';
    }
    await meeting.save();
    if (io) io.emit('meeting_trashed', meeting);
    res.json({ success: true, message: 'Meeting moved to trash', meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/meet/:id/restore
const restoreMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Not found' });
    if (!meeting.trashedAt) {
      return res.status(400).json({ success: false, message: 'Meeting is not in trash' });
    }

    meeting.trashedAt = null;
    await meeting.save();
    await meeting.populate([
      { path: 'participants', select: 'fullName username department' },
      { path: 'createdBy', select: 'fullName username' },
    ]);

    const io = req.app.get('io');
    if (io) io.emit('meeting_restored', meeting);

    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/meet/:id/status
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const updates = { status };
    if (status === 'completed') {
      updates.trashedAt = new Date();
    } else if (status === 'upcoming' || status === 'live') {
      updates.trashedAt = null;
    }

    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id, updates, { new: true }
    ).populate('participants', 'fullName username');

    const io = req.app.get('io');
    if (io) {
      if (status === 'completed') io.emit('meeting_trashed', meeting);
      else io.emit('meeting_updated', meeting);
    }

    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE /api/meet/trash — permanently delete all meetings in trash (CEO/admin)
const emptyTrash = async (req, res) => {
  try {
    const scope = roleScope(req.user);
    const query = { ...scope, trashedAt: { $ne: null } };
    const trashed = await Meeting.find(query).select('_id').limit(500);
    const ids = trashed.map((m) => m._id);

    if (ids.length === 0) {
      return res.json({ success: true, deletedCount: 0, message: 'Trash is already empty' });
    }

    const result = await Meeting.deleteMany({ _id: { $in: ids } });
    const io = req.app.get('io');
    if (io) {
      ids.forEach((id) => io.emit('meeting_deleted', { id: String(id) }));
      io.emit('trash_emptied', { count: result.deletedCount });
    }

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Permanently deleted ${result.deletedCount} meeting(s)`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/meet/trash/bulk-delete — permanently delete selected meetings in trash
const bulkDeleteTrash = async (req, res) => {
  try {
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = [...new Set(rawIds.map(String).filter(Boolean))];

    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one meeting to delete' });
    }

    const meetings = await Meeting.find({
      _id: { $in: ids },
      trashedAt: { $ne: null },
    });

    const allowed = meetings.filter((m) => canPermanentlyDeleteFromTrash(req, m));
    if (allowed.length === 0) {
      return res.status(403).json({ success: false, message: 'Not allowed to delete selected meetings' });
    }

    const allowedIds = allowed.map((m) => m._id);
    const result = await Meeting.deleteMany({ _id: { $in: allowedIds } });
    const io = req.app.get('io');
    if (io) {
      allowedIds.forEach((id) => io.emit('meeting_deleted', { id: String(id) }));
      if (result.deletedCount > 0) {
        io.emit('trash_bulk_deleted', { count: result.deletedCount, ids: allowedIds.map(String) });
      }
    }

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Permanently deleted ${result.deletedCount} meeting(s)`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/meet/stats
const getMeetingStats = async (req, res) => {
  try {
    const scope = roleScope(req.user);
    const activeScope = { ...scope, trashedAt: null };
    const trashScope = { ...scope, trashedAt: { $ne: null } };

    const [total, upcoming, live, trashed] = await Promise.all([
      Meeting.countDocuments(activeScope),
      Meeting.countDocuments({ ...activeScope, status: 'upcoming' }),
      Meeting.countDocuments({ ...activeScope, status: 'live' }),
      Meeting.countDocuments(trashScope),
    ]);
    res.json({ success: true, stats: { total, upcoming, live, trashed, completed: trashed } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createMeeting,
  getAllMeetings,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  restoreMeeting,
  emptyTrash,
  bulkDeleteTrash,
  updateStatus,
  getMeetingStats,
};
