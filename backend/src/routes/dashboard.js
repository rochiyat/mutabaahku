import { Router } from 'express';
import { z } from 'zod';
import { toCsv } from '../lib/csv.js';
import { notFound } from '../lib/http-error.js';
import { parse } from '../lib/validate.js';
import { exportRows, findMember, getDashboard, getFilterOptions, getTrend } from '../services/dashboard.js';
import { getReport, listHistory } from '../services/reports.js';

// "" from an empty <select> means "semua".
const optionalInt = (min, max) =>
  z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(min).max(max).optional());

const filterSchema = z.object({
  year: optionalInt(2000, 2100),
  month: optionalInt(1, 12),
  week: optionalInt(1, 5),
  userId: optionalInt(1, Number.MAX_SAFE_INTEGER),
});

const trendSchema = z.object({
  userId: optionalInt(1, Number.MAX_SAFE_INTEGER),
  limit: z.coerce.number().int().min(1).max(52).default(12),
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const periodSchema = idSchema.extend({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  week: z.coerce.number().int().min(1).max(5),
});

async function memberOr404(id) {
  const member = await findMember(id);
  if (!member) throw notFound('Anggota tidak ditemukan');
  return member;
}

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  res.json(await getDashboard(parse(filterSchema, req.query)));
});

dashboardRouter.get('/filters', async (_req, res) => {
  res.json(await getFilterOptions());
});

dashboardRouter.get('/trend', async (req, res) => {
  const { userId, limit } = parse(trendSchema, req.query);
  res.json({ trend: await getTrend({ userId, limit }) });
});

dashboardRouter.get('/export.csv', async (req, res) => {
  const filter = parse(filterSchema, req.query);
  const { header, rows } = await exportRows(filter);
  const suffix = [filter.year, filter.month, filter.week].filter(Boolean).join('-') || 'semua';
  res
    .type('text/csv; charset=utf-8')
    .attachment(`mutabaah-${suffix}.csv`)
    .send(toCsv(header, rows));
});

dashboardRouter.get('/members/:id', async (req, res) => {
  const { id } = parse(idSchema, req.params);
  const member = await memberOr404(id);
  res.json({ member, reports: await listHistory(id, 100) });
});

dashboardRouter.get('/members/:id/reports/:year/:month/:week', async (req, res) => {
  const { id, ...period } = parse(periodSchema, req.params);
  await memberOr404(id);
  const report = await getReport(id, period);
  if (!report) throw notFound('Laporan tidak ditemukan');
  res.json({ report });
});
