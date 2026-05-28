import { Router } from 'express';
import pool from '../../db/connection.js';
import type {
  TrendPoint, CostTrendPoint, ModelUsageSummary, ProviderUsageSummary,
  CacheStatsItem, CacheTrendPoint, UsageHistoryItem, PaginationMeta,
  PerformanceOverall, ModelPerformance, PerformanceTrendPoint,
} from '../types.js';

const router = Router();

const VALID_PERIODS = ['1d', '7d', '30d', '90d', 'all'];
const VALID_GRANULARITIES = ['hour', 'day', 'week', 'month'];

function sqlInterval(period: string): string {
  return period === 'all' ? '36500d' : period;
}

function validatePeriod(period: string): boolean {
  return VALID_PERIODS.includes(period);
}

// ─── Trend ───

router.get('/trend', async (req, res) => {
  const period = (req.query.period as string) || '7d';
  const granularity = (req.query.granularity as string) || 'hour';
  const provider = (req.query.provider as string) || 'all';
  const model = (req.query.model as string) || 'all';

  if (!validatePeriod(period)) {
    res.status(400).json({ error: { code: 'INVALID_PERIOD', message: `Invalid period: ${period}` } });
    return;
  }
  if (!VALID_GRANULARITIES.includes(granularity)) {
    res.status(400).json({ error: { code: 'INVALID_GRANULARITY', message: `Invalid granularity: ${granularity}` } });
    return;
  }

  const interval = sqlInterval(period);
  const trunc = granularity === 'week' ? 'week' : granularity;

  const result = await pool.query(
    `SELECT
      date_trunc('${trunc}', hour) AS time,
      SUM(prompt_tokens)::bigint AS prompt_tokens,
      SUM(completion_tokens)::bigint AS completion_tokens,
      SUM(total_tokens)::bigint AS total_tokens,
      SUM(total_cost) AS total_cost,
      SUM(request_count)::int AS request_count
    FROM token_hourly_stats
    WHERE hour >= NOW() - INTERVAL '${interval}'
      AND ($1 = 'all' OR provider = $1)
      AND ($2 = 'all' OR model = $2)
    GROUP BY time
    ORDER BY time`,
    [provider, model],
  );

  const series: TrendPoint[] = result.rows.map((r: Record<string, unknown>) => ({
    time: (r.time as Date).toISOString(),
    prompt_tokens: Number(r.prompt_tokens),
    completion_tokens: Number(r.completion_tokens),
    total_tokens: Number(r.total_tokens),
    total_cost: Number(r.total_cost),
    request_count: Number(r.request_count),
  }));

  res.json({ period, granularity, series });
});

// ─── Cost Trend ───

router.get('/trend/cost', async (req, res) => {
  const period = (req.query.period as string) || '7d';
  const granularity = (req.query.granularity as string) || 'day';

  if (!validatePeriod(period)) {
    res.status(400).json({ error: { code: 'INVALID_PERIOD', message: `Invalid period: ${period}` } });
    return;
  }

  const interval = sqlInterval(period);
  const trunc = granularity === 'week' ? 'week' : granularity;

  const result = await pool.query(
    `SELECT
      date_trunc('${trunc}', hour) AS time,
      SUM(input_cost) AS input_cost,
      SUM(output_cost) AS output_cost,
      SUM(total_cost) AS total_cost
    FROM token_hourly_stats
    WHERE hour >= NOW() - INTERVAL '${interval}'
    GROUP BY time
    ORDER BY time`,
  );

  const series: CostTrendPoint[] = result.rows.map((r: Record<string, unknown>) => ({
    time: (r.time as Date).toISOString(),
    input_cost: Number(r.input_cost),
    output_cost: Number(r.output_cost),
    total_cost: Number(r.total_cost),
  }));

  res.json({ period, granularity, series });
});

// ─── By Model ───

