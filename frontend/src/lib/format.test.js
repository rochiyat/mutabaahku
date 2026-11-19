import { describe, expect, test } from 'vitest';
import { historyToPoints } from '../components/TrendChart';
import { MONTHS, formatScore, periodKey, periodTitle, scoreTone } from './format';

describe('format', () => {
  test('periodTitle uses Indonesian month names', () => {
    expect(periodTitle({ year: 2026, month: 11, week: 3, weekLabel: 'III' })).toBe('Pekan III · November 2026');
    expect(MONTHS).toHaveLength(12);
  });

  test('periodKey is stable for cache keys', () => {
    expect(periodKey({ year: 2026, month: 1, week: 5 })).toBe('2026-1-5');
  });

  test('formatScore uses a decimal comma and one decimal at most', () => {
    expect(formatScore(81.83)).toBe('81,8');
    expect(formatScore(100)).toBe('100');
    expect(formatScore('95.5')).toBe('95,5');
  });

  test('scoreTone bands', () => {
    expect(scoreTone(100).label).toBe('Sangat baik');
    expect(scoreTone(80).label).toBe('Sangat baik');
    expect(scoreTone(79.9).label).toBe('Baik');
    expect(scoreTone(40).label).toBe('Cukup');
    expect(scoreTone(39).label).toBe('Perlu ditingkatkan');
  });
});

describe('historyToPoints', () => {
  const report = (week, totalScore) => ({ year: 2026, month: 11, week, weekLabel: String(week), totalScore });

  test('turns newest-first history into oldest-first chart points', () => {
    const points = historyToPoints([report(3, 90), report(2, 80), report(1, 70)]);
    expect(points.map((p) => p.week)).toEqual([1, 2, 3]);
    expect(points.map((p) => p.average)).toEqual([70, 80, 90]);
  });

  test('keeps only the most recent n weeks and does not mutate input', () => {
    const history = [report(4, 1), report(3, 2), report(2, 3), report(1, 4)];
    const copy = structuredClone(history);
    expect(historyToPoints(history, 2).map((p) => p.week)).toEqual([3, 4]);
    expect(history).toEqual(copy);
  });
});
