import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, db, outbox, PASSWORD, resetDatabase } from './helpers/setup.js';
import { config } from '../src/config.js';

const EMAIL = 'rochiyat@mutabaahku.test';

before(resetDatabase);
after(() => db.destroy());

async function login(email = EMAIL, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  return { agent, res };
}

describe('login', () => {
  test('rejects wrong password and unknown email with the same message', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ email: EMAIL, password: 'salah-sekali' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'x@y.test', password: 'salah-sekali' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error.message, unknown.body.error.message);
  });

  test('validates input', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bukan-email' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.details.some((d) => d.field === 'email'));
  });

  test('email is case-insensitive and sets an httpOnly cookie', async () => {
    const { res } = await login(EMAIL.toUpperCase());
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, EMAIL);
    assert.equal(res.body.user.mustChangePassword, true);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/);
    assert.equal(res.body.user.password_hash, undefined);
  });

  test('me requires a session', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });
});

describe('first login must change password', () => {
  test('protected API is blocked until password changed', async () => {
    const { agent } = await login();
    const blocked = await agent.get('/api/indicators');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');

    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
  });

  test('change-password checks the current password and unlocks the API', async () => {
    const { agent } = await login();

    const wrong = await agent.post('/api/auth/change-password').send({ currentPassword: 'keliru123', newPassword: 'passwordBaru1' });
    assert.equal(wrong.status, 400);

    const same = await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: PASSWORD });
    assert.equal(same.status, 400);

    const short = await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'pendek' });
    assert.equal(short.status, 400);

    const ok = await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'passwordBaru1' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.mustChangePassword, false);

    const indicators = await agent.get('/api/indicators');
    assert.equal(indicators.status, 200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    assert.equal(oldLogin.status, 401);
  });

  test('changing the password signs out other sessions', async () => {
    const { agent: other } = await login(EMAIL, 'passwordBaru1');
    assert.equal((await other.get('/api/auth/me')).status, 200);

    // Tokens carry second-precision iat; make sure the change lands in a later second.
    await new Promise((r) => setTimeout(r, 1100));
    const { agent: mine } = await login(EMAIL, 'passwordBaru1');
    const res = await mine.post('/api/auth/change-password').send({ currentPassword: 'passwordBaru1', newPassword: 'passwordBaru2' });
    assert.equal(res.status, 200);

    assert.equal((await other.get('/api/auth/me')).status, 401);
    assert.equal((await mine.get('/api/auth/me')).status, 200);
  });

  test('logout clears the session cookie', async () => {
    const { agent } = await login(EMAIL, 'passwordBaru2');
    const res = await agent.post('/api/auth/logout');
    assert.equal(res.status, 204);
    assert.equal((await agent.get('/api/auth/me')).status, 401);
  });
});

describe('forgot password without SMTP', () => {
  test('options report email disabled', async () => {
    const res = await request(app).get('/api/auth/options');
    assert.deepEqual(res.body, { emailEnabled: false });
  });

  test('does not create a token, so a link shared by the murabbi stays valid', async () => {
    const before = await db('password_reset_tokens').count({ n: '*' }).first();
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'salman@mutabaahku.test' });
    assert.equal(res.status, 200);
    const after = await db('password_reset_tokens').count({ n: '*' }).first();
    assert.equal(Number(after.n), Number(before.n));
  });
});

describe('forgot / reset password', () => {
  const tokenFromMail = () => new URL(outbox.at(-1).text.match(/https?:\S+/)[0]).searchParams.get('token');

  before(() => {
    config.smtp.host = 'smtp.test';
  });
  after(() => {
    config.smtp.host = undefined;
  });

  test('unknown email gets the same answer and no mail', async () => {
    outbox.length = 0;
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'tidak.ada@mutabaahku.test' });
    assert.equal(res.status, 200);
    assert.equal(outbox.length, 0);
  });

  test('reset link sets a new password once, and only the latest link works', async () => {
    const email = 'bhayu@mutabaahku.test';
    await request(app).post('/api/auth/forgot-password').send({ email });
    const first = tokenFromMail();
    await request(app).post('/api/auth/forgot-password').send({ email: email.toUpperCase() });
    const second = tokenFromMail();
    assert.equal(outbox.at(-1).to, email);

    const stale = await request(app).post('/api/auth/reset-password').send({ token: first, newPassword: 'resetBaru123' });
    assert.equal(stale.status, 400);
    assert.equal(stale.body.error.code, 'INVALID_RESET_TOKEN');

    const ok = await request(app).post('/api/auth/reset-password').send({ token: second, newPassword: 'resetBaru123' });
    assert.equal(ok.status, 200);

    const reused = await request(app).post('/api/auth/reset-password').send({ token: second, newPassword: 'resetLagi123' });
    assert.equal(reused.status, 400);

    const { res } = await login(email, 'resetBaru123');
    assert.equal(res.status, 200);
    assert.equal(res.body.user.mustChangePassword, false);
  });

  test('expired token is rejected', async () => {
    const email = 'herman@mutabaahku.test';
    await request(app).post('/api/auth/forgot-password').send({ email });
    const token = tokenFromMail();
    await db('password_reset_tokens').update({ expires_at: new Date(Date.now() - 1000) });

    const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'resetBaru123' });
    assert.equal(res.status, 400);
  });

  test('inactive accounts cannot log in', async () => {
    await db('users').where({ email: 'bhayu@mutabaahku.test' }).update({ is_active: false });
    const { res } = await login('bhayu@mutabaahku.test', 'resetBaru123');
    assert.equal(res.status, 401);
  });
});
