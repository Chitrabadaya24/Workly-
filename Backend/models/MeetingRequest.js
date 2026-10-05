const mongoose = require('mongoose');

const meetingRequestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  purpose: {
    type: String,
    required: [true, 'Purpose is required'],
  },
  agenda: {
    type: String,
    required: [true, 'Agenda is required'],
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'low',
  },
  preferredDate: {
    type: Date,
    required: [true, 'Preferred date is required'],
  },
  preferredTime: {
    type: String,
    required: [true, 'Preferred time is required'],
  },
  duration: {
    type: Number, // minutes
    default: 30,
  },
  notes: {
    type: String,
    default: '',
  },
  attachments: [{
    name: String,
    storedName: String,
    mimeType: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now },
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending',
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  rejectionReason: {
    type: String,
  },
  ceoComment: {
    type: String,
  },
  isEmergencyToken: {
    type: Boolean,
    default: false,
  },
  // For approved meetings
  approvedDate: {
    type: Date,
  },
  approvedTime: {
    type: String,
  },
  // Decision tracking
  meetingSummary: {
    type: String,
  },
  decisions: [{
    decision: String,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deadline: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
    },
    createdAt: { type: Date, default: Date.now },
  }],
  completedAt: {
    type: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('MeetingRequest', meetingRequestSchema);
