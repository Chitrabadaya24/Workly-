/**
 * YYYY-MM-DD in the user's local timezone — for FullCalendar event dates.
 * Avoids `.split('T')[0]` on ISO strings, which uses UTC and shifts evening/night zones.
 */
export function toCalendarDateString(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeEventTime(timeStr) {
  if (!timeStr) return '09:00';
  const t = String(timeStr).trim();
  return t.length >= 5 ? t.slice(0, 5) : '09:00';
}

/** Local calendar date + time for FullCalendar (no Z suffix = local). */
export function buildCalendarEventStart(dateValue, timeStr) {
  const dateKey = toCalendarDateString(dateValue);
  if (!dateKey) return null;
  const time = normalizeEventTime(timeStr);
  return `${dateKey}T${time}`;
}
