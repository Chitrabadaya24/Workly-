/**
 * Build a local Date from stored date + HH:mm time string.
 */
function getMeetingStart(date, time) {
  if (!date || !time) return null;
  const dateStr = date instanceof Date
    ? date.toISOString().split('T')[0]
    : String(date).split('T')[0];
  const normalizedTime = String(time).length === 5 ? `${time}:00` : String(time);
  const start = new Date(`${dateStr}T${normalizedTime}`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function formatMeetingWhen(date, time) {
  const start = getMeetingStart(date, time);
  if (!start) return 'soon';
  return start.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

module.exports = { getMeetingStart, formatMeetingWhen };
