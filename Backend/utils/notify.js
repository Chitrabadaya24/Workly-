const Notification = require('../models/Notification');

/**
 * Create an in-app notification and emit via Socket.IO.
 */
async function notifyUser(io, { recipient, type, title, message, relatedRequest, relatedMeeting }) {
  const notification = await Notification.create({
    recipient,
    type,
    title,
    message,
    relatedRequest: relatedRequest || undefined,
    relatedMeeting: relatedMeeting || undefined,
  });

  if (io && recipient) {
    io.to(`user_${recipient}`).emit('new_notification', notification.toObject());
  }

  return notification;
}

module.exports = { notifyUser };
