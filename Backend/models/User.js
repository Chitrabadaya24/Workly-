const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: 3,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false,
  },
  role: {
    type: String,
    enum: ['admin', 'ceo', 'employee'],
    required: true,
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  department: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Emergency override tokens for employees
  emergencyTokens: {
    type: Number,
    default: 3,
  },
  emergencyTokenAllowance: {
    type: Number,
    default: 3,
  },
  lastTokenResetAt: {
    type: Date,
  },
  tokenUsageHistory: [{
    usedAt: { type: Date, default: Date.now },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MeetingRequest' },
  }],
  lastLogin: {
    type: Date,
  },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
