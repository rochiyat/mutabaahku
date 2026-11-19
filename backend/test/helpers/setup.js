// Must be imported before anything that reads config.
process.env.NODE_ENV = 'test';

const { db } = await import('../../src/db/knex.js');
const { createApp } = await import('../../src/app.js');
const { outbox } = await import('../../src/lib/mailer.js');

export { db, outbox };
export const app = createApp();

export const PASSWORD = process.env.SEED_DEFAULT_PASSWORD;

/** Fresh schema + seed data. Called once per test file. */
export async function resetDatabase() {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.seed.run();
  outbox.length = 0;
}

/** Marks a seeded account as having chosen its own password, so it can use the protected API. */
export async function activate(email) {
  await db('users').where({ email }).update({ must_change_password: false });
}
