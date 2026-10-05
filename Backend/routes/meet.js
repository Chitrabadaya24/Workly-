const express = require('express');
const router = express.Router();
const {
  createMeeting, getAllMeetings, getMeeting,
  updateMeeting, deleteMeeting, restoreMeeting, emptyTrash, bulkDeleteTrash, updateStatus, getMeetingStats,
} = require('../controllers/meetingController2');
const { protect, authorize } = require('../middleware/auth');

router.get('/stats', protect, getMeetingStats);
router.get('/', protect, getAllMeetings);
router.delete('/trash', protect, emptyTrash);
router.post('/trash/bulk-delete', protect, bulkDeleteTrash);
router.post('/create', protect, authorize('ceo', 'admin'), createMeeting);
router.get('/:id', protect, getMeeting);
router.put('/:id/status', protect, authorize('ceo', 'admin'), updateStatus);
router.put('/:id/restore', protect, authorize('ceo', 'admin'), restoreMeeting);
router.put('/:id', protect, authorize('ceo', 'admin'), updateMeeting);
router.delete('/:id', protect, deleteMeeting);

module.exports = router;