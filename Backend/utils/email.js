const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

async function sendMeetingReminderEmail({ to, title, whenLabel, meetLink }) {
  const tx = getTransporter();
  if (!tx || !to) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const lines = [
    `Reminder: "${title}"`,
    `When: ${whenLabel}`,
    meetLink ? `Join: ${meetLink}` : null,
  ].filter(Boolean);

  await tx.sendMail({
    from,
    to,
    subject: `Meeting reminder — ${title}`,
    text: lines.join('\n'),
  });
  return true;
}

module.exports = { sendMeetingReminderEmail };
