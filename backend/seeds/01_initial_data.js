import bcrypt from 'bcryptjs';
import { indicators } from './data/indicators.js';

const GROUP_NAME = 'UPA Cilbar';

// Akun contoh untuk development saja (email .test). Di produksi, murabbi pertama dibuat
// dengan `npm run create-murabbi` lalu menambah anggota dari halaman Pengguna.
const devUsers = [
  { name: 'Admin', email: 'admin@mutabaahku.test', role: 'admin' },
  { name: 'Murabbi', email: 'murabbi@mutabaahku.test', role: 'murabbi' },
  ...['Rochiyat', 'Bhayu', 'Herman', 'Sabar', 'Salman', 'Arief', 'Anto', 'Ganjar'].map((name) => ({
    name,
    email: `${name.toLowerCase()}@mutabaahku.test`,
    role: 'anggota',
  })),
];

const isEmpty = async (trx, table) => Number((await trx(table).count({ n: '*' }).first()).n) === 0;

/**
 * Hanya mengisi tabel yang masih kosong, jadi aman dijalankan setiap deploy:
 * tidak menimpa akun, password, maupun amalan/skor yang sudah diubah murabbi.
 */
/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  const production = process.env.NODE_ENV === 'production';

  await knex.transaction(async (trx) => {
    await trx('settings').insert({ key: 'group_name', value: GROUP_NAME }).onConflict('key').ignore();

    if (await isEmpty(trx, 'indicators')) {
      for (const [i, ind] of indicators.entries()) {
        const [{ id }] = await trx('indicators')
          .insert({ code: ind.code, label: ind.label, type: ind.type, sort_order: i + 1 })
          .returning('id');
        await trx('indicator_options').insert(
          ind.options.map((opt, j) => ({ indicator_id: id, label: opt.label, score: opt.score, sort_order: j + 1 })),
        );
      }
    }

    if (!production && (await isEmpty(trx, 'users'))) {
      const password = process.env.SEED_DEFAULT_PASSWORD;
      if (!password) throw new Error('SEED_DEFAULT_PASSWORD is required to seed development accounts');
      const passwordHash = await bcrypt.hash(password, 10);
      await trx('users').insert(
        devUsers.map((u) => ({ ...u, password_hash: passwordHash, must_change_password: true })),
      );
    }
  });
}
