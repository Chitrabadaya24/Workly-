const AuditLog = require('../models/AuditLog');

// @desc    List audit logs
// @route   GET /api/audit
// @access  Admin
const getAuditLogs = async (req, res) => {
  try {
    const {
      action,
      actor,
      resourceType,
      from,
      to,
      page = 1,
      limit = 30,
    } = req.query;

    const query = {};
    if (action) query.action = action;
    if (actor) query.actor = actor;
    if (resourceType) query.resourceType = resourceType;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('actor', 'fullName username role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, total, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAuditLogs };
