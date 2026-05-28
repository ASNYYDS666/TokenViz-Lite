import express from 'express';
import cors from 'cors';
import pool from '../db/connection.js';
import { startScheduler } from '../core/scheduler.js';
import dashboardRoutes from './routes/dashboard.js';
import usageRoutes from './routes/usage.js';
import modelsRoutes from './routes/models.js';
import keysRoutes from './routes/keys.js';
import alertsRoutes from './routes/alerts.js';
import exportRoutes from './routes/export.js';

const app = express();

app.use(cors());
app.use(express.json());

// Health check — no auth
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db_connected: true,
      version: '0.1.0',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      db_connected: false,
      version: '0.1.0',
    });
  }
});

// Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/export', exportRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
});

export async function startApi(port: number = 3200) {
  startScheduler();

  app.listen(port, () => {
    console.log(`[api] listening on :${port}`);
  });
}

export default app;
