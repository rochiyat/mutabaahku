import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The knex CLI does not read .env on its own, so load it here for every entry point.
// Variables already set in the environment win over .env.
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is required`);
  return value;
}

const env = process.env.NODE_ENV ?? 'development';
const isTest = env === 'test';

export const config = {
  env,
  isTest,
  isProduction: env === 'production',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: isTest ? required('TEST_DATABASE_URL') : required('DATABASE_URL'),
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  timeZone: process.env.APP_TIMEZONE ?? 'Asia/Jakarta',
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    cookieName: 'mutabaah_token',
  },
  resetTokenTtlMinutes: Number(process.env.RESET_TOKEN_TTL_MINUTES ?? 60),
  inviteTokenTtlHours: Number(process.env.INVITE_TOKEN_TTL_HOURS ?? 168),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM ?? "Mutaba'ahku <no-reply@mutabaahku.local>",
  },
  seedDefaultPassword: process.env.SEED_DEFAULT_PASSWORD,
};
