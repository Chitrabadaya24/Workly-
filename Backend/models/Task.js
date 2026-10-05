const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  // Who the task is assigned to (employee or team-member user)
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Who created / assigned the task (CEO / admin / Codeo on their behalf)
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Optional free-text department label (e.g. "HR", "frontend") so the
  // CEO can say "assign task to HR team" before we resolve a concrete user.
  team: {
    type: String,
    trim: true,
    default: '',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'completed', 'cancelled'],
    default: 'todo',
  },
  dueDate: {
    type: Date,
  },
  // Marks tasks that Codeo created from a natural-language command,
  // useful for analytics / "what did Codeo do for me".
  createdByCodeo: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
