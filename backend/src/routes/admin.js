import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import { requireRole } from '../middlewares/auth.js';
import {
  createIndicator,
  createMember,
  listAllIndicators,
  listUsers,
  sendUserPasswordLink,
  updateIndicator,
  updateOption,
  updateUser,
} from '../services/admin.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const name = z.string().trim().min(1, 'Nama wajib diisi').max(120);
const email = z.email('Format email tidak valid').trim().toLowerCase().max(254);
const label = z.string().trim().min(1, 'Label wajib diisi').max(120);
const score = z.number().int('Skor harus bilangan bulat').min(0, 'Skor minimal 0').max(100, 'Skor maksimal 100');

const atLeastOne = (schema) =>
  schema.refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Tidak ada perubahan' });

const createMemberSchema = z.object({ name, email });
const updateUserSchema = atLeastOne(
  z.object({ name: name.optional(), email: email.optional(), isActive: z.boolean().optional() }),
);

const optionSchema = z.object({ label, score });
const createIndicatorSchema = z
  .object({
    label,
    type: z.enum(['choice', 'boolean']),
    options: z.array(optionSchema).min(2, 'Minimal 2 pilihan').max(12, 'Maksimal 12 pilihan'),
  })
  .refine((v) => new Set(v.options.map((o) => o.label.toLowerCase())).size === v.options.length, {
    path: ['options'],
    message: 'Label pilihan tidak boleh sama',
  });
const updateIndicatorSchema = atLeastOne(z.object({ label: label.optional(), isActive: z.boolean().optional() }));
const updateOptionSchema = atLeastOne(z.object({ label: label.optional(), score: score.optional() }));

export const adminRouter = Router();

// --- User routes (admin only) ---

adminRouter.get('/users', requireRole('admin'), async (_req, res) => {
  res.json({ users: await listUsers() });
});

adminRouter.post('/users', requireRole('admin'), async (req, res) => {
  res.status(201).json(await createMember(parse(createMemberSchema, req.body)));
});

adminRouter.patch('/users/:id', requireRole('admin'), async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json({ user: await updateUser(id, parse(updateUserSchema, req.body), req.user) });
});

adminRouter.post('/users/:id/password-link', requireRole('admin'), async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await sendUserPasswordLink(id));
});

// --- Indicator routes (admin + murabbi) ---

adminRouter.get('/indicators', async (_req, res) => {
  res.json({ indicators: await listAllIndicators() });
});

adminRouter.post('/indicators', async (req, res) => {
  await createIndicator(parse(createIndicatorSchema, req.body));
  res.status(201).json({ indicators: await listAllIndicators() });
});

adminRouter.patch('/indicators/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  await updateIndicator(id, parse(updateIndicatorSchema, req.body));
  res.json({ indicators: await listAllIndicators() });
});

adminRouter.patch('/options/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  await updateOption(id, parse(updateOptionSchema, req.body));
  res.json({ indicators: await listAllIndicators() });
});
