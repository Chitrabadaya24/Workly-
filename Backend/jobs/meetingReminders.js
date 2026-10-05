const MeetingRequest = require('../models/MeetingRequest');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const MeetingReminder = require('../models/MeetingReminder');
const { notifyUser } = require('../utils/notify');
const { getMeetingStart, formatMeetingWhen } = require('../utils/meetingDateTime');
const { sendMeetingReminderEmail } = require('../utils/email');

function parseOffsets() {
  const raw = process.env.REMINDER_OFFSETS_MINUTES || '15,60';
  return raw.split(',').map((n) => Number(n.trim())).filter((n) => n > 0);
}

async function sendReminder(io, { recipient, sourceType, sourceId, offsetMinutes, title, date, time, meetLink }) {
  const scheduledFor = new Date();
  const exists = await MeetingReminder.findOne({
    sourceType,
    sourceId,
    recipient,
    offsetMinutes,
  });
  if (exists) return;

  const whenLabel = formatMeetingWhen(date, time);
  const minsLabel = offsetMinutes >= 60
    ? `${Math.round(offsetMinutes / 60)} hour(s)`
    : `${offsetMinutes} minutes`;

  await MeetingReminder.create({
    sourceType,
    sourceId,
    recipient,
    offsetMinutes,
    scheduledFor,
  });

  await notifyUser(io, {
    recipient,
    type: 'meeting_reminder',
    title: '⏰ Meeting Reminder',
    message: `"${title}" starts in ${minsLabel} — ${whenLabel}${meetLink ? `\nJoin: ${meetLink}` : ''}`,
    relatedRequest: sourceType === 'MeetingRequest' ? sourceId : undefined,
    relatedMeeting: sourceType === 'Meeting' ? sourceId : undefined,
  });

  const user = await User.findById(recipient).select('email');
  if (user?.email) {
    sendMeetingReminderEmail({
      to: user.email,
      title,
      whenLabel,
      meetLink,
    }).catch((err) => console.error('Email reminder failed:', err.message));
  }
}

async function processMeetingReminders(io) {
  const offsets = parseOffsets();
  const now = new Date();

  for (const offset of offsets) {
    const windowStart = new Date(now.getTime() + offset * 60000 - 60000);
    const windowEnd = new Date(now.getTime() + offset * 60000 + 60000);

    const approvedRequests = await MeetingRequest.find({ status: 'approved' })
      .populate('requestedBy', '_id')
      .limit(200);

    for (const req of approvedRequests) {
      const start = getMeetingStart(req.approvedDate || req.preferredDate, req.approvedTime || req.preferredTime);
      if (!start || start < windowStart || start > windowEnd) continue;

      const ceo = await User.findOne({ role: 'ceo' }).select('_id');
      const recipients = new Set([String(req.requestedBy?._id || req.requestedBy)]);
      if (ceo) recipients.add(String(ceo._id));

      for (const rid of recipients) {
        await sendReminder(io, {
          recipient: rid,
          sourceType: 'MeetingRequest',
          sourceId: req._id,
          offsetMinutes: offset,
          title: req.title,
          date: req.approvedDate || req.preferredDate,
          time: req.approvedTime || req.preferredTime,
        });
      }
    }

    const videoMeetings = await Meeting.find({ status: { $in: ['upcoming', 'live'] } }).limit(200);
    for (const meet of videoMeetings) {
      const start = getMeetingStart(meet.date, meet.time);
      if (!start || start < windowStart || start > windowEnd) continue;

      const recipients = new Set(
        (meet.participants || []).map((p) => String(p._id || p))
      );
      recipients.add(String(meet.createdBy));

      for (const rid of recipients) {
        await sendReminder(io, {
          recipient: rid,
          sourceType: 'Meeting',
          sourceId: meet._id,
          offsetMinutes: offset,
          title: meet.title,
          date: meet.date,
          time: meet.time,
          meetLink: meet.meetLink,
        });
      }
    }
  }
}

module.exports = { processMeetingReminders };
