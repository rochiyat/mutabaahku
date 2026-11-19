import { config, productionProblems } from './config.js';
import { createApp } from './app.js';
import { db } from './db/knex.js';

const { errors, warnings } = productionProblems();
for (const w of warnings) console.warn(`[config] ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`[config] ${e}`);
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}${config.staticDir ? ' (serving frontend)' : ''}`);
});

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`${signal} diterima, menutup server...`);
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
  // Jangan menunggu koneksi keep-alive selamanya.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
