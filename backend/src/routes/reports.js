import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import { requireRole } from '../middlewares/auth.js';
import { getReport, listHistory, submittablePeriods, upsertReport } from '../services/reports.js';

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  week: z.coerce.number().int().min(1).max(5),
});

const upsertSchema = z.object({
  period: periodSchema.optional(),
  answers: z
    .array(z.object({ indicatorId: z.number().int().positive(), optionId: z.number().int().positive() }))
    .min(1, 'Jawaban wajib diisi'),
  resumeText: z.string().trim().min(1, 'Resume materi wajib diisi').max(5000, 'Resume maksimal 5000 karakter'),
});

const historySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

export const reportsRouter = Router();

reportsRouter.get('/periods', (_req, res) => {
  res.json(submittablePeriods());
});

reportsRouter.get('/me', async (req, res) => {
  const period = Object.keys(req.query).length ? parse(periodSchema, req.query) : submittablePeriods().current;
  res.json({ report: await getReport(req.user.id, period) });
});

reportsRouter.get('/me/history', async (req, res) => {
  const { limit } = parse(historySchema, req.query);
  res.json({ reports: await listHistory(req.user.id, limit) });
});

reportsRouter.put('/', requireRole('anggota'), async (req, res) => {
  const input = parse(upsertSchema, req.body);
  res.json({ report: await upsertReport(req.user.id, input) });
});
