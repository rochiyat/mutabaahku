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

export async function sendMail({ to, subject, text, html }) {
  const mail = { from: config.smtp.from, to, subject, text, html };
  if (config.isTest) {
    outbox.push(mail);
    return;
  }
  if (!config.smtp.host) {
    console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  await getTransporter().sendMail(mail);
}
