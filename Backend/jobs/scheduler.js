const cron = require('node-cron');
const { processMeetingReminders } = require('./meetingReminders');
const { runEmergencyTokenReset } = require('./emergencyTokenReset');

function startScheduler(app) {
  // Meeting reminders — every minute
  cron.schedule('* * * * *', () => {
    const io = app.get('io');
    processMeetingReminders(io).catch((err) => {
      console.error('Meeting reminder job failed:', err.message);
    });
  });

  // Emergency token reset — default: 1st of month at midnight
  const tokenCron = process.env.EMERGENCY_TOKEN_RESET_CRON || '0 0 1 * *';
  if (cron.validate(tokenCron)) {
    cron.schedule(tokenCron, () => {
      runEmergencyTokenReset(app).catch((err) => {
        console.error('Token reset job failed:', err.message);
      });
    });
  }

  console.log('⏱ Scheduler started (meeting reminders + token reset)');
}

module.exports = { startScheduler };
