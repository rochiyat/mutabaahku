import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { activate, app, db, PASSWORD, resetDatabase } from './helpers/setup.js';
import { submittablePeriods } from '../src/services/reports.js';

let murabbi;
let indicators;
let current;
let previous;
const ids = {};

async function loginAs(email) {
  await activate(email);
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200);
  return agent;
}

const answersAt = (index) =>
  indicators.map((i) => ({ indicatorId: i.id, optionId: i.options[Math.min(index, i.options.length - 1)].id }));

const plain = ({ year, month, week }) => ({ year, month, week });

async function submit(name, index, period) {
  const agent = await loginAs(`${name}@mutabaahku.test`);
  const res = await agent.put('/api/reports').send({ period: plain(period), answers: answersAt(index), resumeText: `Resume ${name}` });
  assert.equal(res.status, 200);
  return res.body.report;
}

before(async () => {
  await resetDatabase();
  for (const u of await db('users').select('id', 'name')) ids[u.name] = u.id;
  murabbi = await loginAs('murabbi@mutabaahku.test');
  indicators = (await murabbi.get('/api/indicators')).body.indicators;
  ({ current, previous } = submittablePeriods());

  await submit('rochiyat', 0, current); // 100
  await submit('arief', 1, current); // lower
  await submit('arief', 0, previous); // 100, last week
});
after(() => db.destroy());

describe('dashboard', () => {
  test('current week: totals, ranking and who has not reported', async () => {
    const res = await murabbi.get('/api/dashboard').query(plain(current));
    assert.equal(res.status, 200);
    const { summary, ranking, notSubmitted, perIndicator } = res.body;

    assert.equal(summary.totalReports, 2);
    assert.equal(summary.submitted, 2);
    assert.equal(summary.members, 8);
    assert.equal(summary.notSubmitted, 6);

    assert.deepEqual(
      ranking.map((r) => [r.rank, r.name]),
      [
        [1, 'Rochiyat'],
        [2, 'Arief'],
      ],
    );
    assert.equal(ranking[0].average, 100);
    assert.equal(summary.average, Math.round(((100 + ranking[1].average) / 2) * 100) / 100);

    assert.equal(notSubmitted.length, 6);
    assert.ok(!notSubmitted.some((m) => m.name === 'Rochiyat' || m.name === 'Arief'));

    assert.equal(perIndicator.length, 12);
    const tilawah = perIndicator.find((i) => i.code === 'tilawah');
    assert.equal(tilawah.average, (100 + 86) / 2);
    // Arief answered "Tidak" (0) on the boolean indicators this week.
    assert.equal(perIndicator.find((i) => i.code === 'infaq').average, 50);
  });

  test('empty filters mean all periods', async () => {
    const res = await murabbi.get('/api/dashboard').query({ year: '', month: '', week: '', userId: '' });
    assert.equal(res.status, 200);
    assert.equal(res.body.summary.totalReports, 3);
    assert.equal(res.body.summary.submitted, 2);
    const arief = res.body.ranking.find((r) => r.name === 'Arief');
    assert.equal(arief.reports, 2);
  });

  test('member filter narrows everything to one member', async () => {
    const res = await murabbi.get('/api/dashboard').query({ userId: ids.Herman });
    assert.equal(res.body.summary.members, 1);
    assert.equal(res.body.summary.totalReports, 0);
    assert.equal(res.body.summary.average, null);
    assert.deepEqual(res.body.notSubmitted, [{ userId: ids.Herman, name: 'Herman' }]);
    assert.ok(res.body.perIndicator.every((i) => i.average === null));
  });

  test('a period with no reports yields an empty dashboard', async () => {
    const res = await murabbi.get('/api/dashboard').query({ year: 2020, month: 1, week: 1 });
    assert.equal(res.body.summary.totalReports, 0);
    assert.equal(res.body.ranking.length, 0);
    assert.equal(res.body.notSubmitted.length, 8);
  });

  test('rejects invalid filters', async () => {
    const res = await murabbi.get('/api/dashboard').query({ week: 9 });
    assert.equal(res.status, 400);
  });

  test('filter options list years and active members', async () => {
    const res = await murabbi.get('/api/dashboard/filters');
    assert.equal(res.status, 200);
    assert.ok(res.body.years.includes(current.year));
    assert.equal(res.body.members.length, 8);
    assert.deepEqual(res.body.current, plain(current));
  });

  test('inactive members drop out of the dashboard', async () => {
    await db('users').where({ id: ids.Arief }).update({ is_active: false });
    const res = await murabbi.get('/api/dashboard').query(plain(current));
    assert.equal(res.body.summary.members, 7);
    assert.equal(res.body.summary.totalReports, 1);
    await db('users').where({ id: ids.Arief }).update({ is_active: true });
  });
});

describe('member detail', () => {
  test('history and a single report for a member', async () => {
    const res = await murabbi.get(`/api/dashboard/members/${ids.Arief}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.member.name, 'Arief');
    assert.equal(res.body.reports.length, 2);

    const p = plain(previous);
    const one = await murabbi.get(`/api/dashboard/members/${ids.Arief}/reports/${p.year}/${p.month}/${p.week}`);
    assert.equal(one.status, 200);
    assert.equal(one.body.report.totalScore, 100);
    assert.equal(one.body.report.resumeText, 'Resume arief');
  });

  test('404 for the murabbi account, unknown members and missing reports', async () => {
    assert.equal((await murabbi.get(`/api/dashboard/members/${ids.Murabbi}`)).status, 404);
    assert.equal((await murabbi.get('/api/dashboard/members/9999')).status, 404);
    const missing = await murabbi.get(`/api/dashboard/members/${ids.Herman}/reports/2020/1/1`);
    assert.equal(missing.status, 404);
  });
});

describe('access', () => {
  test('members cannot open the dashboard', async () => {
    const member = await loginAs('sabar@mutabaahku.test');
    assert.equal((await member.get('/api/dashboard')).status, 403);
    assert.equal((await member.get(`/api/dashboard/members/${ids.Arief}`)).status, 403);
  });
});
