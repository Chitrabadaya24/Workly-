const mongoose = require('mongoose');

/**
 * Stores Codeo's conversation history per user.
 * One document per user; messages are appended. This gives Codeo
 * "memory" so it can feel like a continuous teammate, and provides
 * conversation context to plug into an LLM later.
 */
const codeoMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'codeo'],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  // The structured intent/action that Codeo took for this turn (if any).
  action: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const codeoConversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  messages: {
    type: [codeoMessageSchema],
    default: [],
  },
  // In-progress multi-step task collection for Codeo (e.g. missing date/time).
  pendingFlow: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('CodeoConversation', codeoConversationSchema);
