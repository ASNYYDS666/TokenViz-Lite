import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { readAlertConfig, writeAlertConfig, getAlertStatus } from '../../core/alert.js';

const router = Router();

// GET alert config — public
router.get('/config', (_req, res) => {
  res.json(readAlertConfig());
});

// PUT alert config — auth required
router.put('/config', authMiddleware, (req, res) => {
  const { enabled, daily_limit, weekly_limit, monthly_limit } = req.body;

  const current = readAlertConfig();
  const updated = {
    enabled: enabled !== undefined ? Boolean(enabled) : current.enabled,
    daily_limit: daily_limit !== undefined ? Number(daily_limit) : current.daily_limit,
    weekly_limit: weekly_limit !== undefined ? Number(weekly_limit) : current.weekly_limit,
    monthly_limit: monthly_limit !== undefined ? Number(monthly_limit) : current.monthly_limit,
  };

  writeAlertConfig(updated);
  res.json(updated);
});

// GET alert status — public
router.get('/status', async (_req, res) => {
  const alerts = await getAlertStatus();
  res.json({ alerts });
});

export default router;
