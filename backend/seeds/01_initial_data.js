import bcrypt from 'bcryptjs';
import { indicators } from './data/indicators.js';

const GROUP_NAME = 'UPA Cilbar';

// Email placeholder (.test) — ganti dengan email asli lewat halaman admin sebelum dipakai.
const users = [
  { name: 'Murabbi', email: 'murabbi@mutabaahku.test', role: 'murabbi' },
  ...['Rochiyat', 'Bhayu', 'Herman', 'Sabar', 'Salman', 'Arief', 'Anto', 'Ganjar'].map((name) => ({
    name,
    email: `${name.toLowerCase()}@mutabaahku.test`,
    role: 'anggota',
  })),
];

/** Idempotent: aman dijalankan berulang, tidak menimpa password yang sudah diganti. */
/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (!password) throw new Error('SEED_DEFAULT_PASSWORD is required to seed user accounts');
  const passwordHash = await bcrypt.hash(password, 10);

  await knex.transaction(async (trx) => {
    await trx('settings')
      .insert({ key: 'group_name', value: GROUP_NAME })
      .onConflict('key')
      .merge();

    for (const u of users) {
      await trx.raw(
        `INSERT INTO users (name, email, password_hash, role, must_change_password)
         VALUES (?, ?, ?, ?, true)
         ON CONFLICT (lower(email)) DO NOTHING`,
        [u.name, u.email, passwordHash, u.role],
      );
    }

    for (const [i, ind] of indicators.entries()) {
      const [{ id }] = await trx('indicators')
        .insert({ code: ind.code, label: ind.label, type: ind.type, sort_order: i + 1 })
        .onConflict('code')
        .merge(['label', 'type', 'sort_order'])
        .returning('id');

      for (const [j, opt] of ind.options.entries()) {
        await trx('indicator_options')
          .insert({ indicator_id: id, label: opt.label, score: opt.score, sort_order: j + 1 })
          .onConflict(['indicator_id', 'label'])
          .merge(['score', 'sort_order']);
      }
    }
  });
}
