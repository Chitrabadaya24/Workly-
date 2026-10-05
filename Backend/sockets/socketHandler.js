const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const {
  addOnlineSocket,
  removeOnlineSocket,
  isUserOnline,
} = require('./presence');

const setupSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user || !user.isActive) return next(new Error('Authentication error'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 User connected: ${user.username} (${user.role})`);

    socket.join(`user_${user._id}`);

    const wasOffline = !isUserOnline(user._id);
    addOnlineSocket(user._id, socket.id);
    if (wasOffline) {
      socket.broadcast.emit('user_presence', {
        userId: String(user._id),
        isOnline: true,
      });
    }

    socket.on('join_request_room', (requestId) => {
      socket.join(`request_${requestId}`);
    });

    socket.on('leave_request_room', (requestId) => {
      socket.leave(`request_${requestId}`);
    });

    // Private chat typing — only peers in the conversation may receive it
    socket.on('private_typing', async ({ conversationId }) => {
      try {
        if (!conversationId) return;
        const conversation = await Conversation.findById(conversationId).select('participants');
        if (!conversation || !conversation.isParticipant(user._id)) return;

        const other = conversation.participants.find((p) => String(p) !== String(user._id));
        if (!other) return;

        io.to(`user_${other}`).emit('private_user_typing', {
          conversationId: String(conversationId),
          userId: String(user._id),
          userName: user.fullName,
        });
      } catch {
        /* ignore */
      }
    });

    socket.on('private_stop_typing', async ({ conversationId }) => {
      try {
        if (!conversationId) return;
        const conversation = await Conversation.findById(conversationId).select('participants');
        if (!conversation || !conversation.isParticipant(user._id)) return;

        const other = conversation.participants.find((p) => String(p) !== String(user._id));
        if (!other) return;

        io.to(`user_${other}`).emit('private_user_stop_typing', {
          conversationId: String(conversationId),
          userId: String(user._id),
        });
      } catch {
        /* ignore */
      }
    });

    socket.on('typing', ({ requestId }) => {
      socket.to(`request_${requestId}`).emit('user_typing', {
        userId: user._id,
        userName: user.fullName,
      });
    });

    socket.on('stop_typing', ({ requestId }) => {
      socket.to(`request_${requestId}`).emit('user_stop_typing', { userId: user._id });
    });

    socket.on('disconnect', () => {
      const wentOffline = removeOnlineSocket(user._id, socket.id);
      if (wentOffline) {
        socket.broadcast.emit('user_presence', {
          userId: String(user._id),
          isOnline: false,
        });
      }
      console.log(`🔌 User disconnected: ${user.username}`);
    });
  });
};

module.exports = setupSocket;
