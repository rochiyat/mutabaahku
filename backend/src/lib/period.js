const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/**
 * Reporting period for a date: day 1–7 is week I, 8–14 week II, ... 29–31 week V.
 * Uses the calendar date in `timeZone` so a report sent late at night UTC lands on the right day.
 */
export function periodOf(date = new Date(), timeZone = 'Asia/Jakarta') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);

  const day = get('day');
  return { year: get('year'), month: get('month'), week: Math.ceil(day / 7) };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Number of reporting weeks in a month: 4 for a non-leap February, otherwise 5. */
export function weeksInMonth(year, month) {
  return Math.ceil(daysInMonth(year, month) / 7);
}

export function previousPeriod({ year, month, week }) {
  if (week > 1) return { year, month, week: week - 1 };
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return { year: prevYear, month: prevMonth, week: weeksInMonth(prevYear, prevMonth) };
}

export function samePeriod(a, b) {
  return a.year === b.year && a.month === b.month && a.week === b.week;
}

export function weekLabel(week) {
  return ROMAN[week - 1];
}
