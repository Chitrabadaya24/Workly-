const express = require('express');
const router = express.Router();
const {
  createMeetingRequest,
  getAllMeetingRequests,
  getMyMeetingRequests,
  getMeetingRequest,
  approveMeetingRequest,
  rejectMeetingRequest,
  completeMeeting,
  getAnalytics,
  uploadAttachments,
  downloadAttachment,
  deleteAttachment,
} = require('../controllers/meetingController');
const { protect, authorize } = require('../middleware/auth');
const { uploadRequestAttachments } = require('../middleware/uploadRequestAttachment');
const { MAX_FILES_PER_REQUEST } = require('../config/uploads');

router.get('/analytics', protect, authorize('admin', 'ceo'), getAnalytics);
router.get('/my', protect, authorize('employee'), getMyMeetingRequests);
router.get('/', protect, authorize('admin', 'ceo'), getAllMeetingRequests);
router.post(
  '/',
  protect,
  authorize('employee'),
  uploadRequestAttachments.array('files', MAX_FILES_PER_REQUEST),
  createMeetingRequest
);
router.post(
  '/:id/attachments',
  protect,
  uploadRequestAttachments.array('files', MAX_FILES_PER_REQUEST),
  uploadAttachments
);
router.get('/:id/attachments/:attachmentId', protect, downloadAttachment);
router.delete('/:id/attachments/:attachmentId', protect, deleteAttachment);
router.get('/:id', protect, getMeetingRequest);
router.put('/:id/approve', protect, authorize('ceo'), approveMeetingRequest);
router.put('/:id/reject', protect, authorize('ceo'), rejectMeetingRequest);
router.put('/:id/complete', protect, authorize('ceo'), completeMeeting);

module.exports = router;
