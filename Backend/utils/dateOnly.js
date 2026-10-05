/**
 * Normalize a calendar date (no time-of-day) for storage.
 * Uses UTC noon on the given YYYY-MM-DD so Mongo/JSON does not shift the day.
 */
function normalizeDateOnly(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(`${s}T12:00:00.000Z`);
    }
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  // Preserve calendar day in server local time (matches codeo "tomorrow" parsing).
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0));
}

module.exports = { normalizeDateOnly };
