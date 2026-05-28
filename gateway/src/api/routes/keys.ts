import { Router } from 'express';
import pool from '../../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import type { ApiKeyItem } from '../types.js';

const router = Router();

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 3) + '****' + key.slice(-4);
}

// GET all keys — auth required
router.get('/', authMiddleware, async (_req, res) => {
  const result = await pool.query(
    `SELECT k.id, k.provider, k.key_alias, k.key_value, k.base_url, k.is_active, k.created_at,
       (SELECT MAX(created_at) FROM usage_logs WHERE api_key_id = k.id::text) AS last_used_at
    FROM api_keys k
    ORDER BY k.provider, k.key_alias`,
  );

  const keys: ApiKeyItem[] = result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    provider: r.provider as string,
    key_alias: r.key_alias as string,
    key_value: maskKey(r.key_value as string),
    base_url: r.base_url as string | null,
    is_active: Boolean(r.is_active),
    created_at: (r.created_at as Date).toISOString(),
    last_used_at: r.last_used_at ? (r.last_used_at as Date).toISOString() : null,
  }));

  res.json({ keys });
});

// POST create key — auth required
router.post('/', authMiddleware, async (req, res) => {
  const { provider, key_alias, key_value, base_url } = req.body;

  if (!provider || !key_alias || !key_value) {
    res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'provider, key_alias, key_value are required' } });
    return;
  }

  const validProviders = ['openai', 'anthropic', 'deepseek', 'zhipu', 'qwen', 'gemini'];
  if (!validProviders.includes(provider)) {
    res.status(400).json({ error: { code: 'INVALID_PROVIDER', message: `Invalid provider: ${provider}` } });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO api_keys (provider, key_alias, key_value, base_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, provider, key_alias, key_value, base_url, is_active, created_at`,
      [provider, key_alias, key_value, base_url || null],
    );

    const r = result.rows[0];
    res.status(201).json({
      id: r.id,
      provider: r.provider,
      key_alias: r.key_alias,
      key_value: maskKey(r.key_value),
      base_url: r.base_url,
      is_active: Boolean(r.is_active),
      created_at: (r.created_at as Date).toISOString(),
      last_used_at: null,
    });
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      res.status(422).json({ error: { code: 'KEY_ALIAS_DUPLICATE', message: 'key_alias already exists for this provider' } });
      return;
    }
    throw err;
  }
});

// PUT update key — auth required
router.put('/:id', authMiddleware, async (req, res) => {
  const { key_alias, key_value, base_url, is_active } = req.body;

  const fields: string[] = [];
  const params: (string | number | boolean)[] = [req.params.id as string];
  let idx = 2;

  if (key_alias !== undefined) { params.push(key_alias); fields.push(`key_alias = $${idx++}`); }
  if (key_value !== undefined) { params.push(key_value); fields.push(`key_value = $${idx++}`); }
  if (base_url !== undefined) { params.push(base_url); fields.push(`base_url = $${idx++}`); }
  if (is_active !== undefined) { params.push(Boolean(is_active)); fields.push(`is_active = $${idx++}`); }

  if (fields.length === 0) {
    res.status(400).json({ error: { code: 'NO_FIELDS', message: 'No fields to update' } });
    return;
  }

  const result = await pool.query(
    `UPDATE api_keys SET ${fields.join(', ')} WHERE id = $1
     RETURNING id, provider, key_alias, key_value, base_url, is_active, created_at`,
    params,
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Key not found' } });
    return;
  }

  const r = result.rows[0];
  res.json({
    id: r.id,
    provider: r.provider,
    key_alias: r.key_alias,
    key_value: maskKey(r.key_value),
    base_url: r.base_url,
    is_active: Boolean(r.is_active),
    created_at: (r.created_at as Date).toISOString(),
    last_used_at: null,
  });
});

// DELETE key — auth required
router.delete('/:id', authMiddleware, async (req, res) => {
  // Check if it's the last active key for the provider
  const keyResult = await pool.query('SELECT provider FROM api_keys WHERE id = $1', [req.params.id]);
  if (keyResult.rows.length === 0) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Key not found' } });
    return;
  }

  const provider = keyResult.rows[0].provider;
  const activeResult = await pool.query(
    `SELECT COUNT(*) AS cnt FROM api_keys WHERE provider = $1 AND is_active = true AND id != $2`,
    [provider, req.params.id],
  );

  if (parseInt(activeResult.rows[0].cnt) === 0) {
    res.status(422).json({
      error: { code: 'KEY_DELETE_LAST_ACTIVE', message: `Cannot delete the last active key for ${provider}` },
    });
    return;
  }

  await pool.query('DELETE FROM api_keys WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

// POST test key — auth required
router.post('/:id/test', authMiddleware, async (req, res) => {
  const keyResult = await pool.query(
    'SELECT provider, key_value, base_url FROM api_keys WHERE id = $1',
    [req.params.id],
  );

  if (keyResult.rows.length === 0) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Key not found' } });
    return;
  }

  const { provider, key_value, base_url } = keyResult.rows[0];

  const DEFAULT_URLS: Record<string, string> = {
    openai: 'https://api.openai.com',
    anthropic: 'https://api.anthropic.com',
    deepseek: 'https://api.deepseek.com',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    gemini: 'https://generativelanguage.googleapis.com',
  };

  const AUTH_HEADERS: Record<string, string> = {
    openai: 'authorization',
    anthropic: 'x-api-key',
    deepseek: 'authorization',
    zhipu: 'authorization',
    qwen: 'authorization',
    gemini: 'x-goog-api-key',
  };

  const base = base_url || DEFAULT_URLS[provider];
  const testUrl = provider === 'anthropic'
    ? `${base}/v1/messages`
    : provider === 'gemini'
      ? `${base}/v1beta/models/gemini-2.5-flash:generateContent`
      : `${base}/v1/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = AUTH_HEADERS[provider] || 'authorization';
  if (authHeader === 'authorization') {
    headers['authorization'] = `Bearer ${key_value}`;
  } else {
    headers[authHeader] = key_value;
  }

  // Minimal test body per provider
  const body = provider === 'anthropic'
    ? JSON.stringify({ model: 'claude-haiku-4-20250414', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] })
    : provider === 'gemini'
      ? JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] })
      : JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const upstream = await fetch(testUrl, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;

    if (upstream.ok) {
      res.json({ success: true, latency_ms: latency, message: 'Connection successful' });
    } else {
      const errText = await upstream.text().catch(() => '');
      res.json({ success: false, latency_ms: latency, message: `${upstream.status} ${upstream.statusText}${errText ? ': ' + errText.slice(0, 200) : ''}` });
    }
  } catch (err: unknown) {
    res.json({ success: false, latency_ms: Date.now() - start, message: (err as Error).message || 'Connection failed' });
  }
});

export default router;
