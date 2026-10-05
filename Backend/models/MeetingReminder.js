const mongoose = require('mongoose');

const meetingReminderSchema = new mongoose.Schema({
  sourceType: {
    type: String,
    enum: ['MeetingRequest', 'Meeting'],
    required: true,
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  offsetMinutes: {
    type: Number,
    required: true,
  },
  scheduledFor: {
    type: Date,
    required: true,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

meetingReminderSchema.index(
  { sourceType: 1, sourceId: 1, recipient: 1, offsetMinutes: 1 },
  { unique: true }
);

module.exports = mongoose.model('MeetingReminder', meetingReminderSchema);
