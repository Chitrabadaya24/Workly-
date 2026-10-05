const User = require('../models/User');
const { notifyUser } = require('../utils/notify');
const { logAudit } = require('../utils/auditLog');

const DEFAULT_ALLOWANCE = Number(process.env.EMERGENCY_TOKEN_DEFAULT) || 3;

async function resetUserTokens(userId, { allowance, req, reason = 'manual_reset' }) {
  const user = await User.findById(userId);
  if (!user) return null;

  const targetAllowance = allowance ?? user.emergencyTokenAllowance ?? DEFAULT_ALLOWANCE;
  const previous = user.emergencyTokens;

  user.emergencyTokens = targetAllowance;
  user.emergencyTokenAllowance = targetAllowance;
  user.lastTokenResetAt = new Date();
  await user.save({ validateBeforeSave: false });

  return { user, previous, targetAllowance, reason };
}

async function resetUserTokensWithSideEffects(userId, options = {}) {
  const { req, io, allowance, reason } = options;
  const result = await resetUserTokens(userId, { allowance, req, reason });
  if (!result) return null;

  const { user, previous, targetAllowance } = result;

  if (io) {
    io.to(`user_${user._id}`).emit('token_reset', {
      emergencyTokens: user.emergencyTokens,
      lastTokenResetAt: user.lastTokenResetAt,
    });
  }

  await notifyUser(io, {
    recipient: user._id,
    type: 'token_reset',
    title: '🎫 Emergency Tokens Reset',
    message: `Your emergency tokens were reset to ${targetAllowance} (was ${previous}).`,
  });

  if (req) {
    await logAudit(req, {
      action: 'token.reset',
      resourceType: 'User',
      resourceId: user._id,
      summary: `Reset emergency tokens for @${user.username} to ${targetAllowance}`,
      metadata: { previous, targetAllowance, reason: options.reason },
    });
  }

  return user;
}

async function resetAllEmployeeTokens(options = {}) {
  const { req, io, allowance } = options;
  const defaultAllowance = allowance ?? DEFAULT_ALLOWANCE;
  const employees = await User.find({ role: 'employee', isActive: true }).select('_id username');

  for (const emp of employees) {
    await resetUserTokensWithSideEffects(emp._id, {
      req,
      io,
      allowance: defaultAllowance,
      reason: 'bulk_reset',
    });
  }

  if (req) {
    await logAudit(req, {
      action: 'token.reset_all',
      resourceType: 'User',
      summary: `Bulk reset emergency tokens for ${employees.length} employees`,
      metadata: { count: employees.length, allowance: defaultAllowance },
    });
  }

  return employees.length;
}

module.exports = {
  resetUserTokens,
  resetUserTokensWithSideEffects,
  resetAllEmployeeTokens,
  DEFAULT_ALLOWANCE,
};