router.get('/by-model', async (req, res) => {
  const period = (req.query.period as string) || '30d';
  const sortBy = (req.query.sort_by as string) || 'total_cost';
  const order = (req.query.order as string) || 'desc';
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const allowedSorts = ['total_cost', 'total_tokens', 'request_count', 'avg_latency_ms'];
  const sortCol = allowedSorts.includes(sortBy) ? sortBy : 'total_cost';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';

  const interval = sqlInterval(period);

  const result = await pool.query(
    `SELECT provider, model,
      SUM(prompt_tokens)::bigint AS prompt_tokens,
      SUM(completion_tokens)::bigint AS completion_tokens,
      SUM(total_tokens)::bigint AS total_tokens,
      SUM(cache_read_tokens)::bigint AS cache_read_tokens,
      SUM(cache_creation_tokens)::bigint AS cache_creation_tokens,
      SUM(input_cost) AS input_cost,
      SUM(output_cost) AS output_cost,
      SUM(total_cost) AS total_cost,
      COUNT(*)::int AS request_count,
      AVG(latency_ms)::int AS avg_latency_ms
    FROM usage_logs
    WHERE created_at >= NOW() - INTERVAL '${interval}'
    GROUP BY provider, model
    ORDER BY ${sortCol} ${sortDir}
    LIMIT $1`,
    [limit],
  );

  const models: ModelUsageSummary[] = result.rows.map((r: Record<string, unknown>) => ({
    provider: r.provider as string,
    model: r.model as string,
    prompt_tokens: Number(r.prompt_tokens),
    completion_tokens: Number(r.completion_tokens),
    total_tokens: Number(r.total_tokens),
    cache_read_tokens: Number(r.cache_read_tokens),
    cache_creation_tokens: Number(r.cache_creation_tokens),
    input_cost: Number(r.input_cost),
    output_cost: Number(r.output_cost),
    total_cost: Number(r.total_cost),
    request_count: Number(r.request_count),
    avg_latency_ms: Number(r.avg_latency_ms),
  }));

  res.json({ period, models });
});

// ─── By Provider ───

router.get('/by-provider', async (req, res) => {
  const period = (req.query.period as string) || '30d';
  const interval = sqlInterval(period);

  const result = await pool.query(
    `SELECT provider,
      SUM(total_tokens)::bigint AS total_tokens,
      SUM(total_cost) AS total_cost,
      COUNT(*)::int AS request_count,
      COUNT(DISTINCT model)::int AS model_count
    FROM usage_logs
    WHERE created_at >= NOW() - INTERVAL '${interval}'
    GROUP BY provider
    ORDER BY total_cost DESC`,
  );

  // For each provider, also get sub-model breakdown
  const providers: ProviderUsageSummary[] = [];
  for (const r of result.rows) {
    const modelsResult = await pool.query(
      `SELECT model, SUM(total_cost) AS total_cost, SUM(total_tokens)::bigint AS total_tokens
       FROM usage_logs
       WHERE created_at >= NOW() - INTERVAL '${interval}'
         AND provider = $1
       GROUP BY model
       ORDER BY total_cost DESC`,
      [r.provider],
    );

    providers.push({
      provider: r.provider as string,
      total_tokens: Number(r.total_tokens),
      total_cost: Number(r.total_cost),
      request_count: Number(r.request_count),
      model_count: Number(r.model_count),
      models: modelsResult.rows.map((m: Record<string, unknown>) => ({
        model: m.model as string,
        total_cost: Number(m.total_cost),
        total_tokens: Number(m.total_tokens),
      })),
    });
  }

  res.json({ period, providers });
});

// ─── Cache Stats ───

router.get('/cache-stats', async (req, res) => {
  const period = (req.query.period as string) || '7d';
  const provider = (req.query.provider as string) || 'all';
  const interval = sqlInterval(period);

  const result = await pool.query(
    `SELECT provider, model,
      SUM(prompt_tokens)::bigint AS prompt_tokens,
      SUM(cache_read_tokens)::bigint AS cache_read_tokens,
      SUM(cache_creation_tokens)::bigint AS cache_creation_tokens,
      SUM(total_cost) AS total_cost,
      COUNT(*)::int AS request_count,
      CASE WHEN SUM(cache_read_tokens + prompt_tokens) > 0
        THEN ROUND(SUM(cache_read_tokens)::numeric / SUM(cache_read_tokens + prompt_tokens), 4)
        ELSE 0
      END AS cache_hit_rate
    FROM usage_logs
    WHERE created_at >= NOW() - INTERVAL '${interval}'
      AND ($1 = 'all' OR provider = $1)
    GROUP BY provider, model
    ORDER BY cache_hit_rate DESC`,
    [provider],
  );

  // Calculate estimated savings per model
  const models: CacheStatsItem[] = [];
  for (const r of result.rows) {
    // Get pricing for savings calculation
    const pricingResult = await pool.query(
      `SELECT input_price, cache_read_price FROM model_pricing
       WHERE provider = $1 AND model = $2 AND is_active = true LIMIT 1`,
      [r.provider, r.model],
    );

    let estimatedSavings = 0;
    if (pricingResult.rows.length > 0) {
      const p = pricingResult.rows[0];
      const inputPrice = Number(p.input_price);
      const cacheReadPrice = Number(p.cache_read_price);
      estimatedSavings = Number(r.cache_read_tokens) * (inputPrice - cacheReadPrice) / 1_000_000;
    }

    models.push({
      provider: r.provider as string,
      model: r.model as string,
      prompt_tokens: Number(r.prompt_tokens),
      cache_read_tokens: Number(r.cache_read_tokens),
      cache_creation_tokens: Number(r.cache_creation_tokens),
      cache_hit_rate: Number(r.cache_hit_rate),
      total_cost: Number(r.total_cost),
      estimated_savings: Math.round(estimatedSavings * 10000) / 10000,
      request_count: Number(r.request_count),
    });
  }

  res.json({ period, models });
});

