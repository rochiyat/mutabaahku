// Membuat akun murabbi pertama dan mengirim link untuk membuat password.
// Pemakaian: npm run create-murabbi -- "Nama Murabbi" email@contoh.com
import { randomBytes } from 'node:crypto';
import { config } from '../src/config.js';
import { db } from '../src/db/knex.js';
import { hashPassword } from '../src/lib/auth.js';
import { shareablePasswordLink } from '../src/services/password-links.js';

const [name, rawEmail] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

async function main() {
  if (!name?.trim() || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Pemakaian: npm run create-murabbi -- "Nama Murabbi" email@contoh.com');
    return 1;
  }

  const existing = await db('users').where({ role: 'murabbi' }).first();
  if (existing) {
    console.error(`Sudah ada murabbi: ${existing.name} <${existing.email}>. Ubah datanya dari halaman Pengguna.`);
    return 1;
  }
  if (await db('users').whereRaw('lower(email) = ?', [email]).first()) {
    console.error(`Email ${email} sudah dipakai pengguna lain.`);
    return 1;
  }

  const [user] = await db('users')
    .insert({
      name: name.trim(),
      email,
      role: 'murabbi',
      password_hash: await hashPassword(randomBytes(24).toString('base64url')),
      must_change_password: true,
    })
    .returning('*');

  const { link, emailed } = await shareablePasswordLink(user, { invite: true });
  console.log(`Murabbi ${user.name} <${user.email}> dibuat.`);
  if (emailed) console.log('Link untuk membuat password juga dikirim ke email tersebut.');
  console.log(`Buka link ini untuk membuat password (berlaku ${config.inviteTokenTtlHours / 24} hari):
${link}`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
