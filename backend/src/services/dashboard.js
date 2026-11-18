import { config } from '../config.js';
import { db } from '../db/knex.js';
import { periodOf, weekLabel } from '../lib/period.js';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const num = (v) => (v === null || v === undefined ? null : Number(v));

const activeMembers = () => db('users').where({ role: 'anggota', is_active: true });

/** Reports of active members matching the optional year/month/week/userId filter. */
function filteredReports({ year, month, week, userId }) {
  const q = db('reports as r')
    .join('users as u', 'u.id', 'r.user_id')
    .where({ 'u.role': 'anggota', 'u.is_active': true });
  if (year) q.where('r.year', year);
  if (month) q.where('r.month', month);
  if (week) q.where('r.week', week);
  if (userId) q.where('r.user_id', userId);
  return q;
}

/**
 * Group overview for the murabbi, mirroring the old Apps Script dashboard:
 * totals, who has / hasn't reported, average per indicator, and member ranking.
 * Every filter is optional; an omitted one means "semua".
 */
export async function getDashboard(filter) {
  const members = await activeMembers()
    .modify((q) => filter.userId && q.where('id', filter.userId))
    .orderBy('name')
    .select('id', 'name');

  const totals = await filteredReports(filter)
    .select(
      db.raw('count(*)::int as total'),
      db.raw('count(distinct r.user_id)::int as submitted'),
      db.raw('round(avg(r.total_score), 2) as average'),
    )
    .first();

  const ranking = await filteredReports(filter)
    .groupBy('u.id', 'u.name')
    .select('u.id', 'u.name', db.raw('count(*)::int as reports'), db.raw('round(avg(r.total_score), 2) as average'))
    .orderBy([
      { column: 'average', order: 'desc' },
      { column: 'u.name', order: 'asc' },
    ]);

  const answers = db('report_answers')
    .whereIn('report_id', filteredReports(filter).select('r.id'))
    .as('a');
  const perIndicator = await db('indicators as i')
    .where('i.is_active', true)
    .leftJoin(answers, 'a.indicator_id', 'i.id')
    .groupBy('i.id', 'i.code', 'i.label', 'i.sort_order')
    .orderBy('i.sort_order')
    .select('i.id', 'i.code', 'i.label', db.raw('round(avg(a.score), 2) as average'));

  const reported = new Set(ranking.map((r) => r.id));

  return {
    summary: {
      totalReports: totals.total,
      submitted: totals.submitted,
      members: members.length,
      notSubmitted: members.length - totals.submitted,
      average: num(totals.average),
    },
    perIndicator: perIndicator.map((i) => ({ ...i, average: num(i.average) })),
    ranking: ranking.map((r, index) => ({
      rank: index + 1,
      userId: r.id,
      name: r.name,
      reports: r.reports,
      average: num(r.average),
    })),
    notSubmitted: members.filter((m) => !reported.has(m.id)).map((m) => ({ userId: m.id, name: m.name })),
  };
}

/** Values for the dashboard filter dropdowns. */
export async function getFilterOptions() {
  const current = periodOf(new Date(), config.timeZone);
  const rows = await db('reports').distinct('year').orderBy('year', 'desc');
  const years = [...new Set([current.year, ...rows.map((r) => r.year)])].sort((a, b) => b - a);
  const members = await activeMembers().orderBy('name').select('id', 'name');
  return { current, years, members };
}

/** Group average and participation per week, oldest first, for the last `limit` weeks that have reports. */
export async function getTrend({ userId, limit }) {
  const rows = await filteredReports({ userId })
    .groupBy('r.year', 'r.month', 'r.week')
    .select(
      'r.year',
      'r.month',
      'r.week',
      db.raw('count(*)::int as submitted'),
      db.raw('round(avg(r.total_score), 2) as average'),
    )
    .orderBy([
      { column: 'r.year', order: 'desc' },
      { column: 'r.month', order: 'desc' },
      { column: 'r.week', order: 'desc' },
    ])
    .limit(limit);
  return rows.reverse().map((r) => ({ ...r, weekLabel: weekLabel(r.week), average: num(r.average) }));
}

/** One row per report with every answer spelled out, for spreadsheet export. */
export async function exportRows(filter) {
  const indicators = await db('indicators').orderBy('sort_order').select('id', 'label');
  const reports = await filteredReports(filter)
    .select('r.*', 'u.name', 'u.email')
    .orderBy([
      { column: 'r.year', order: 'desc' },
      { column: 'r.month', order: 'desc' },
      { column: 'r.week', order: 'desc' },
      { column: 'u.name', order: 'asc' },
    ]);

  const answers = reports.length
    ? await db('report_answers as a')
        .join('indicator_options as o', 'o.id', 'a.option_id')
        .whereIn(
          'a.report_id',
          reports.map((r) => r.id),
        )
        .select('a.report_id', 'a.indicator_id', 'o.label')
    : [];
  const answerOf = new Map(answers.map((a) => [`${a.report_id}:${a.indicator_id}`, a.label]));

  const header = [
    'Tahun',
    'Bulan',
    'Pekan',
    'Nama',
    'Email',
    ...indicators.map((i) => i.label),
    'Skor',
    'Resume Materi',
    'Dikirim',
    'Diperbarui',
  ];
  const rows = reports.map((r) => [
    r.year,
    MONTHS[r.month - 1],
    weekLabel(r.week),
    r.name,
    r.email,
    ...indicators.map((i) => answerOf.get(`${r.id}:${i.id}`) ?? ''),
    Number(r.total_score),
    r.resume_text,
    new Date(r.created_at).toISOString(),
    new Date(r.updated_at).toISOString(),
  ]);
  return { header, rows };
}

export async function findMember(id) {
  return activeMembers().where({ id }).first('id', 'name', 'email');
}
