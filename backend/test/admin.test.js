import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { activate, app, db, outbox, PASSWORD, resetDatabase } from './helpers/setup.js';
import { submittablePeriods } from '../src/services/reports.js';

let murabbi;
const ids = {};

async function loginAs(email, password = PASSWORD) {
  await activate(email);
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, `login ${email}`);
  return agent;
}

const tokenFromMail = () => new URL(outbox.at(-1).text.match(/https?:\S+/)[0]).searchParams.get('token');

before(async () => {
  await resetDatabase();
  for (const u of await db('users').select('id', 'name')) ids[u.name] = u.id;
  murabbi = await loginAs('murabbi@mutabaahku.test');
});
after(() => db.destroy());

describe('users', () => {
  test('lists murabbi first, then members', async () => {
    const res = await murabbi.get('/api/admin/users');
    assert.equal(res.status, 200);
    assert.equal(res.body.users.length, 9);
    assert.equal(res.body.users[0].role, 'murabbi');
    assert.equal(res.body.users[1].name, 'Anto');
    assert.equal(res.body.users[1].reportCount, 0);
  });

  test('add member sends an invite that lets them set a password and log in', async () => {
    outbox.length = 0;
    const res = await murabbi.post('/api/admin/users').send({ name: 'Fulan', email: 'Fulan@Example.TEST' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, 'fulan@example.test');
    assert.equal(res.body.user.role, 'anggota');

    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].subject, "Undangan Mutaba'ahku");
    const reset = await request(app).post('/api/auth/reset-password').send({ token: tokenFromMail(), newPassword: 'fulanPass123' });
    assert.equal(reset.status, 200);

    const login = await request(app).post('/api/auth/login').send({ email: 'fulan@example.test', password: 'fulanPass123' });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.mustChangePassword, false);
  });

  test('duplicate email is a 409 on the email field', async () => {
    const res = await murabbi.post('/api/admin/users').send({ name: 'Lain', email: 'ROCHIYAT@mutabaahku.test' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details[0].field, 'email');

    const edit = await murabbi.patch(`/api/admin/users/${ids.Anto}`).send({ email: 'bhayu@mutabaahku.test' });
    assert.equal(edit.status, 409);
  });

  test('edit name and email', async () => {
    const res = await murabbi.patch(`/api/admin/users/${ids.Anto}`).send({ name: 'Anto S.', email: 'anto.asli@example.test' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, 'Anto S.');
    assert.equal(res.body.user.email, 'anto.asli@example.test');
  });

  test('empty patch is rejected', async () => {
    assert.equal((await murabbi.patch(`/api/admin/users/${ids.Anto}`).send({})).status, 400);
  });

  test('deactivated members are signed out and cannot log in', async () => {
    const member = await loginAs('sabar@mutabaahku.test');
    const res = await murabbi.patch(`/api/admin/users/${ids.Sabar}`).send({ isActive: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.isActive, false);

    assert.equal((await member.get('/api/auth/me')).status, 401);
    const login = await request(app).post('/api/auth/login').send({ email: 'sabar@mutabaahku.test', password: PASSWORD });
    assert.equal(login.status, 401);

    const link = await murabbi.post(`/api/admin/users/${ids.Sabar}/password-link`);
    assert.equal(link.status, 400);

    await murabbi.patch(`/api/admin/users/${ids.Sabar}`).send({ isActive: true });
  });

  test('murabbi cannot deactivate themself', async () => {
    const res = await murabbi.patch(`/api/admin/users/${ids.Murabbi}`).send({ isActive: false });
    assert.equal(res.status, 400);
  });

  test('send password link: invite for never-activated accounts, reset otherwise', async () => {
    outbox.length = 0;
    await murabbi.post(`/api/admin/users/${ids.Ganjar}/password-link`).expect(200);
    assert.equal(outbox.at(-1).subject, "Undangan Mutaba'ahku");

    await activate('ganjar@mutabaahku.test');
    await murabbi.post(`/api/admin/users/${ids.Ganjar}/password-link`).expect(200);
    assert.equal(outbox.at(-1).subject, "Reset password Mutaba'ahku");
  });

  test('members cannot use admin endpoints', async () => {
    const member = await loginAs('herman@mutabaahku.test');
    assert.equal((await member.get('/api/admin/users')).status, 403);
    assert.equal((await member.post('/api/admin/users').send({ name: 'x', email: 'x@x.test' })).status, 403);
  });
});

describe('indicators', () => {
  const get = async () => (await murabbi.get('/api/admin/indicators')).body.indicators;

  test('changing a score affects new reports only', async () => {
    const member = await loginAs('arief@mutabaahku.test');
    const indicators = await get();
    const answers = indicators.map((i) => ({ indicatorId: i.id, optionId: i.options[0].id }));
    const first = await member.put('/api/reports').send({ answers, resumeText: 'x' });
    assert.equal(first.body.report.totalScore, 100);

    const tilawahBest = indicators[0].options[0];
    const res = await murabbi.patch(`/api/admin/options/${tilawahBest.id}`).send({ score: 40 });
    assert.equal(res.status, 200);
    assert.equal(res.body.indicators[0].options[0].score, 40);

    // Laporan lama tetap 100 karena skor disnapshot.
    const old = await member.get('/api/reports/me');
    assert.equal(old.body.report.totalScore, 100);

    const resubmit = await member.put('/api/reports').send({ answers, resumeText: 'x' });
    assert.equal(resubmit.body.report.totalScore, 95);
  });

  test('score and label validation', async () => {
    const [ind] = await get();
    const opt = ind.options[1];
    assert.equal((await murabbi.patch(`/api/admin/options/${opt.id}`).send({ score: 101 })).status, 400);
    assert.equal((await murabbi.patch(`/api/admin/options/${opt.id}`).send({ score: 5.5 })).status, 400);
    const dup = await murabbi.patch(`/api/admin/options/${opt.id}`).send({ label: ind.options[0].label });
    assert.equal(dup.status, 409);
  });

  test('add a new indicator; members must answer it', async () => {
    const res = await murabbi.post('/api/admin/indicators').send({
      label: 'Membaca Buku Pekan Ini',
      type: 'boolean',
      options: [
        { label: 'Ya', score: 100 },
        { label: 'Tidak', score: 0 },
      ],
    });
    assert.equal(res.status, 201);
    const added = res.body.indicators.at(-1);
    assert.equal(added.code, 'membaca_buku_pekan_ini');
    assert.equal(added.isActive, true);

    const member = await loginAs('salman@mutabaahku.test');
    const memberView = (await member.get('/api/indicators')).body.indicators;
    assert.equal(memberView.length, 13);
    const twelve = memberView.slice(0, 12).map((i) => ({ indicatorId: i.id, optionId: i.options[0].id }));
    assert.equal((await member.put('/api/reports').send({ answers: twelve, resumeText: 'x' })).status, 400);
  });

  test('duplicate option labels in a new indicator are rejected', async () => {
    const res = await murabbi.post('/api/admin/indicators').send({
      label: 'Ganda',
      type: 'choice',
      options: [
        { label: 'Ya', score: 100 },
        { label: 'ya', score: 0 },
      ],
    });
    assert.equal(res.status, 400);
  });

  test('deactivated indicators disappear from the member form', async () => {
    const indicators = await get();
    const added = indicators.at(-1);
    const res = await murabbi.patch(`/api/admin/indicators/${added.id}`).send({ isActive: false, label: 'Membaca Buku' });
    assert.equal(res.status, 200);
    assert.equal(res.body.indicators.at(-1).label, 'Membaca Buku');

    const member = await loginAs('salman@mutabaahku.test');
    assert.equal((await member.get('/api/indicators')).body.indicators.length, 12);
  });

  test('cannot deactivate the last active indicator', async () => {
    const indicators = await get();
    const active = indicators.filter((i) => i.isActive);
    for (const i of active.slice(1)) await db('indicators').where({ id: i.id }).update({ is_active: false });
    const res = await murabbi.patch(`/api/admin/indicators/${active[0].id}`).send({ isActive: false });
    assert.equal(res.status, 400);
    await db('indicators').whereIn('id', active.map((i) => i.id)).update({ is_active: true });
  });
});

describe('export and trend', () => {
  test('CSV has a BOM, one column per indicator, and neutralises formulas', async () => {
    const member = await loginAs('rochiyat@mutabaahku.test');
    const indicators = (await member.get('/api/indicators')).body.indicators;
    const answers = indicators.map((i) => ({ indicatorId: i.id, optionId: i.options.at(-1).id }));
    await member.put('/api/reports').send({ answers, resumeText: '=HYPERLINK("x"), "kutip"\nbaris 2' });

    const { current } = submittablePeriods();
    const res = await murabbi
      .get('/api/dashboard/export.csv')
      .query({ year: current.year, month: current.month, week: current.week })
      .buffer(true)
      .parse((r, cb) => {
        let body = '';
        r.setEncoding('utf8');
        r.on('data', (c) => (body += c));
        r.on('end', () => cb(null, body));
      });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.headers['content-disposition'], /mutabaah-\d{4}-\d{1,2}-\d\.csv/);

    const csv = res.body;
    assert.equal(csv.charCodeAt(0), 0xfeff);
    const header = csv.slice(1).split('\r\n')[0].split(',');
    assert.deepEqual(header.slice(0, 5), ['Tahun', 'Bulan', 'Pekan', 'Nama', 'Email']);
    assert.ok(header.includes('Tilawah Sepekan'));
    assert.ok(header.includes('Membaca Buku'));
    assert.ok(csv.includes(`"'=HYPERLINK(""x""), ""kutip""\nbaris 2"`));
    assert.ok(csv.includes('Rochiyat'));
    assert.ok(csv.includes('Arief'));
  });

  test('trend returns weekly averages oldest first', async () => {
    const res = await murabbi.get('/api/dashboard/trend');
    assert.equal(res.status, 200);
    const { current } = submittablePeriods();
    const last = res.body.trend.at(-1);
    assert.deepEqual([last.year, last.month, last.week], [current.year, current.month, current.week]);
    assert.equal(last.submitted, 2);
    assert.equal(last.weekLabel, current.weekLabel);

    const one = await murabbi.get('/api/dashboard/trend').query({ userId: ids.Arief });
    assert.equal(one.body.trend.at(-1).submitted, 1);
    assert.equal(one.body.trend.at(-1).average, 95);
  });
});
