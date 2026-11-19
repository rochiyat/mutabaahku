import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/knex.js';
import {
  cookieOptions,
  hashPassword,
  sha256,
  signToken,
  toPublicUser,
  verifyPassword,
  verifyPasswordOrDummy,
} from '../lib/auth.js';
import { HttpError, badRequest } from '../lib/http-error.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middlewares/auth.js';
import { sendPasswordLink } from '../services/password-links.js';

const email = z.email('Format email tidak valid').trim().toLowerCase();
const newPassword = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(72, 'Password maksimal 72 karakter');

const loginSchema = z.object({ email, password: z.string().min(1, 'Password wajib diisi') });
const changeSchema = z
  .object({ currentPassword: z.string().min(1, 'Password lama wajib diisi'), newPassword })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'Password baru harus berbeda dari password lama',
  });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ token: z.string().min(1), newPassword });

const limiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    skip: () => config.isTest,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Terlalu banyak percobaan, coba lagi nanti' } },
  });

const findUserByEmail = (value) => db('users').whereRaw('lower(email) = ?', [value]).first();

function setSession(res, user) {
  res.cookie(config.jwt.cookieName, signToken(user), cookieOptions());
}

export const authRouter = Router();

authRouter.post('/login', limiter(10), async (req, res) => {
  const { email: mail, password } = parse(loginSchema, req.body);
  const user = await findUserByEmail(mail);
  const ok = await verifyPasswordOrDummy(password, user?.password_hash);
  if (!user || !ok || !user.is_active) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email atau password salah');
  }
  setSession(res, user);
  res.json({ user: toPublicUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(config.jwt.cookieName, opts);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

authRouter.post('/change-password', requireAuth, limiter(10), async (req, res) => {
  const { currentPassword, newPassword: next } = parse(changeSchema, req.body);
  if (!(await verifyPassword(currentPassword, req.user.password_hash))) {
    throw badRequest('Password lama salah', [{ field: 'currentPassword', message: 'Password lama salah' }]);
  }
  const [user] = await db('users')
    .where({ id: req.user.id })
    .update({
      password_hash: await hashPassword(next),
      must_change_password: false,
      password_changed_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');
  // Sesi lain otomatis tidak berlaku; sesi ini diberi token baru.
  setSession(res, user);
  res.json({ user: toPublicUser(user) });
});

authRouter.post('/forgot-password', limiter(5), async (req, res) => {
  const { email: mail } = parse(forgotSchema, req.body);
  const user = await findUserByEmail(mail);

  if (user?.is_active) await sendPasswordLink(user);

  // Jawaban sama untuk email terdaftar maupun tidak.
  res.json({ message: 'Jika email terdaftar, link reset password telah dikirim' });
});

authRouter.post('/reset-password', limiter(10), async (req, res) => {
  const { token, newPassword: next } = parse(resetSchema, req.body);
  const passwordHash = await hashPassword(next);

  const ok = await db.transaction(async (trx) => {
    const row = await trx('password_reset_tokens')
      .where({ token_hash: sha256(token) })
      .whereNull('used_at')
      .where('expires_at', '>', trx.fn.now())
      .forUpdate()
      .first();
    if (!row) return false;

    await trx('password_reset_tokens').where({ id: row.id }).update({ used_at: trx.fn.now() });
    await trx('users').where({ id: row.user_id }).update({
      password_hash: passwordHash,
      must_change_password: false,
      password_changed_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });
    return true;
  });

  if (!ok) throw new HttpError(400, 'INVALID_RESET_TOKEN', 'Link reset tidak valid atau sudah kedaluwarsa');
  res.json({ message: 'Password berhasil diganti, silakan login' });
});
