import { randomBytes } from 'node:crypto';
import { db } from '../db/knex.js';
import { hashPassword } from '../lib/auth.js';
import { badRequest, conflict, notFound } from '../lib/http-error.js';
import { shareablePasswordLink } from './password-links.js';

const UNIQUE_VIOLATION = '23505';

async function uniqueOr409(promise, message, field) {
  try {
    return await promise;
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) throw conflict(message, [{ field, message }]);
    throw err;
  }
}

// ---------- Pengguna ----------

const toAdminUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.is_active,
  mustChangePassword: u.must_change_password,
  reportCount: Number(u.report_count ?? 0),
  lastReportAt: u.last_report_at ?? null,
});

export async function listUsers() {
  const rows = await db('users as u')
    .leftJoin('reports as r', 'r.user_id', 'u.id')
    .groupBy('u.id')
    .select('u.*', db.raw('count(r.id)::int as report_count'), db.raw('max(r.updated_at) as last_report_at'))
    .orderByRaw(`u.role = 'admin' desc, u.role = 'murabbi' desc, u.is_active desc, lower(u.name)`);
  return rows.map(toAdminUser);
}

async function getUser(id) {
  const user = await db('users').where({ id }).first();
  if (!user) throw notFound('Pengguna tidak ditemukan');
  return user;
}

/**
 * New member gets an unguessable password and an invite link to set their own.
 * The link is returned so the murabbi can share it personally; it is also emailed when SMTP is set.
 */
export async function createMember({ name, email }) {
  const passwordHash = await hashPassword(randomBytes(24).toString('base64url'));
  const [user] = await uniqueOr409(
    db('users')
      .insert({ name, email, password_hash: passwordHash, role: 'anggota', must_change_password: true })
      .returning('*'),
    'Email sudah dipakai pengguna lain',
    'email',
  );
  const invite = await shareablePasswordLink(user, { invite: true });
  return { user: toAdminUser(user), invite };
}

export async function updateUser(id, changes, actor) {
  const user = await getUser(id);
  if (changes.isActive === false && user.id === actor.id) {
    throw badRequest('Anda tidak bisa menonaktifkan akun sendiri');
  }
  const patch = { updated_at: db.fn.now() };
  if (changes.name !== undefined) patch.name = changes.name;
  if (changes.email !== undefined) patch.email = changes.email;
  if (changes.isActive !== undefined) patch.is_active = changes.isActive;

  const [updated] = await uniqueOr409(
    db('users').where({ id }).update(patch).returning('*'),
    'Email sudah dipakai pengguna lain',
    'email',
  );
  return toAdminUser(updated);
}

export async function sendUserPasswordLink(id) {
  const user = await getUser(id);
  if (!user.is_active) throw badRequest('Aktifkan akun ini terlebih dahulu');
  // Belum pernah memilih password sendiri → kirim sebagai undangan.
  return shareablePasswordLink(user, { invite: user.must_change_password });
}

// ---------- Amalan ----------

export async function listAllIndicators() {
  const indicators = await db('indicators').orderBy('sort_order');
  const options = await db('indicator_options').orderBy(['indicator_id', 'sort_order']);
  return indicators.map((i) => ({
    id: i.id,
    code: i.code,
    label: i.label,
    type: i.type,
    isActive: i.is_active,
    sortOrder: i.sort_order,
    options: options
      .filter((o) => o.indicator_id === i.id)
      .map((o) => ({ id: o.id, label: o.label, score: o.score })),
  }));
}

function slugify(label) {
  return (
    label
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .slice(0, 30) || 'amalan'
  );
}

export async function createIndicator({ label, type, options }) {
  return db.transaction(async (trx) => {
    const base = slugify(label);
    const taken = new Set((await trx('indicators').where('code', 'like', `${base}%`).pluck('code')));
    let code = base;
    for (let n = 2; taken.has(code); n++) code = `${base}_${n}`;

    const { max } = await trx('indicators').max('sort_order as max').first();
    const [indicator] = await trx('indicators')
      .insert({ code, label, type, sort_order: (max ?? 0) + 1 })
      .returning('*');
    await trx('indicator_options').insert(
      options.map((o, i) => ({ indicator_id: indicator.id, label: o.label, score: o.score, sort_order: i + 1 })),
    );
    return indicator.id;
  });
}

export async function updateIndicator(id, { label, isActive }) {
  const indicator = await db('indicators').where({ id }).first();
  if (!indicator) throw notFound('Amalan tidak ditemukan');

  if (isActive === false && indicator.is_active) {
    const { n } = await db('indicators').where({ is_active: true }).count({ n: '*' }).first();
    if (Number(n) <= 1) throw badRequest('Minimal harus ada satu amalan aktif');
  }
  const patch = {};
  if (label !== undefined) patch.label = label;
  if (isActive !== undefined) patch.is_active = isActive;
  if (Object.keys(patch).length) await db('indicators').where({ id }).update(patch);
}

export async function updateOption(id, { label, score }) {
  const option = await db('indicator_options').where({ id }).first();
  if (!option) throw notFound('Pilihan tidak ditemukan');
  const patch = {};
  if (label !== undefined) patch.label = label;
  if (score !== undefined) patch.score = score;
  if (Object.keys(patch).length) {
    await uniqueOr409(
      db('indicator_options').where({ id }).update(patch),
      'Label pilihan sudah ada di amalan ini',
      'label',
    );
  }
}
