import { Router } from 'express';
import pool from '../../db/connection.js';

const router = Router();

const MAX_ROWS = 50_000;

router.get('/', async (req, res) => {
  const format = (req.query.format as string) || 'csv';
  const period = (req.query.period as string) || '30d';
  const provider = (req.query.provider as string) || 'all';
  const model = (req.query.model as string) || 'all';
  const dateFrom = req.query.date_from as string | undefined;
  const dateTo = req.query.date_to as string | undefined;

  // Check row count first
  const conditions: string[] = [];
  const params: (string)[] = [];

  if (dateFrom) { params.push(dateFrom); conditions.push(`created_at >= $${params.length}`); }
  else if (period !== 'all') { conditions.push(`created_at >= NOW() - INTERVAL '${period === 'all' ? '36500d' : period}'`); }

  if (dateTo) { params.push(dateTo); conditions.push(`created_at <= $${params.length}`); }
  if (provider !== 'all') { params.push(provider); conditions.push(`provider = $${params.length}`); }
  if (model !== 'all') { params.push(model); conditions.push(`model = $${params.length}`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM usage_logs ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  if (total > MAX_ROWS) {
    res.status(429).json({
      error: { code: 'EXPORT_TOO_LARGE', message: `Export would return ${total} rows. Maximum is ${MAX_ROWS}. Please narrow your date range.` },
    });
    return;
  }

  const dataResult = await pool.query(
    `SELECT request_id, provider, model,
      prompt_tokens, completion_tokens, total_tokens,
      cache_read_tokens, cache_creation_tokens,
      cache_creation_5m_tokens, cache_creation_1h_tokens,
      input_cost, output_cost, total_cost,
      endpoint, is_streaming, status_code,
      latency_ms, first_token_ms, user_agent, usage_captured, created_at
    FROM usage_logs ${where}
    ORDER BY created_at DESC`,
    params,
  );

  const rows = dataResult.rows;

  if (format === 'json') {
    const json = rows.map((r: Record<string, unknown>) => ({
      request_id: r.request_id,
      provider: r.provider,
      model: r.model,
      prompt_tokens: Number(r.prompt_tokens),
      completion_tokens: Number(r.completion_tokens),
      total_tokens: Number(r.total_tokens),
      cache_read_tokens: Number(r.cache_read_tokens),
      cache_creation_tokens: Number(r.cache_creation_tokens),
      cache_creation_5m_tokens: Number(r.cache_creation_5m_tokens),
      cache_creation_1h_tokens: Number(r.cache_creation_1h_tokens),
      input_cost: Number(r.input_cost),
      output_cost: Number(r.output_cost),
      total_cost: Number(r.total_cost),
      endpoint: r.endpoint,
      is_streaming: Boolean(r.is_streaming),
      status_code: Number(r.status_code),
      latency_ms: Number(r.latency_ms),
      first_token_ms: r.first_token_ms ? Number(r.first_token_ms) : null,
      user_agent: r.user_agent,
      usage_captured: Boolean(r.usage_captured),
      created_at: (r.created_at as Date).toISOString(),
    }));

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="tokenviz-export-${dateStr}.json"`);
    res.json({ exported_at: new Date().toISOString(), total, rows: json });
    return;
  }

  // CSV export
  const headers = [
    'request_id', 'provider', 'model',
    'prompt_tokens', 'completion_tokens', 'total_tokens',
    'cache_read_tokens', 'cache_creation_tokens',
    'cache_creation_5m_tokens', 'cache_creation_1h_tokens',
    'input_cost', 'output_cost', 'total_cost',
    'endpoint', 'is_streaming', 'status_code',
    'latency_ms', 'first_token_ms', 'user_agent', 'usage_captured', 'created_at',
  ];

  const csvRows = [headers.join(',')];

  for (const r of rows) {
    const vals = [
      r.request_id,
      r.provider,
      `"${r.model}"`,
      r.prompt_tokens,
      r.completion_tokens,
      r.total_tokens,
      r.cache_read_tokens,
      r.cache_creation_tokens,
      r.cache_creation_5m_tokens,
      r.cache_creation_1h_tokens,
      r.input_cost,
      r.output_cost,
      r.total_cost,
      r.endpoint,
      r.is_streaming,
      r.status_code,
      r.latency_ms,
      r.first_token_ms ?? '',
      r.user_agent ? `"${(r.user_agent as string).replace(/"/g, '""')}"` : '',
      r.usage_captured,
      (r.created_at as Date).toISOString(),
    ];
    csvRows.push(vals.join(','));
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tokenviz-export-${dateStr}.csv"`);
  // Add BOM for Excel compatibility
  res.send('﻿' + csvRows.join('\n'));
});

export default router;
