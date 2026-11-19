import { config } from '../config.js';
import { db } from '../db/knex.js';
import { createResetToken } from '../lib/auth.js';
import { emailEnabled, sendMail } from '../lib/mailer.js';

function validityText(ttlMinutes) {
  return ttlMinutes >= 120 ? `${Math.round(ttlMinutes / 60 / 24)} hari` : `${ttlMinutes} menit`;
}

/**
 * Creates a one-time link to /reset-password (only the newest link stays valid)
 * plus a ready-to-send message for it.
 * `invite` = account that has never chosen a password (welcome wording).
 */
export async function createPasswordLink(user, { invite = false, ttlMinutes = config.resetTokenTtlMinutes } = {}) {
  const { token, tokenHash } = createResetToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await db.transaction(async (trx) => {
    await trx('password_reset_tokens').where({ user_id: user.id }).whereNull('used_at').del();
    await trx('password_reset_tokens').insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });
  });

  const link = `${config.appUrl}/reset-password?token=${token}`;
  const validity = validityText(ttlMinutes);
  const message = invite
    ? `Assalamu'alaikum ${user.name},\n\n` +
      `Antum didaftarkan di Mutaba'ahku untuk mengisi mutaba'ah pekanan.\n` +
      `Buka link berikut untuk membuat password (berlaku ${validity}):\n${link}\n\n` +
      `Setelah itu masuk dengan email ${user.email}.`
    : `Assalamu'alaikum ${user.name},\n\n` +
      `Buka link berikut untuk membuat password baru Mutaba'ahku (berlaku ${validity}):\n${link}\n\n` +
      'Abaikan pesan ini jika tidak meminta reset password.';

  return {
    link,
    expiresAt,
    message,
    subject: invite ? "Undangan Mutaba'ahku" : "Reset password Mutaba'ahku",
  };
}

/** Self-service "lupa password": creates a short-lived link and emails it (if email is set up). */
export async function sendPasswordLink(user, { invite = false } = {}) {
  const ttlMinutes = invite ? config.inviteTokenTtlHours * 60 : config.resetTokenTtlMinutes;
  const created = await createPasswordLink(user, { invite, ttlMinutes });
  await sendMail({ to: user.email, subject: created.subject, text: created.message });
  return created;
}

/**
 * Link made by the murabbi to pass on personally (e.g. WhatsApp). Valid as long as an invite,
 * and also emailed when SMTP is configured.
 */
export async function shareablePasswordLink(user, { invite }) {
  const created = await createPasswordLink(user, { invite, ttlMinutes: config.inviteTokenTtlHours * 60 });
  if (emailEnabled()) await sendMail({ to: user.email, subject: created.subject, text: created.message });
  return { link: created.link, message: created.message, expiresAt: created.expiresAt, emailed: emailEnabled() };
}
