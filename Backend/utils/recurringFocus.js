const mongoose = require('mongoose');

/**
 * Expand a recurring focus block template into concrete instances.
 */
function expandRecurringBlocks(template, weeksAhead = 8) {
  const rec = template.recurrence || {};
  if (!rec.enabled) {
    return [{ ...template, isSeriesTemplate: false }];
  }

  const seriesId = template.parentSeriesId || new mongoose.Types.ObjectId();
  const start = new Date(template.startTime);
  const end = new Date(template.endTime);
  const durationMs = end.getTime() - start.getTime();
  const until = rec.endDate
    ? new Date(rec.endDate)
    : new Date(Date.now() + weeksAhead * 7 * 24 * 60 * 60 * 1000);

  const instances = [];
  const frequency = rec.frequency || 'weekly';
  const interval = rec.interval || 1;
  const daysOfWeek = rec.daysOfWeek?.length ? rec.daysOfWeek : [start.getDay()];

  if (frequency === 'daily') {
    let cursor = new Date(start);
    while (cursor <= until) {
      const instEnd = new Date(cursor.getTime() + durationMs);
      instances.push({
        title: template.title,
        startTime: new Date(cursor),
        endTime: instEnd,
        type: template.type,
        recurrence: { ...rec, enabled: false },
        isSeriesTemplate: false,
        parentSeriesId: seriesId,
      });
      cursor.setDate(cursor.getDate() + interval);
    }
    return instances;
  }

  if (frequency === 'weekly') {
    let weekStart = new Date(start);
    weekStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
    const maxWeeks = Math.ceil((until - start) / (7 * 24 * 60 * 60 * 1000)) + 1;

    for (let w = 0; w < maxWeeks; w += interval) {
      for (const dow of daysOfWeek) {
        const instStart = new Date(weekStart);
        const dayDiff = dow - instStart.getDay();
        instStart.setDate(instStart.getDate() + dayDiff + w * 7);
        instStart.setHours(start.getHours(), start.getMinutes(), 0, 0);

        if (instStart < start || instStart > until) continue;

        instances.push({
          title: template.title,
          startTime: new Date(instStart),
          endTime: new Date(instStart.getTime() + durationMs),
          type: template.type,
          recurrence: { ...rec, enabled: false },
          isSeriesTemplate: false,
          parentSeriesId: seriesId,
        });
      }
    }
    return instances.length ? instances : [{
      ...template,
      parentSeriesId: seriesId,
      isSeriesTemplate: true,
      recurrence: { ...rec, enabled: true },
    }];
  }

  // monthly: same day-of-month
  let cursor = new Date(start);
  while (cursor <= until) {
    instances.push({
      title: template.title,
      startTime: new Date(cursor),
      endTime: new Date(cursor.getTime() + durationMs),
      type: template.type,
      recurrence: { ...rec, enabled: false },
      isSeriesTemplate: false,
      parentSeriesId: seriesId,
    });
    cursor.setMonth(cursor.getMonth() + interval);
  }

  return instances;
}

module.exports = { expandRecurringBlocks };
