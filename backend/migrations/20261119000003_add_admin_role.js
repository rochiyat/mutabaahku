/** @param {import('knex').Knex} knex */
export async function up(knex) {
  // 1. Tambah 'admin' ke constraint role
  await knex.raw(`ALTER TABLE users DROP CONSTRAINT users_role_check`);
  await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'murabbi', 'anggota'))`);

  // 2. Hapus constraint single-murabbi (karena sekarang admin terpisah)
  await knex.raw(`DROP INDEX IF EXISTS users_single_murabbi`);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw(`ALTER TABLE users DROP CONSTRAINT users_role_check`);
  await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('murabbi', 'anggota'))`);
  await knex.raw(`CREATE UNIQUE INDEX users_single_murabbi ON users (role) WHERE role = 'murabbi'`);
}
