import { config } from '../config.js';
import { db } from '../db/knex.js';
import { badRequest } from '../lib/http-error.js';
import { periodOf, previousPeriod, samePeriod, weekLabel } from '../lib/period.js';
import { listActiveIndicators } from './indicators.js';

const withLabel = (p) => ({ ...p, weekLabel: weekLabel(p.week) });

/** Periods a member may submit for: this week, plus last week for late reports. */
export function submittablePeriods(now = new Date()) {
  const current = periodOf(now, config.timeZone);
  return { current: withLabel(current), previous: withLabel(previousPeriod(current)) };
}

function toReport(row, answers) {
  return {
    id: row.id,
    year: row.year,
    month: row.month,
    week: row.week,
    weekLabel: weekLabel(row.week),
    totalScore: Number(row.total_score),
    resumeText: row.resume_text,
    answers: answers.map((a) => ({ indicatorId: a.indicator_id, optionId: a.option_id, score: a.score })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getReport(userId, { year, month, week }) {
  const row = await db('reports').where({ user_id: userId, year, month, week }).first();
  if (!row) return null;
  const answers = await db('report_answers').where({ report_id: row.id }).orderBy('indicator_id');
  return toReport(row, answers);
}

export async function listHistory(userId, limit) {
  const rows = await db('reports')
    .where({ user_id: userId })
    .orderBy([
      { column: 'year', order: 'desc' },
      { column: 'month', order: 'desc' },
      { column: 'week', order: 'desc' },
    ])
    .limit(limit)
    .select('id', 'year', 'month', 'week', 'total_score', 'updated_at');
  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    week: r.week,
    weekLabel: weekLabel(r.week),
    totalScore: Number(r.total_score),
    updatedAt: r.updated_at,
  }));
}

/**
 * Create or replace the member's report for a period.
 * Every active indicator must be answered exactly once with one of its own options.
 */
export async function upsertReport(userId, { period, answers, resumeText }, now = new Date()) {
  const { current, previous } = submittablePeriods(now);
  const target = period ?? current;
  if (!samePeriod(target, current) && !samePeriod(target, previous)) {
    throw badRequest('Laporan hanya bisa diisi untuk pekan ini atau pekan lalu');
  }

  return db.transaction(async (trx) => {
    const indicators = await listActiveIndicators(trx);
    const byIndicator = new Map(answers.map((a) => [a.indicatorId, a.optionId]));

    const errors = [];
    if (byIndicator.size !== answers.length) errors.push({ field: 'answers', message: 'Ada amalan yang dijawab lebih dari sekali' });
    const known = new Set(indicators.map((i) => i.id));
    for (const id of byIndicator.keys()) {
      if (!known.has(id)) errors.push({ field: 'answers', message: `Amalan ${id} tidak dikenal` });
    }

    const rows = [];
    for (const ind of indicators) {
      const optionId = byIndicator.get(ind.id);
      const option = ind.options.find((o) => o.id === optionId);
      if (optionId === undefined) errors.push({ field: `answers.${ind.code}`, message: `${ind.label} wajib diisi` });
      else if (!option) errors.push({ field: `answers.${ind.code}`, message: `Pilihan untuk ${ind.label} tidak valid` });
      else rows.push({ indicator_id: ind.id, option_id: option.id, score: option.score });
    }
    if (errors.length) throw badRequest('Data tidak valid', errors);

    const totalScore = Math.round((rows.reduce((s, r) => s + r.score, 0) / rows.length) * 100) / 100;

    const [report] = await trx('reports')
      .insert({
        user_id: userId,
        year: target.year,
        month: target.month,
        week: target.week,
        resume_text: resumeText,
        total_score: totalScore,
      })
      .onConflict(['user_id', 'year', 'month', 'week'])
      .merge({ resume_text: resumeText, total_score: totalScore, updated_at: trx.fn.now() })
      .returning('*');

    await trx('report_answers').where({ report_id: report.id }).del();
    const saved = await trx('report_answers')
      .insert(rows.map((r) => ({ ...r, report_id: report.id })))
      .returning('*');

    saved.sort((a, b) => a.indicator_id - b.indicator_id);
    return toReport(report, saved);
  });
}
