const User = require('../models/User');
const { logAudit } = require('../utils/auditLog');
const {
  resetUserTokensWithSideEffects,
  resetAllEmployeeTokens,
} = require('../services/emergencyTokenService');

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
const getAllUsers = async (req, res) => {
  try {
    const { role, isActive, search, page = 1, limit = 20, department } = req.query;
    const query = {};

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (department) {
      query.department = new RegExp(department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      count: users.length,
      total,
      users,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Admin
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create user (admin only)
// @route   POST /api/users
// @access  Admin
const createUser = async (req, res) => {
  try {
    const { password, role, fullName, email, department } = req.body;
    const username = String(req.body.username || '').trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3–30 characters (letters, numbers, . _ -)',
      });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const user = await User.create({
      username,
      password,
      role,
      fullName,
      email,
      department,
    });

    await logAudit(req, {
      action: 'user.create',
      resourceType: 'User',
      resourceId: user._id,
      summary: `Created user @${username} (${role})`,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Admin
const updateUser = async (req, res) => {
  try {
    const { username, fullName, email, department, role, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (username) user.username = username;
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (department !== undefined) user.department = department;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save({ validateBeforeSave: false });

    await logAudit(req, {
      action: 'user.update',
      resourceType: 'User',
      resourceId: user._id,
      summary: `Updated user @${user.username}`,
    });

    res.json({ success: true, message: 'User updated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reset user password
// @route   PUT /api/users/:id/reset-password
// @access  Admin
const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();

    await logAudit(req, {
      action: 'user.reset_password',
      resourceType: 'User',
      resourceId: user._id,
      summary: `Reset password for @${user.username}`,
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/users/:id/toggle-status
// @access  Admin
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    await logAudit(req, {
      action: 'user.toggle_status',
      resourceType: 'User',
      resourceId: user._id,
      summary: `${user.isActive ? 'Activated' : 'Deactivated'} @${user.username}`,
    });

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await user.deleteOne();

    await logAudit(req, {
      action: 'user.delete',
      resourceType: 'User',
      resourceId: user._id,
      summary: `Deleted user @${user.username}`,
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update own profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, department } = req.body;
    const user = await User.findById(req.user.id);

    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (department) user.department = department;

    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// @desc    Reset one user's emergency tokens
// @route   PUT /api/users/:id/reset-emergency-tokens
const resetEmergencyTokens = async (req, res) => {
  try {
    const { allowance } = req.body;
    const io = req.app.get('io');
    const user = await resetUserTokensWithSideEffects(req.params.id, {
      req,
      io,
      allowance,
      reason: 'admin_reset',
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      message: 'Emergency tokens reset',
      emergencyTokens: user.emergencyTokens,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' });
  }
};

// @desc    Bulk reset all employee emergency tokens
// @route   POST /api/users/reset-emergency-tokens
const resetAllEmergencyTokens = async (req, res) => {
  try {
    const { allowance } = req.body;
    const io = req.app.get('io');
    const count = await resetAllEmployeeTokens({ req, io, allowance });
    res.json({ success: true, message: `Reset tokens for ${count} employees`, count });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Server error' });
  }
};

// @desc    Own emergency token usage history
// @route   GET /api/users/me/token-history
const getMyTokenHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('emergencyTokens emergencyTokenAllowance lastTokenResetAt tokenUsageHistory');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      emergencyTokens: user.emergencyTokens,
      emergencyTokenAllowance: user.emergencyTokenAllowance,
      lastTokenResetAt: user.lastTokenResetAt,
      tokenUsageHistory: user.tokenUsageHistory || [],
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    List distinct departments
// @route   GET /api/users/departments/list
const getDepartments = async (req, res) => {
  try {
    const departments = await User.distinct('department', {
      department: { $ne: '' },
      isActive: true,
    });
    res.json({ success: true, departments: departments.sort() });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
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
};
