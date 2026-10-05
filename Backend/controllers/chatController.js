const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const PrivateMessage = require('../models/PrivateMessage');
const { getAuthorizedConversation, getOtherParticipantId } = require('../utils/chatAuth');
const { isUserOnline } = require('../sockets/presence');

const PUBLIC_USER_FIELDS = 'fullName username role department avatar isActive';

const assertValidPeer = async (peerId, selfId) => {
  if (!mongoose.Types.ObjectId.isValid(peerId)) {
    return { error: { status: 400, message: 'Invalid user id' } };
  }
  if (String(peerId) === String(selfId)) {
    return { error: { status: 400, message: 'Cannot start a conversation with yourself' } };
  }
  const peer = await User.findById(peerId).select(PUBLIC_USER_FIELDS);
  if (!peer || !peer.isActive) {
    return { error: { status: 404, message: 'User not found' } };
  }
  return { peer };
};

// @desc    Search / list users available for private chat
// @route   GET /api/chat/contacts
// @access  Private
const getContacts = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = {
      _id: { $ne: req.user._id },
      isActive: true,
    };

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ fullName: rx }, { username: rx }, { email: rx }, { department: rx }];
    }

    const users = await User.find(filter)
      .select(PUBLIC_USER_FIELDS)
      .sort({ fullName: 1 })
      .limit(50)
      .lean();

    const myId = req.user._id;
    const unreadByUser = await PrivateMessage.aggregate([
      { $match: { receiver: myId, read: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
    ]);
    const unreadMap = Object.fromEntries(unreadByUser.map((r) => [String(r._id), r.count]));

    const contacts = users.map((u) => ({
      ...u,
      isOnline: isUserOnline(u._id),
      unreadCount: unreadMap[String(u._id)] || 0,
    }));

    res.json({ success: true, contacts });
  } catch (error) {
    console.error('getContacts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    List conversations for the logged-in user only
// @route   GET /api/chat/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const myId = req.user._id;
    const conversations = await Conversation.find({ participants: myId })
      .populate('participants', PUBLIC_USER_FIELDS)
      .populate('lastMessage.sender', 'fullName')
      .sort({ updatedAt: -1 })
      .lean();

    const conversationIds = conversations.map((c) => c._id);
    const unreadCounts = await PrivateMessage.aggregate([
      {
        $match: {
          conversation: { $in: conversationIds },
          receiver: myId,
          read: false,
        },
      },
      { $group: { _id: '$conversation', count: { $sum: 1 } } },
    ]);
    const unreadMap = Object.fromEntries(unreadCounts.map((r) => [String(r._id), r.count]));

    const data = conversations.map((c) => {
      const other = c.participants.find((p) => String(p._id) !== String(myId));
      return {
        _id: c._id,
        otherUser: other
          ? { ...other, isOnline: isUserOnline(other._id) }
          : null,
        lastMessage: c.lastMessage,
        unreadCount: unreadMap[String(c._id)] || 0,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
      };
    });

    res.json({ success: true, conversations: data });
  } catch (error) {
    console.error('getConversations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Find or create a 1-to-1 conversation with another user
// @route   POST /api/chat/conversations
// @access  Private
const findOrCreateConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    const peerCheck = await assertValidPeer(participantId, req.user._id);
    if (peerCheck.error) {
      return res.status(peerCheck.error.status).json({ success: false, message: peerCheck.error.message });
    }

    const participantKey = Conversation.buildParticipantKey(req.user._id, participantId);
    let conversation = await Conversation.findOne({ participantKey });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, participantId],
        participantKey,
      });
    }

    await conversation.populate('participants', PUBLIC_USER_FIELDS);

    const other = conversation.participants.find((p) => String(p._id) !== String(req.user._id));
    res.json({
      success: true,
      conversation: {
        _id: conversation._id,
        otherUser: other ? { ...other.toObject(), isOnline: isUserOnline(other._id) } : null,
        lastMessage: conversation.lastMessage,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      // Race: another request created the same pair — fetch it
      const participantKey = Conversation.buildParticipantKey(req.user._id, req.body.participantId);
      const conversation = await Conversation.findOne({ participantKey }).populate(
        'participants',
        PUBLIC_USER_FIELDS
      );
      if (conversation && conversation.isParticipant(req.user._id)) {
        const other = conversation.participants.find((p) => String(p._id) !== String(req.user._id));
        return res.json({
          success: true,
          conversation: {
            _id: conversation._id,
            otherUser: other ? { ...other.toObject(), isOnline: isUserOnline(other._id) } : null,
            lastMessage: conversation.lastMessage,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          },
        });
      }
    }
    console.error('findOrCreateConversation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get messages for a conversation (participant-only)
// @route   GET /api/chat/conversations/:id/messages
// @access  Private
const getMessages = async (req, res) => {
  try {
    const { error, conversation } = await getAuthorizedConversation(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before;

    const query = { conversation: conversation._id };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      const beforeMsg = await PrivateMessage.findOne({
        _id: before,
        conversation: conversation._id,
      }).select('createdAt');
      if (beforeMsg) {
        query.createdAt = { $lt: beforeMsg.createdAt };
      }
    }

    const messages = await PrivateMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'fullName username avatar role')
      .populate('receiver', 'fullName username avatar role')
      .lean();

    res.json({
      success: true,
      messages: messages.reverse(),
      conversationId: conversation._id,
    });
  } catch (error) {
    console.error('getMessages (chat) error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Send a private message (participant-only)
// @route   POST /api/chat/conversations/:id/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const content = (req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }
    if (content.length > 4000) {
      return res.status(400).json({ success: false, message: 'Message is too long' });
    }

    const { error, conversation } = await getAuthorizedConversation(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const receiverId = getOtherParticipantId(conversation, req.user._id);
    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'Invalid conversation' });
    }

    const message = await PrivateMessage.create({
      conversation: conversation._id,
      sender: req.user._id,
      receiver: receiverId,
      content,
    });

    conversation.lastMessage = {
      content: content.slice(0, 200),
      sender: req.user._id,
      createdAt: message.createdAt,
    };
    await conversation.save();

    await message.populate('sender', 'fullName username avatar role');
    await message.populate('receiver', 'fullName username avatar role');

    const io = req.app.get('io');
    if (io) {
      const payload = {
        message,
        conversationId: String(conversation._id),
      };
      // Deliver only to the two participants' personal rooms
      io.to(`user_${req.user._id}`).emit('private_message', payload);
      io.to(`user_${receiverId}`).emit('private_message', payload);
      io.to(`user_${receiverId}`).emit('private_message_unread', {
        conversationId: String(conversation._id),
        fromUserId: String(req.user._id),
      });
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('sendMessage (chat) error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark messages in a conversation as read (receiver = me only)
// @route   PUT /api/chat/conversations/:id/read
// @access  Private
const markConversationRead = async (req, res) => {
  try {
    const { error, conversation } = await getAuthorizedConversation(req.params.id, req.user._id);
    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    const result = await PrivateMessage.updateMany(
      {
        conversation: conversation._id,
        receiver: req.user._id,
        read: false,
      },
      { $set: { read: true, readAt: new Date() } }
    );

    const io = req.app.get('io');
    const otherId = getOtherParticipantId(conversation, req.user._id);
    if (io && otherId) {
      io.to(`user_${otherId}`).emit('private_messages_read', {
        conversationId: String(conversation._id),
        readerId: String(req.user._id),
      });
    }

    res.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('markConversationRead error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Total unread private messages for badge
// @route   GET /api/chat/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await PrivateMessage.countDocuments({
      receiver: req.user._id,
      read: false,
    });
    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getContacts,
  getConversations,
  findOrCreateConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
};
