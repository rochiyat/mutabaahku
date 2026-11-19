/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('settings', (t) => {
    t.string('key', 64).primary();
    t.text('value').notNullable();
  });

  await knex.schema.createTable('users', (t) => {
    t.increments('id');
    t.string('name', 120).notNullable();
    t.string('email', 254).notNullable();
    t.string('password_hash', 100).notNullable();
    t.string('role', 16).notNullable().defaultTo('anggota');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.boolean('must_change_password').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });
  await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('murabbi', 'anggota'))`);
  await knex.raw('CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email))');
  // Satu UPA, satu murabbi.
  await knex.raw(`CREATE UNIQUE INDEX users_single_murabbi ON users (role) WHERE role = 'murabbi'`);

  await knex.schema.createTable('password_reset_tokens', (t) => {
    t.increments('id');
    t.integer('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('token_hash', 64).notNullable().unique();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('used_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
  });

  await knex.schema.createTable('indicators', (t) => {
    t.increments('id');
    t.string('code', 40).notNullable().unique();
    t.string('label', 120).notNullable();
    t.string('type', 16).notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
  });
  await knex.raw(`ALTER TABLE indicators ADD CONSTRAINT indicators_type_check CHECK (type IN ('choice', 'boolean'))`);

  await knex.schema.createTable('indicator_options', (t) => {
    t.increments('id');
    t.integer('indicator_id').notNullable().references('indicators.id').onDelete('CASCADE');
    t.string('label', 120).notNullable();
    t.integer('score').notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.unique(['indicator_id', 'label']);
  });
  await knex.raw('ALTER TABLE indicator_options ADD CONSTRAINT indicator_options_score_check CHECK (score BETWEEN 0 AND 100)');

  await knex.schema.createTable('reports', (t) => {
    t.increments('id');
    t.integer('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.smallint('year').notNullable();
    t.smallint('month').notNullable();
    t.smallint('week').notNullable();
    t.text('resume_text').notNullable();
    t.decimal('total_score', 5, 2).notNullable();
    t.timestamps(true, true);
    t.unique(['user_id', 'year', 'month', 'week']);
    t.index(['year', 'month', 'week']);
  });
  await knex.raw(`
    ALTER TABLE reports
      ADD CONSTRAINT reports_month_check CHECK (month BETWEEN 1 AND 12),
      ADD CONSTRAINT reports_week_check CHECK (week BETWEEN 1 AND 5),
      ADD CONSTRAINT reports_total_score_check CHECK (total_score BETWEEN 0 AND 100)
  `);

  await knex.schema.createTable('report_answers', (t) => {
    t.integer('report_id').notNullable().references('reports.id').onDelete('CASCADE');
    t.integer('indicator_id').notNullable().references('indicators.id');
    t.integer('option_id').notNullable().references('indicator_options.id');
    // Snapshot skor saat dikirim, supaya laporan lama tidak berubah jika bobot diubah.
    t.integer('score').notNullable();
    t.primary(['report_id', 'indicator_id']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema
    .dropTableIfExists('report_answers')
    .dropTableIfExists('reports')
    .dropTableIfExists('indicator_options')
    .dropTableIfExists('indicators')
    .dropTableIfExists('password_reset_tokens')
    .dropTableIfExists('users')
    .dropTableIfExists('settings');
}
