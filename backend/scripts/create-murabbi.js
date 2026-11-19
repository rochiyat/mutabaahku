// Membuat akun admin atau murabbi dan mengirim link untuk membuat password.
// Pemakaian: npm run create-murabbi -- "Nama" email@contoh.com [admin|murabbi]
import { randomBytes } from 'node:crypto';
import { config } from '../src/config.js';
import { db } from '../src/db/knex.js';
import { hashPassword } from '../src/lib/auth.js';
import { shareablePasswordLink } from '../src/services/password-links.js';

const [name, rawEmail, rawRole] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();
const role = rawRole?.trim().toLowerCase() || 'murabbi';

async function main() {
  if (!name?.trim() || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Pemakaian: npm run create-murabbi -- "Nama" email@contoh.com [admin|murabbi]');
    return 1;
  }
  if (!['admin', 'murabbi'].includes(role)) {
    console.error(`Role harus "admin" atau "murabbi", diberikan: "${role}"`);
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
      role,
      password_hash: await hashPassword(randomBytes(24).toString('base64url')),
      must_change_password: true,
    })
    .returning('*');

  const { link, emailed } = await shareablePasswordLink(user, { invite: true });
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  console.log(`${roleLabel} ${user.name} <${user.email}> dibuat.`);
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
