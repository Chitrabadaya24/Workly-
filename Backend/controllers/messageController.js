const Message = require('../models/Message');
const MeetingRequest = require('../models/MeetingRequest');
const Notification = require('../models/Notification');

// @desc    Send a message in a meeting thread
// @route   POST /api/messages/:requestId
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const io = req.app.get('io');

    const meetingRequest = await MeetingRequest.findById(req.params.requestId)
      .populate('requestedBy', 'fullName');

    if (!meetingRequest) {
      return res.status(404).json({ success: false, message: 'Meeting request not found' });
    }

    // Employees can only message in their own requests
    if (
      req.user.role === 'employee' &&
      meetingRequest.requestedBy._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const message = await Message.create({
      meetingRequest: req.params.requestId,
      sender: req.user.id,
      content,
    });

    await message.populate('sender', 'fullName username role avatar');

    // Real-time emit to the room
    io.to(`request_${req.params.requestId}`).emit('new_message', message);

    // Notify the other party
    let notifyUserId;
    if (req.user.role === 'employee') {
      const ceoUser = await require('../models/User').findOne({ role: 'ceo' });
      if (ceoUser) notifyUserId = ceoUser._id;
    } else {
      notifyUserId = meetingRequest.requestedBy._id;
    }

    if (notifyUserId) {
      const notification = await Notification.create({
        recipient: notifyUserId,
        type: 'new_message',
        title: '💬 New Message',
        message: `${req.user.fullName} sent a message in "${meetingRequest.title}"`,
        relatedRequest: meetingRequest._id,
      });
      io.to(`user_${notifyUserId}`).emit('new_notification', notification);
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get messages for a meeting request
// @route   GET /api/messages/:requestId
// @access  Private
const getMessages = async (req, res) => {
  try {
    const meetingRequest = await MeetingRequest.findById(req.params.requestId);
    if (!meetingRequest) {
      return res.status(404).json({ success: false, message: 'Meeting request not found' });
    }

    if (
      req.user.role === 'employee' &&
      meetingRequest.requestedBy.toString() !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const messages = await Message.find({ meetingRequest: req.params.requestId })
      .populate('sender', 'fullName username role avatar')
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      {
        meetingRequest: req.params.requestId,
        sender: { $ne: req.user.id },
        isRead: false,
      },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { sendMessage, getMessages };
