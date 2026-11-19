import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodOf, previousPeriod, weekLabel, weeksInMonth } from '../src/lib/period.js';

const jkt = (iso) => new Date(`${iso}T12:00:00+07:00`);

test('week boundaries follow day of month', () => {
  assert.deepEqual(periodOf(jkt('2026-11-01')), { year: 2026, month: 11, week: 1 });
  assert.deepEqual(periodOf(jkt('2026-11-07')), { year: 2026, month: 11, week: 1 });
  assert.deepEqual(periodOf(jkt('2026-11-08')), { year: 2026, month: 11, week: 2 });
  assert.deepEqual(periodOf(jkt('2026-11-28')), { year: 2026, month: 11, week: 4 });
  assert.deepEqual(periodOf(jkt('2026-12-31')), { year: 2026, month: 12, week: 5 });
});

test('uses Jakarta date, not UTC date', () => {
  // 2026-11-30 20:00 UTC is already 2026-12-01 03:00 in Jakarta.
  assert.deepEqual(periodOf(new Date('2026-11-30T20:00:00Z')), { year: 2026, month: 12, week: 1 });
});

test('weekLabel returns roman numerals', () => {
  assert.equal(weekLabel(1), 'I');
  assert.equal(weekLabel(5), 'V');
});

test('previousPeriod steps back across months and years', () => {
  assert.deepEqual(previousPeriod({ year: 2026, month: 11, week: 3 }), { year: 2026, month: 11, week: 2 });
  assert.deepEqual(previousPeriod({ year: 2026, month: 12, week: 1 }), { year: 2026, month: 11, week: 5 });
  assert.deepEqual(previousPeriod({ year: 2027, month: 1, week: 1 }), { year: 2026, month: 12, week: 5 });
  // Non-leap February has only 4 weeks; leap February has 5 (day 29).
  assert.deepEqual(previousPeriod({ year: 2027, month: 3, week: 1 }), { year: 2027, month: 2, week: 4 });
  assert.deepEqual(previousPeriod({ year: 2028, month: 3, week: 1 }), { year: 2028, month: 2, week: 5 });
  assert.equal(weeksInMonth(2026, 11), 5);
});