// ─── Cache Trend ───

router.get('/cache-trend', async (req, res) => {
  const period = (req.query.period as string) || '7d';
  const granularity = (req.query.granularity as string) || 'day';
  const model = (req.query.model as string) || 'all';

  const interval = sqlInterval(period);
  const trunc = granularity === 'week' ? 'week' : granularity;

  const result = await pool.query(
    `SELECT
      date_trunc('${trunc}', hour) AS time,
      SUM(prompt_tokens)::bigint AS prompt_tokens,
      SUM(cache_read_tokens)::bigint AS cache_read_tokens,
      SUM(cache_creation_tokens)::bigint AS cache_creation_tokens,
      SUM(total_cost) AS total_cost,
      CASE WHEN SUM(cache_read_tokens + prompt_tokens) > 0
        THEN ROUND(SUM(cache_read_tokens)::numeric / SUM(cache_read_tokens + prompt_tokens), 4)
        ELSE 0
      END AS cache_hit_rate
    FROM token_hourly_stats
    WHERE hour >= NOW() - INTERVAL '${interval}'
      AND ($1 = 'all' OR model = $1)
    GROUP BY time
    ORDER BY time`,
    [model],
  );

  const series: CacheTrendPoint[] = result.rows.map((r: Record<string, unknown>) => ({
    time: (r.time as Date).toISOString(),
    prompt_tokens: Number(r.prompt_tokens),
    cache_read_tokens: Number(r.cache_read_tokens),
    cache_creation_tokens: Number(r.cache_creation_tokens),
    cache_hit_rate: Number(r.cache_hit_rate),
    total_cost: Number(r.total_cost),
    estimated_savings: 0, // simplified — frontend can calculate
  }));

  res.json({ period, granularity, series });
});

// ─── History ───

router.get('/history', async (req, res) => {
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;
  const provider = (req.query.provider as string) || 'all';
  const model = (req.query.model as string) || 'all';
  const isStreaming = (req.query.is_streaming as string) || 'all';
  const sortBy = (req.query.sort_by as string) || 'created_at';
  const order = (req.query.order as string) || 'desc';
  const dateFrom = req.query.date_from as string | undefined;
  const dateTo = req.query.date_to as string | undefined;
  const usageCaptured = (req.query.usage_captured as string) || 'all';

  const allowedSorts = ['created_at', 'total_cost', 'total_tokens', 'latency_ms'];
  const sortCol = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (provider !== 'all') { params.push(provider); conditions.push(`provider = $${params.length}`); }
  if (model !== 'all') { params.push(model); conditions.push(`model = $${params.length}`); }
  if (isStreaming === 'true') conditions.push('is_streaming = true');
  else if (isStreaming === 'false') conditions.push('is_streaming = false');
  if (dateFrom) { params.push(dateFrom); conditions.push(`created_at >= $${params.length}`); }
  if (dateTo) { params.push(dateTo); conditions.push(`created_at <= $${params.length}`); }
  if (usageCaptured === 'true') conditions.push('usage_captured = true');
  else if (usageCaptured === 'false') conditions.push('usage_captured = false');

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countParams = [...params];
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM usage_logs ${where}`,
    countParams,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limit, offset];
  const dataResult = await pool.query(
    `SELECT id, request_id, provider, model,
      prompt_tokens, completion_tokens, total_tokens,
      cache_read_tokens, input_cost, output_cost, total_cost,
      endpoint, is_streaming, status_code,
      latency_ms, first_token_ms, user_agent, usage_captured, created_at
    FROM usage_logs ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams,
  );

  const items: UsageHistoryItem[] = dataResult.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    request_id: r.request_id as string,
    provider: r.provider as string,
    model: r.model as string,
    prompt_tokens: Number(r.prompt_tokens),
    completion_tokens: Number(r.completion_tokens),
    total_tokens: Number(r.total_tokens),
    cache_read_tokens: Number(r.cache_read_tokens),
    input_cost: Number(r.input_cost),
    output_cost: Number(r.output_cost),
    total_cost: Number(r.total_cost),
    endpoint: r.endpoint as string,
    is_streaming: Boolean(r.is_streaming),
    status_code: Number(r.status_code),
    latency_ms: Number(r.latency_ms),
    first_token_ms: r.first_token_ms ? Number(r.first_token_ms) : null,
    user_agent: r.user_agent as string | null,
    usage_captured: Boolean(r.usage_captured),
    created_at: (r.created_at as Date).toISOString(),
  }));

  const pagination: PaginationMeta = {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
  };

  res.json({ items, pagination });
});

