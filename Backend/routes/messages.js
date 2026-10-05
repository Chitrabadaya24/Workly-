const express = require('express');
const router = express.Router();
const { sendMessage, getMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.get('/:requestId', protect, getMessages);
router.post('/:requestId', protect, sendMessage);

module.exports = router;
