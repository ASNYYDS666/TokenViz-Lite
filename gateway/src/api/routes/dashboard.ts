import { Router } from 'express';
import pool from '../../db/connection.js';
import type { DashboardSummary, RecentActivityItem } from '../types.js';

const router = Router();

router.get('/summary', async (req, res) => {
  const period = (req.query.period as string) || '30d';
  const interval = period === 'all' ? '36500d' : period;

  const result = await pool.query(
    `SELECT
      COALESCE(SUM(total_cost), 0) AS total_cost,
      COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS total_tokens,
      COUNT(DISTINCT model) AS active_models,
      COUNT(*)::int AS request_count,
      COALESCE(AVG(latency_ms)::int, 0) AS avg_latency_ms,
      CASE WHEN SUM(cache_read_tokens + prompt_tokens) > 0
        THEN ROUND(SUM(cache_read_tokens)::numeric / SUM(cache_read_tokens + prompt_tokens), 4)
        ELSE 0
      END AS cache_hit_rate
    FROM usage_logs
    WHERE created_at >= NOW() - INTERVAL '${interval}'`,
  );

  const row = result.rows[0];

  // Today's cost separately
  const todayResult = await pool.query(
    `SELECT COALESCE(SUM(total_cost), 0) AS today_cost
     FROM usage_logs
     WHERE created_at >= CURRENT_DATE`,
  );

  const summary: DashboardSummary = {
    period,
    total_cost: Number(row.total_cost),
    today_cost: Number(todayResult.rows[0].today_cost),
    total_tokens: Number(row.total_tokens),
    active_models: Number(row.active_models),
    cache_hit_rate: Number(row.cache_hit_rate),
    request_count: Number(row.request_count),
    avg_latency_ms: Number(row.avg_latency_ms),
  };

  res.json(summary);
});

router.get('/recent-activity', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  const result = await pool.query(
    `SELECT id, provider, model, prompt_tokens, completion_tokens,
       total_cost, is_streaming, latency_ms, first_token_ms, user_agent, created_at
    FROM usage_logs
    ORDER BY created_at DESC
    LIMIT $1`,
    [limit],
  );

  const items: RecentActivityItem[] = result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    provider: r.provider as string,
    model: r.model as string,
    prompt_tokens: Number(r.prompt_tokens),
    completion_tokens: Number(r.completion_tokens),
    total_cost: Number(r.total_cost),
    is_streaming: Boolean(r.is_streaming),
    latency_ms: Number(r.latency_ms),
    first_token_ms: r.first_token_ms ? Number(r.first_token_ms) : null,
    user_agent: r.user_agent as string | null,
    created_at: (r.created_at as Date).toISOString(),
  }));

  res.json({ items });
});

export default router;
