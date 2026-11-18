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

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
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

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