// ─── Performance ───

router.get('/performance', async (req, res) => {
  const period = (req.query.period as string) || '7d';
  const provider = (req.query.provider as string) || 'all';
  const model = (req.query.model as string) || 'all';
  const interval = sqlInterval(period);

  // Overall performance
  const overallResult = await pool.query(
    `SELECT
      COALESCE(AVG(latency_ms)::int, 0) AS avg_latency_ms,
      COALESCE(AVG(first_token_ms)::int, 0) AS avg_first_token_ms,
      COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms)::int, 0) AS p50_latency_ms,
      COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int, 0) AS p95_latency_ms,
      COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::int, 0) AS p99_latency_ms
    FROM usage_logs
    WHERE created_at >= NOW() - INTERVAL '${interval}'
      AND ($1 = 'all' OR provider = $1)
      AND ($2 = 'all' OR model = $2)
      AND latency_ms IS NOT NULL`,
    [provider, model],
  );

  const overall: PerformanceOverall = {
    avg_latency_ms: Number(overallResult.rows[0].avg_latency_ms),
    avg_first_token_ms: Number(overallResult.rows[0].avg_first_token_ms),
    p50_latency_ms: Number(overallResult.rows[0].p50_latency_ms),
    p95_latency_ms: Number(overallResult.rows[0].p95_latency_ms),
    p99_latency_ms: Number(overallResult.rows[0].p99_latency_ms),
  };

  // By model
  const byModelResult = await pool.query(
    `SELECT provider, model,
      AVG(latency_ms)::int AS avg_latency_ms,
      AVG(first_token_ms)::int AS avg_first_token_ms,
      COUNT(*)::int AS request_count
    FROM usage_logs
    WHERE created_at >= NOW() - INTERVAL '${interval}'
      AND ($1 = 'all' OR provider = $1)
      AND ($2 = 'all' OR model = $2)
      AND latency_ms IS NOT NULL
    GROUP BY provider, model
    ORDER BY avg_latency_ms DESC`,
    [provider, model],
  );

  const byModel: ModelPerformance[] = byModelResult.rows.map((r: Record<string, unknown>) => ({
    provider: r.provider as string,
    model: r.model as string,
    avg_latency_ms: Number(r.avg_latency_ms),
    avg_first_token_ms: Number(r.avg_first_token_ms),
    request_count: Number(r.request_count),
  }));

  // Trend
  const trendResult = await pool.query(
    `SELECT
      date_trunc('day', hour) AS time,
      AVG(avg_latency_ms)::int AS avg_latency_ms,
      AVG(avg_first_token_ms)::int AS avg_first_token_ms
    FROM token_hourly_stats
    WHERE hour >= NOW() - INTERVAL '${interval}'
      AND ($1 = 'all' OR provider = $1)
      AND ($2 = 'all' OR model = $2)
      AND avg_latency_ms > 0
    GROUP BY time
    ORDER BY time`,
    [provider, model],
  );

  const trend: PerformanceTrendPoint[] = trendResult.rows.map((r: Record<string, unknown>) => ({
    time: (r.time as Date).toISOString(),
    avg_latency_ms: Number(r.avg_latency_ms),
    avg_first_token_ms: Number(r.avg_first_token_ms),
  }));

  res.json({ period, overall, by_model: byModel, trend });
});

export default router;
