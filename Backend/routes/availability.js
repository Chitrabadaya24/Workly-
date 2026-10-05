const express = require('express');
const router = express.Router();
const {
  getAvailability,
  updateAvailability,
  addFocusBlock,
  removeFocusBlock,
} = require('../controllers/availabilityController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getAvailability);
router.put('/', protect, authorize('ceo'), updateAvailability);
router.post('/focus-block', protect, authorize('ceo'), addFocusBlock);
router.delete('/focus-block/:blockId', protect, authorize('ceo'), removeFocusBlock);

module.exports = router;
