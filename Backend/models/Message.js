const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  meetingRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingRequest',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
