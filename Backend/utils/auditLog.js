const AuditLog = require('../models/AuditLog');

async function logAudit(req, { action, resourceType, resourceId, summary, metadata }) {
  if (!req?.user?.id) return null;

  try {
    return await AuditLog.create({
      actor: req.user.id,
      actorRole: req.user.role,
      action,
      resourceType: resourceType || '',
      resourceId: resourceId || undefined,
      summary,
      metadata: metadata || {},
      ip: req.ip || req.headers?.['x-forwarded-for'] || '',
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
    return null;
  }
}

module.exports = { logAudit };
