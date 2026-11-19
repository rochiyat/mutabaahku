import nodemailer from 'nodemailer';
import { config } from '../config.js';

/** Emails captured in test mode, newest last. */
export const outbox = [];

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

/** Whether the app can send email. Without SMTP the murabbi shares links personally. */
export const emailEnabled = () => Boolean(config.smtp.host);

export async function sendMail({ to, subject, text, html }) {
  const mail = { from: config.smtp.from, to, subject, text, html };
  if (config.isTest) {
    outbox.push(mail);
    return;
  }
  if (!emailEnabled()) {
    // Di produksi isi email (berisi link rahasia) tidak boleh masuk log.
    if (config.isProduction) console.log(`[mail] SMTP tidak diatur; email "${subject}" tidak dikirim`);
    else console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  await getTransporter().sendMail(mail);
}
