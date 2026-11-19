import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { db, resetDatabase } from './helpers/setup.js';
import { createApp } from '../src/app.js';
import { config, productionProblems } from '../src/config.js';

let staticDir;

before(async () => {
  await resetDatabase();
  staticDir = mkdtempSync(path.join(tmpdir(), 'mutabaah-static-'));
  mkdirSync(path.join(staticDir, 'assets'));
  writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>Mutabaahku</title>');
  writeFileSync(path.join(staticDir, 'assets', 'app-abc123.js'), 'console.log(1)');
  writeFileSync(path.join(staticDir, 'favicon.svg'), '<svg/>');
});
after(async () => {
  rmSync(staticDir, { recursive: true, force: true });
  await db.destroy();
});

describe('productionProblems', () => {
  const prod = (overrides = {}) => ({
    ...config,
    isProduction: true,
    appUrl: 'https://mutabaah.example',
    jwt: { ...config.jwt, secret: 'x'.repeat(48) },
    smtp: { ...config.smtp, host: 'smtp.example' },
    ...overrides,
  });

  test('nothing to report outside production', () => {
    assert.deepEqual(productionProblems({ ...config, isProduction: false }), { errors: [], warnings: [] });
  });

  test('rejects a weak or placeholder JWT secret', () => {
    process.env.APP_URL = 'https://mutabaah.example';
    try {
      const weak = productionProblems(prod({ jwt: { ...config.jwt, secret: 'short' } }));
      assert.equal(weak.errors.length, 1);
      const placeholder = productionProblems(prod({ jwt: { ...config.jwt, secret: `change-me${'x'.repeat(40)}` } }));
      assert.equal(placeholder.errors.length, 1);
      assert.deepEqual(productionProblems(prod()), { errors: [], warnings: [] });
    } finally {
      delete process.env.APP_URL;
    }
  });

  test('requires APP_URL and warns about http and missing SMTP', () => {
    assert.ok(productionProblems(prod()).errors.some((e) => e.includes('APP_URL')));
    process.env.APP_URL = 'http://mutabaah.example';
    try {
      const { warnings } = productionProblems(prod({ appUrl: 'http://mutabaah.example', smtp: { ...config.smtp, host: undefined } }));
      assert.equal(warnings.length, 2);
    } finally {
      delete process.env.APP_URL;
    }
  });
});

describe('serving the built frontend', () => {
  let app;
  before(() => {
    app = createApp({ staticDir });
  });

  test('SPA routes return index.html without caching', async () => {
    for (const url of ['/', '/riwayat', '/anggota/3']) {
      const res = await request(app).get(url);
      assert.equal(res.status, 200, url);
      assert.match(res.text, /<title>Mutabaahku<\/title>/);
      assert.equal(res.headers['cache-control'], 'no-cache');
    }
  });

  test('hashed assets are cached long-term; missing ones are a JSON 404', async () => {
    const asset = await request(app).get('/assets/app-abc123.js');
    assert.equal(asset.status, 200);
    assert.match(asset.headers['cache-control'], /max-age=31536000, immutable/);

    const missing = await request(app).get('/assets/nope.js');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'NOT_FOUND');
  });

  test('API routes are not swallowed by the SPA fallback', async () => {
    assert.equal((await request(app).get('/api/reports/me')).status, 401);
    assert.equal((await request(app).get('/api/health')).body.status, 'ok');
  });

  test('CSP allows Google Fonts and nothing else external', async () => {
    const csp = (await request(app).get('/')).headers['content-security-policy'];
    assert.match(csp, /style-src 'self' https:\/\/fonts\.googleapis\.com/);
    assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
    assert.match(csp, /script-src 'self'/);
  });

  test('refuses to start with a folder that has no index.html', () => {
    assert.throws(() => createApp({ staticDir: path.join(staticDir, 'assets') }), /index\.html/);
  });
});

describe('seed', () => {
  test('re-running does not overwrite edited scores or labels', async () => {
    const option = await db('indicator_options').orderBy('id').first();
    await db('indicator_options').where({ id: option.id }).update({ score: 42, label: 'Diubah murabbi' });
    await db.seed.run();
    const after = await db('indicator_options').where({ id: option.id }).first();
    assert.equal(after.score, 42);
    assert.equal(after.label, 'Diubah murabbi');
    assert.equal(Number((await db('indicators').count({ n: '*' }).first()).n), 12);
  });

  test('production seed never creates the development accounts', async () => {
    await db('users').del();
    process.env.NODE_ENV = 'production';
    try {
      await db.seed.run();
    } finally {
      process.env.NODE_ENV = 'test';
    }
    assert.equal(Number((await db('users').count({ n: '*' }).first()).n), 0);

    await db.seed.run();
    assert.equal(Number((await db('users').count({ n: '*' }).first()).n), 9);
  });
});
