/** Token JWT yang terbit sebelum waktu ini ditolak — ganti/reset password mengeluarkan sesi lain. */
/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.timestamp('password_changed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('password_changed_at');
  });
}
