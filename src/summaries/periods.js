/**
 * Period keys and date ranges for day / week (Sun–Sat) / month.
 * All dates in UTC for consistency with stored published_at.
 */

export function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function lastWeekKeyAndRange() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const lastSunday = new Date(now);
  lastSunday.setUTCDate(now.getUTCDate() - dayOfWeek - 7);
  const lastSaturday = new Date(lastSunday);
  lastSaturday.setUTCDate(lastSunday.getUTCDate() + 6);
  const key = lastSunday.toISOString().slice(0, 10);
  const since = lastSunday.toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const until = lastSaturday.toISOString().slice(0, 10) + 'T23:59:59.999Z';
  return { key, since, until };
}

export function lastMonthKeyAndRange() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const lastMonth = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0));
  const key = `${lastMonth.getUTCFullYear()}-${String(lastMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  const since = lastMonth.toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const until = lastDay.toISOString().slice(0, 10) + 'T23:59:59.999Z';
  return { key, since, until };
}

export function yesterdayRange() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const day = d.toISOString().slice(0, 10);
  const since = day + 'T00:00:00.000Z';
  const until = day + 'T23:59:59.999Z';
  return { since, until };
}
