import { Router } from 'express';
import pool from '../../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { refreshPricingCache } from '../../core/pricing.js';
import type { ModelPricing } from '../types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// GET all pricing — public
router.get('/pricing', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, provider, model, input_price, output_price,
       cache_read_price, cache_write_price, is_active, updated_at
    FROM model_pricing
    ORDER BY provider, model`,
  );

  const pricing: ModelPricing[] = result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    provider: r.provider as string,
    model: r.model as string,
    input_price: Number(r.input_price),
    output_price: Number(r.output_price),
    cache_read_price: Number(r.cache_read_price),
    cache_write_price: Number(r.cache_write_price),
    is_active: Boolean(r.is_active),
    updated_at: (r.updated_at as Date).toISOString(),
  }));

  res.json({ pricing });
});

// GET single pricing — public
router.get('/pricing/:id', async (req, res) => {
  const result = await pool.query(
    `SELECT id, provider, model, input_price, output_price,
       cache_read_price, cache_write_price, is_active, updated_at
    FROM model_pricing WHERE id = $1`,
    [req.params.id],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: { code: 'MODEL_PRICING_NOT_FOUND', message: 'Pricing not found' } });
    return;
  }

  const r = result.rows[0];
  res.json({
    id: r.id,
    provider: r.provider,
    model: r.model,
    input_price: Number(r.input_price),
    output_price: Number(r.output_price),
    cache_read_price: Number(r.cache_read_price),
    cache_write_price: Number(r.cache_write_price),
    is_active: Boolean(r.is_active),
    updated_at: (r.updated_at as Date).toISOString(),
  });
});

// PUT update pricing — auth required
router.put('/pricing/:id', authMiddleware, async (req, res) => {
  const { input_price, output_price, cache_read_price, cache_write_price, is_active } = req.body;

  const fields: string[] = [];
  const params: (string | number | boolean)[] = [req.params.id as string];
  let idx = 2;

  if (input_price !== undefined) { params.push(Number(input_price)); fields.push(`input_price = $${idx++}`); }
  if (output_price !== undefined) { params.push(Number(output_price)); fields.push(`output_price = $${idx++}`); }
  if (cache_read_price !== undefined) { params.push(Number(cache_read_price)); fields.push(`cache_read_price = $${idx++}`); }
  if (cache_write_price !== undefined) { params.push(Number(cache_write_price)); fields.push(`cache_write_price = $${idx++}`); }
  if (is_active !== undefined) { params.push(Boolean(is_active)); fields.push(`is_active = $${idx++}`); }

  if (fields.length === 0) {
    res.status(400).json({ error: { code: 'NO_FIELDS', message: 'No fields to update' } });
    return;
  }

  fields.push('updated_at = NOW()');

  const result = await pool.query(
    `UPDATE model_pricing SET ${fields.join(', ')} WHERE id = $1
     RETURNING id, provider, model, input_price, output_price, cache_read_price, cache_write_price, is_active, updated_at`,
    params,
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: { code: 'MODEL_PRICING_NOT_FOUND', message: 'Pricing not found' } });
    return;
  }

  await refreshPricingCache();

  const r = result.rows[0];
  res.json({
    id: r.id,
    provider: r.provider,
    model: r.model,
    input_price: Number(r.input_price),
    output_price: Number(r.output_price),
    cache_read_price: Number(r.cache_read_price),
    cache_write_price: Number(r.cache_write_price),
    is_active: Boolean(r.is_active),
    updated_at: (r.updated_at as Date).toISOString(),
  });
});

// POST create pricing — auth required
router.post('/pricing', authMiddleware, async (req, res) => {
  const { provider, model, input_price, output_price, cache_read_price, cache_write_price } = req.body;

  if (!provider || !model || input_price === undefined || output_price === undefined) {
    res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'provider, model, input_price, output_price are required' } });
    return;
  }

  const result = await pool.query(
    `INSERT INTO model_pricing (provider, model, input_price, output_price, cache_read_price, cache_write_price)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (provider, model) DO UPDATE SET
       input_price = EXCLUDED.input_price,
       output_price = EXCLUDED.output_price,
       cache_read_price = EXCLUDED.cache_read_price,
       cache_write_price = EXCLUDED.cache_write_price,
       updated_at = NOW()
     RETURNING id, provider, model, input_price, output_price, cache_read_price, cache_write_price, is_active, updated_at`,
    [provider, model, Number(input_price), Number(output_price), Number(cache_read_price || 0), Number(cache_write_price || 0)],
  );

  await refreshPricingCache();

  const r = result.rows[0];
  res.status(201).json({
    id: r.id,
    provider: r.provider,
    model: r.model,
    input_price: Number(r.input_price),
    output_price: Number(r.output_price),
    cache_read_price: Number(r.cache_read_price),
    cache_write_price: Number(r.cache_write_price),
    is_active: Boolean(r.is_active),
    updated_at: (r.updated_at as Date).toISOString(),
  });
});

// POST refresh from pricing.json — auth required
router.post('/pricing/refresh', authMiddleware, async (_req, res) => {
  const pricingPath = path.join(__dirname, '..', '..', 'db', 'pricing.json');

  if (!fs.existsSync(pricingPath)) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'pricing.json not found' } });
    return;
  }

  const data = JSON.parse(fs.readFileSync(pricingPath, 'utf8'));
  let updated = 0;
  let inserted = 0;

  for (const [provider, models] of Object.entries(data) as [string, Record<string, { input: number; output: number; cache_read?: number; cache_write?: number }>][]) {
    for (const [model, prices] of Object.entries(models)) {
      const result = await pool.query(
        `INSERT INTO model_pricing (provider, model, input_price, output_price, cache_read_price, cache_write_price)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (provider, model) DO UPDATE SET
           input_price = EXCLUDED.input_price,
           output_price = EXCLUDED.output_price,
           cache_read_price = EXCLUDED.cache_read_price,
           cache_write_price = EXCLUDED.cache_write_price,
           updated_at = NOW()
         RETURNING (xmax = 0) AS is_inserted`,
        [provider, model, prices.input, prices.output, prices.cache_read || 0, prices.cache_write || 0],
      );

      if (result.rows[0]?.is_inserted) {
        inserted++;
      } else {
        updated++;
      }
    }
  }

  await refreshPricingCache();

  res.json({ message: 'Pricing refreshed', updated, inserted });
});

export default router;
