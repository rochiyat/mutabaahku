import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { activate, app, db, PASSWORD, resetDatabase } from './helpers/setup.js';
import { submittablePeriods } from '../src/services/reports.js';

const MEMBER = 'sabar@mutabaahku.test';
const MURABBI = 'murabbi@mutabaahku.test';

let member;
let indicators;

async function loginAs(email) {
  await activate(email);
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200);
  return agent;
}

/** Pick the option at `index` (0 = best) for every indicator. */
const answersAt = (index) =>
  indicators.map((i) => ({ indicatorId: i.id, optionId: i.options[Math.min(index, i.options.length - 1)].id }));

before(async () => {
  await resetDatabase();
  member = await loginAs(MEMBER);
  indicators = (await member.get('/api/indicators')).body.indicators;
});
after(() => db.destroy());

describe('indicators', () => {
  test('returns the 12 form indicators with options in order', () => {
    assert.equal(indicators.length, 12);
    assert.equal(indicators[0].code, 'tilawah');
    assert.equal(indicators[0].options[0].label, '7 Lembar');
    assert.equal(indicators.at(-1).type, 'boolean');
  });
});

describe('reports', () => {
  test('periods endpoint returns current and previous week', async () => {
    const res = await member.get('/api/reports/periods');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, submittablePeriods());
  });

  test('no report yet for this week', async () => {
    const res = await member.get('/api/reports/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.report, null);
  });

  test('all best answers score 100', async () => {
    const res = await member.put('/api/reports').send({ answers: answersAt(0), resumeText: 'Materi tentang ikhlas' });
    assert.equal(res.status, 200);
    assert.equal(res.body.report.totalScore, 100);
    assert.equal(res.body.report.answers.length, 12);
    assert.deepEqual(
      { year: res.body.report.year, month: res.body.report.month, week: res.body.report.week },
      (({ year, month, week }) => ({ year, month, week }))(submittablePeriods().current),
    );
  });

  test('submitting again updates the same report instead of adding one', async () => {
    const res = await member.put('/api/reports').send({ answers: answersAt(1), resumeText: 'Revisi resume' });
    assert.equal(res.status, 200);
    // second option: tilawah/dhuha/ql 86, jamaah 70 x2, matsurat 75, rawatib 80, istighfar 65, boolean "Tidak" 0 x4
    const expected = Math.round(((86 * 3 + 70 * 2 + 75 + 80 + 65) / 12) * 100) / 100;
    assert.equal(res.body.report.totalScore, expected);

    const count = await db('reports').count({ n: '*' }).first();
    assert.equal(Number(count.n), 1);

    const mine = await member.get('/api/reports/me');
    assert.equal(mine.body.report.resumeText, 'Revisi resume');
    assert.equal(mine.body.report.totalScore, expected);
  });

  test('can fill last week, but not older weeks', async () => {
    const { previous } = submittablePeriods();
    const prev = { year: previous.year, month: previous.month, week: previous.week };
    const ok = await member.put('/api/reports').send({ period: prev, answers: answersAt(0), resumeText: 'Telat' });
    assert.equal(ok.status, 200);

    const old = { year: 2020, month: 1, week: 1 };
    const rejected = await member.put('/api/reports').send({ period: old, answers: answersAt(0), resumeText: 'Lama' });
    assert.equal(rejected.status, 400);

    const fetched = await member.get('/api/reports/me').query(prev);
    assert.equal(fetched.body.report.resumeText, 'Telat');
  });

  test('history lists newest first', async () => {
    const res = await member.get('/api/reports/me/history');
    assert.equal(res.status, 200);
    assert.equal(res.body.reports.length, 2);
    const [a, b] = res.body.reports;
    assert.ok(a.year * 1000 + a.month * 10 + a.week > b.year * 1000 + b.month * 10 + b.week);
  });

  test('missing, duplicated or foreign options are rejected', async () => {
    const missing = await member.put('/api/reports').send({ answers: answersAt(0).slice(1), resumeText: 'x' });
    assert.equal(missing.status, 400);
    assert.ok(missing.body.error.details.some((d) => d.field === 'answers.tilawah'));

    const dup = answersAt(0);
    dup.push(dup[0]);
    assert.equal((await member.put('/api/reports').send({ answers: dup, resumeText: 'x' })).status, 400);

    const foreign = answersAt(0);
    foreign[0] = { indicatorId: indicators[0].id, optionId: indicators[1].options[0].id };
    assert.equal((await member.put('/api/reports').send({ answers: foreign, resumeText: 'x' })).status, 400);

    const noResume = await member.put('/api/reports').send({ answers: answersAt(0), resumeText: '   ' });
    assert.equal(noResume.status, 400);
  });

  test('murabbi cannot submit a member report', async () => {
    const murabbi = await loginAs(MURABBI);
    const res = await murabbi.put('/api/reports').send({ answers: answersAt(0), resumeText: 'x' });
    assert.equal(res.status, 403);
  });

  test('requires login', async () => {
    assert.equal((await request(app).get('/api/reports/me')).status, 401);
  });
});
