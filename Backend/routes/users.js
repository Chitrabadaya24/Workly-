const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  resetPassword,
  toggleUserStatus,
  deleteUser,
  updateProfile,
  resetEmergencyTokens,
  resetAllEmergencyTokens,
  getMyTokenHistory,
  getDepartments,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Own profile
router.put('/profile', protect, updateProfile);

router.get('/me/token-history', protect, getMyTokenHistory);
router.get('/departments/list', protect, authorize('admin', 'ceo'), getDepartments);
router.post('/reset-emergency-tokens', protect, authorize('admin'), resetAllEmergencyTokens);

// Participants list — CEO & Admin
router.get('/participants', protect, authorize('ceo', 'admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const users = await User.find({
      isActive: true,
      role: { $in: ['employee', 'ceo'] }
    }).select('fullName username department role').sort({ fullName: 1 });
    res.json({ success: true, users });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin only routes
router.get('/', protect, authorize('admin'), getAllUsers);
router.post('/', protect, authorize('admin'), createUser);
router.get('/:id', protect, authorize('admin'), getUser);
router.put('/:id', protect, authorize('admin'), updateUser);
router.put('/:id/reset-password', protect, authorize('admin'), resetPassword);
router.put('/:id/reset-emergency-tokens', protect, authorize('admin'), resetEmergencyTokens);
router.put('/:id/toggle-status', protect, authorize('admin'), toggleUserStatus);
router.delete('/:id', protect, authorize('admin'), deleteUser);

module.exports = router;