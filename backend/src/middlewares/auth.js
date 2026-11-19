import { config } from '../config.js';
import { db } from '../db/knex.js';
import { verifyToken } from '../lib/auth.js';
import { forbidden, unauthorized } from '../lib/http-error.js';

/** Loads req.user from the session cookie. Rejects tokens issued before the last password change. */
export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[config.jwt.cookieName];
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized('Sesi berakhir, silakan login kembali');
  }

  const user = await db('users').where({ id: Number(payload.sub), is_active: true }).first();
  if (!user) throw unauthorized();

  // JWT iat has second precision; truncate the DB timestamp the same way.
  const changedAtSec = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
  if (payload.iat < changedAtSec) throw unauthorized('Password telah diganti, silakan login kembali');

  req.user = user;
  next();
}

/** Blocks everything except the auth routes until a seeded/reset account sets its own password. */
export function requirePasswordChanged(req, _res, next) {
  if (req.user.must_change_password) {
    throw forbidden('Silakan ganti password terlebih dahulu', 'PASSWORD_CHANGE_REQUIRED');
  }
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw forbidden();
  next();
};
