import { config } from '../config.js';
import { db } from '../db/knex.js';
import { createResetToken } from '../lib/auth.js';
import { sendMail } from '../lib/mailer.js';

/**
 * Emails a one-time link to /reset-password. Only the newest link stays valid.
 * `invite` is used for new accounts (longer validity, welcome wording).
 */
export async function sendPasswordLink(user, { invite = false } = {}) {
  const ttlMinutes = invite ? config.inviteTokenTtlHours * 60 : config.resetTokenTtlMinutes;
  const { token, tokenHash } = createResetToken();

  await db.transaction(async (trx) => {
    await trx('password_reset_tokens').where({ user_id: user.id }).whereNull('used_at').del();
    await trx('password_reset_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + ttlMinutes * 60 * 1000),
    });
  });

  const link = `${config.appUrl}/reset-password?token=${token}`;
  const validity = ttlMinutes >= 120 ? `${Math.round(ttlMinutes / 60 / 24)} hari` : `${ttlMinutes} menit`;

  await sendMail(
    invite
      ? {
          to: user.email,
          subject: "Undangan Mutaba'ahku",
          text:
            `Assalamu'alaikum ${user.name},\n\n` +
            `Anda didaftarkan di Mutaba'ahku untuk mengisi mutaba'ah pekanan.\n` +
            `Buka link berikut untuk membuat password (berlaku ${validity}):\n${link}\n\n` +
            `Setelah itu masuk dengan email ${user.email}.`,
        }
      : {
          to: user.email,
          subject: "Reset password Mutaba'ahku",
          text:
            `Assalamu'alaikum ${user.name},\n\n` +
            `Buka link berikut untuk membuat password baru (berlaku ${validity}):\n${link}\n\n` +
            'Abaikan email ini jika Anda tidak meminta reset password.',
        },
  );
}
