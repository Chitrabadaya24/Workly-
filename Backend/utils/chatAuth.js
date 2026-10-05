const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');

/**
 * Load a conversation only if the authenticated user is a participant.
 * Returns 404 for both missing and unauthorized to reduce IDOR enumeration.
 * Admin/ceo roles do NOT bypass this check.
 */
const getAuthorizedConversation = async (conversationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return { error: { status: 404, message: 'Conversation not found' } };
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.isParticipant(userId)) {
    return { error: { status: 404, message: 'Conversation not found' } };
  }

  return { conversation };
};

const getOtherParticipantId = (conversation, userId) => {
  const me = String(userId);
  const other = conversation.participants.find((p) => String(p._id || p) !== me);
  return other ? String(other._id || other) : null;
};

module.exports = { getAuthorizedConversation, getOtherParticipantId };
