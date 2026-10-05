const fs = require('fs');
const path = require('path');
const MeetingRequest = require('../models/MeetingRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AvailabilityStatus = require('../models/AvailabilityStatus');
const { normalizeDateOnly } = require('../utils/dateOnly');
const { logAudit } = require('../utils/auditLog');
const { REQUEST_ATTACHMENTS_DIR, MAX_FILES_PER_REQUEST } = require('../config/uploads');

// Helper: Create notification and emit via socket
const createNotification = async (io, recipient, type, title, message, relatedRequest) => {
  const notification = await Notification.create({
    recipient,
    type,
    title,
    message,
    relatedRequest,
  });

  if (io) {
    io.to(`user_${recipient}`).emit('new_notification', {
      ...notification.toObject(),
    });
  }

  return notification;
};

function buildAttachmentsFromFiles(files = []) {
  return files.map((file) => ({
    name: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date(),
  }));
}

function canAccessRequest(req, request) {
  if (req.user.role === 'admin' || req.user.role === 'ceo') return true;
  const ownerId = request.requestedBy?._id?.toString() || request.requestedBy?.toString();
  return ownerId === req.user.id;
}

// @desc    Create meeting request
// @route   POST /api/meetings
// @access  Employee
const createMeetingRequest = async (req, res) => {
  try {
    const { title, purpose, agenda, urgency, preferredDate, preferredTime, duration, notes } = req.body;
    const io = req.app.get('io');

    // Check CEO availability mode
    const ceoUser = await User.findOne({ role: 'ceo' });
    if (ceoUser) {
      const availability = await AvailabilityStatus.findOne({ ceo: ceoUser._id });
      if (availability) {
        if (availability.status === 'deep_work' && urgency !== 'emergency') {
          return res.status(403).json({
            success: false,
            message: 'CEO is in Deep Work mode. Only emergency requests are accepted.',
          });
        }
        if (availability.status === 'emergency_only' && urgency !== 'emergency') {
          return res.status(403).json({
            success: false,
            message: 'CEO is in Emergency Only mode. Only emergency requests are accepted.',
          });
        }
      }
    }

    let isEmergencyToken = false;

    // Handle emergency token usage
    if (urgency === 'emergency') {
      const employee = await User.findById(req.user.id);
      if (employee.emergencyTokens <= 0) {
        return res.status(403).json({
          success: false,
          message: 'You have no emergency tokens remaining.',
        });
      }
      employee.emergencyTokens -= 1;
      isEmergencyToken = true;
      // Record token usage (will be updated after request creation)
      await employee.save({ validateBeforeSave: false });
    }

    const meetingRequest = await MeetingRequest.create({
      title,
      purpose,
      agenda,
      urgency,
      preferredDate: normalizeDateOnly(preferredDate),
      preferredTime,
      duration: duration || 30,
      notes,
      requestedBy: req.user.id,
      isEmergencyToken,
      attachments: buildAttachmentsFromFiles(req.files),
    });

    // Update token usage history
    if (isEmergencyToken) {
      await User.findByIdAndUpdate(req.user.id, {
        $push: { tokenUsageHistory: { requestId: meetingRequest._id } },
      });
    }

    // Notify CEO
    if (ceoUser) {
      await createNotification(
        io,
        ceoUser._id,
        urgency === 'emergency' ? 'emergency_request' : 'meeting_pending',
        urgency === 'emergency' ? '🚨 Emergency Meeting Request' : 'New Meeting Request',
        `${req.user.fullName} has submitted a ${urgency} priority meeting request: "${title}"`,
        meetingRequest._id
      );
    }

    await meetingRequest.populate('requestedBy', 'fullName username department');

    await logAudit(req, {
      action: 'meeting.request_create',
      resourceType: 'MeetingRequest',
      resourceId: meetingRequest._id,
      summary: `Submitted meeting request "${title}"`,
      metadata: { urgency, attachmentCount: meetingRequest.attachments?.length || 0 },
    });

    res.status(201).json({
      success: true,
      message: 'Meeting request submitted successfully',
      meetingRequest,
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Get all meeting requests (CEO/Admin)
// @route   GET /api/meetings
// @access  CEO, Admin
const getAllMeetingRequests = async (req, res) => {
  try {
    const { status, urgency, page = 1, limit = 20, search, department } = req.query;
    const query = {};

    if (status) query.status = status;
    if (urgency) query.urgency = urgency;
    if (department) {
      const deptRegex = new RegExp(department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const userIds = await User.find({ department: deptRegex }).distinct('_id');
      query.requestedBy = { $in: userIds };
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await MeetingRequest.countDocuments(query);
    const requests = await MeetingRequest.find(query)
      .populate('requestedBy', 'fullName username department avatar')
      .populate('reviewedBy', 'fullName username')
      .sort({ urgency: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, count: requests.length, total, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get my meeting requests (Employee)
// @route   GET /api/meetings/my
// @access  Employee
const getMyMeetingRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { requestedBy: req.user.id };
    if (status) query.status = status;

    const total = await MeetingRequest.countDocuments(query);
    const requests = await MeetingRequest.find(query)
      .populate('reviewedBy', 'fullName username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, count: requests.length, total, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single meeting request
// @route   GET /api/meetings/:id
// @access  Private
const getMeetingRequest = async (req, res) => {
  try {
    const request = await MeetingRequest.findById(req.params.id)
      .populate('requestedBy', 'fullName username department avatar email')
      .populate('reviewedBy', 'fullName username')
      .populate('decisions.assignedTo', 'fullName username');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Meeting request not found' });
    }

    // Employees can only see their own requests
    if (req.user.role === 'employee' && request.requestedBy._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Approve meeting request (CEO)
// @route   PUT /api/meetings/:id/approve
// @access  CEO
const approveMeetingRequest = async (req, res) => {
  try {
    const { ceoComment, approvedDate, approvedTime } = req.body;
    const io = req.app.get('io');

    const request = await MeetingRequest.findById(req.params.id).populate('requestedBy');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request is not pending' });
    }

    request.status = 'approved';
    request.reviewedBy = req.user.id;
    request.ceoComment = ceoComment || '';
    request.approvedDate = normalizeDateOnly(approvedDate || request.preferredDate);
    request.approvedTime = approvedTime || request.preferredTime;
    await request.save();

    await createNotification(
      io,
      request.requestedBy._id,
      'meeting_approved',
      '✅ Meeting Request Approved',
      `Your meeting request "${request.title}" has been approved for ${new Date(request.approvedDate).toLocaleDateString()}.`,
      request._id
    );

    await logAudit(req, {
      action: 'meeting.approve',
      resourceType: 'MeetingRequest',
      resourceId: request._id,
      summary: `Approved meeting request "${request.title}"`,
    });

    res.json({ success: true, message: 'Meeting request approved', request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reject meeting request (CEO)
// @route   PUT /api/meetings/:id/reject
// @access  CEO
const rejectMeetingRequest = async (req, res) => {
  try {
    const { rejectionReason, ceoComment } = req.body;
    const io = req.app.get('io');

    const request = await MeetingRequest.findById(req.params.id).populate('requestedBy');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request is not pending' });
    }

    request.status = 'rejected';
    request.reviewedBy = req.user.id;
    request.rejectionReason = rejectionReason || '';
    request.ceoComment = ceoComment || '';
    await request.save();

    await createNotification(
      io,
      request.requestedBy._id,
      'meeting_rejected',
      '❌ Meeting Request Rejected',
      `Your meeting request "${request.title}" was rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`,
      request._id
    );

    await logAudit(req, {
      action: 'meeting.reject',
      resourceType: 'MeetingRequest',
      resourceId: request._id,
      summary: `Rejected meeting request "${request.title}"`,
      metadata: { rejectionReason },
    });

    res.json({ success: true, message: 'Meeting request rejected', request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Complete a meeting and add summary/decisions
// @route   PUT /api/meetings/:id/complete
// @access  CEO
const completeMeeting = async (req, res) => {
  try {
    const { meetingSummary, decisions } = req.body;

    const request = await MeetingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (request.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Meeting must be approved first' });
    }

    request.status = 'completed';
    request.meetingSummary = meetingSummary;
    request.decisions = decisions || [];
    request.completedAt = new Date();
    await request.save();

    await logAudit(req, {
      action: 'meeting.complete',
      resourceType: 'MeetingRequest',
      resourceId: request._id,
      summary: `Completed meeting "${request.title}"`,
    });

    res.json({ success: true, message: 'Meeting completed', request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get analytics
// @route   GET /api/meetings/analytics
// @access  Admin, CEO
const getAnalytics = async (req, res) => {
  try {
    const [
      total,
      pending,
      approved,
      rejected,
      completed,
      urgencyStats,
      topEmployees,
    ] = await Promise.all([
      MeetingRequest.countDocuments(),
      MeetingRequest.countDocuments({ status: 'pending' }),
      MeetingRequest.countDocuments({ status: 'approved' }),
      MeetingRequest.countDocuments({ status: 'rejected' }),
      MeetingRequest.countDocuments({ status: 'completed' }),
      MeetingRequest.aggregate([
        { $group: { _id: '$urgency', count: { $sum: 1 } } },
      ]),
      MeetingRequest.aggregate([
        { $group: { _id: '$requestedBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { count: 1, 'user.fullName': 1, 'user.username': 1, 'user.department': 1 } },
      ]),
    ]);

    res.json({
      success: true,
      analytics: {
        total,
        pending,
        approved,
        rejected,
        completed,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        urgencyDistribution: urgencyStats,
        topEmployees,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Upload attachments to a pending request
// @route   POST /api/meetings/:id/attachments
const uploadAttachments = async (req, res) => {
  try {
    const request = await MeetingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    if (!canAccessRequest(req, request)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (request.status !== 'pending' && req.user.role === 'employee') {
      return res.status(400).json({ success: false, message: 'Cannot add files after review' });
    }
    if (!req.files?.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const current = request.attachments?.length || 0;
    if (current + req.files.length > MAX_FILES_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_FILES_PER_REQUEST} attachments per request`,
      });
    }

    request.attachments.push(...buildAttachmentsFromFiles(req.files));
    await request.save();

    await logAudit(req, {
      action: 'request.attachment.upload',
      resourceType: 'MeetingRequest',
      resourceId: request._id,
      summary: `Uploaded ${req.files.length} attachment(s) to "${request.title}"`,
      metadata: { files: req.files.map((f) => f.originalname) },
    });

    res.json({ success: true, attachments: request.attachments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Download attachment
// @route   GET /api/meetings/:id/attachments/:attachmentId
const downloadAttachment = async (req, res) => {
  try {
    const request = await MeetingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!canAccessRequest(req, request)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const attachment = request.attachments.id(req.params.attachmentId);
    if (!attachment?.storedName) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const filePath = path.join(REQUEST_ATTACHMENTS_DIR, attachment.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File missing on server' });
    }

    res.setHeader('Cache-Control', 'private');
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.name}"`);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete attachment
// @route   DELETE /api/meetings/:id/attachments/:attachmentId
const deleteAttachment = async (req, res) => {
  try {
    const request = await MeetingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    const ownerId = request.requestedBy?.toString();
    if (req.user.role === 'employee' && ownerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (request.status !== 'pending' && req.user.role === 'employee') {
      return res.status(400).json({ success: false, message: 'Cannot remove files after review' });
    }

    const attachment = request.attachments.id(req.params.attachmentId);
    if (!attachment) return res.status(404).json({ success: false, message: 'Attachment not found' });

    if (attachment.storedName) {
      const filePath = path.join(REQUEST_ATTACHMENTS_DIR, attachment.storedName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    request.attachments.pull(req.params.attachmentId);
    await request.save();

    await logAudit(req, {
      action: 'request.attachment.delete',
      resourceType: 'MeetingRequest',
      resourceId: request._id,
      summary: `Deleted attachment "${attachment.name}"`,
    });

    res.json({ success: true, message: 'Attachment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createMeetingRequest,
  getAllMeetingRequests,
  getMyMeetingRequests,
  getMeetingRequest,
  approveMeetingRequest,
  rejectMeetingRequest,
  completeMeeting,
  getAnalytics,
  uploadAttachments,
  downloadAttachment,
  deleteAttachment,
};
