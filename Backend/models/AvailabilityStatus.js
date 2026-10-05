const mongoose = require('mongoose');

const availabilityStatusSchema = new mongoose.Schema({
  ceo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['available', 'in_meeting', 'deep_work', 'emergency_only', 'offline'],
    default: 'available',
  },
  message: {
    type: String,
    default: '',
  },
  // Schedule focus blocks
  focusBlocks: [{
    title: String,
    startTime: Date,
    endTime: Date,
    type: {
      type: String,
      enum: ['deep_work', 'focus', 'unavailable'],
    },
    recurrence: {
      enabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
      interval: { type: Number, default: 1 },
      daysOfWeek: [Number],
      endDate: Date,
    },
    parentSeriesId: mongoose.Schema.Types.ObjectId,
    isSeriesTemplate: { type: Boolean, default: false },
  }],
  // Available time slots for meetings
  availableSlots: [{
    date: Date,
    startTime: String,
    endTime: String,
    isBooked: { type: Boolean, default: false },
  }],
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('AvailabilityStatus', availabilityStatusSchema);
