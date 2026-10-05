const mongoose = require('mongoose');

/**
 * Strict 1-to-1 conversation. Privacy is enforced in controllers:
 * only participants may read or write. Roles (admin/ceo) do NOT grant access.
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
      ],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length === 2 && String(v[0]) !== String(v[1]);
        },
        message: 'Conversation must have exactly two distinct participants',
      },
    },
    /** Canonical sorted pair key to prevent duplicate 1-to-1 threads */
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastMessage: {
      content: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date },
    },
  },
  { timestamps: true }
);

conversationSchema.statics.buildParticipantKey = function (userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  return a < b ? `${a}_${b}` : `${b}_${a}`;
};

conversationSchema.methods.isParticipant = function (userId) {
  const id = String(userId);
  return this.participants.some((p) => String(p._id || p) === id);
};

module.exports = mongoose.model('Conversation', conversationSchema);
