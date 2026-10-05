const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'meeting_approved',
      'meeting_rejected',
      'meeting_pending',
      'meeting_reminder',
      'new_message',
      'deadline_reminder',
      'status_update',
      'emergency_request',
      'token_used',
      'token_reset',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  relatedRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingRequest',
  },
  relatedMeeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
