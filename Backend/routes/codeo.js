const express = require('express');
const router = express.Router();
const { sendMessage, getHistory } = require('../controllers/codeoController');
const { protect } = require('../middleware/auth');

router.post('/message', protect, sendMessage);
router.get('/history', protect, getHistory);

module.exports = router;
