const { resetAllEmployeeTokens } = require('../services/emergencyTokenService');

async function runEmergencyTokenReset(app) {
  const io = app.get('io');
  const count = await resetAllEmployeeTokens({
    io,
    reason: 'scheduled_reset',
  });
  console.log(`🎫 Scheduled emergency token reset for ${count} employees`);
}

module.exports = { runEmergencyTokenReset };
