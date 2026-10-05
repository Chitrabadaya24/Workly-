const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getContacts,
  getConversations,
  findOrCreateConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
} = require('../controllers/chatController');

// All chat routes require authentication. Authorization is participant-based
// inside each handler — roles (admin/ceo) never bypass conversation access.
router.use(protect);

router.get('/contacts', getContacts);
router.get('/unread-count', getUnreadCount);
router.get('/conversations', getConversations);
router.post('/conversations', findOrCreateConversation);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.put('/conversations/:id/read', markConversationRead);

module.exports = router;
