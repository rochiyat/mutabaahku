import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { db } from './db/knex.js';
import { requireAuth, requirePasswordChanged, requireRole } from './middlewares/auth.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { reportsRouter } from './routes/reports.js';
import { listActiveIndicators } from './services/indicators.js';

export function createApp({ staticDir = config.staticDir } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // index.html memuat font dari Google Fonts.
          'style-src': ["'self'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
        },
      },
    }),
  );
  app.use(cors({ origin: config.appUrl, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      await db.raw('select 1');
      res.json({ status: 'ok', db: 'ok' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'unreachable' });
    }
  });

  app.use('/api/auth', authRouter);

  const protectedApi = express.Router();
  protectedApi.use(requireAuth, requirePasswordChanged);
  protectedApi.get('/indicators', async (_req, res) => {
    res.json({ indicators: await listActiveIndicators() });
  });
  protectedApi.use('/reports', reportsRouter);
  protectedApi.use('/dashboard', requireRole('murabbi'), dashboardRouter);
  protectedApi.use('/admin', requireRole('murabbi'), adminRouter);
  app.use('/api', protectedApi);

  if (staticDir) serveFrontend(app, staticDir);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/** Serves the built SPA: hashed assets cached for a year, every other GET falls back to index.html. */
function serveFrontend(app, dir) {
  const root = path.resolve(dir);
  const index = path.join(root, 'index.html');
  if (!existsSync(index)) throw new Error(`STATIC_DIR ${root} tidak berisi index.html`);

  app.use('/assets', express.static(path.join(root, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(root, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.set('Cache-Control', 'no-cache').sendFile(index);
  });
}
