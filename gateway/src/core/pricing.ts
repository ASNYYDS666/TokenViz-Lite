import pool from '../db/connection.js';
import type { CapturedUsage } from '../types.js';

interface PricingRow {
  input_price: number;
  output_price: number;
  cache_read_price: number;
  cache_write_price: number;
}

const MTok = 1_000_000;

const cache = new Map<string, PricingRow>();

export async function refreshPricingCache(): Promise<void> {
  const result = await pool.query(
    `SELECT provider, model, input_price, output_price, cache_read_price, cache_write_price
     FROM model_pricing WHERE is_active = true`,
  );
  cache.clear();
  for (const row of result.rows) {
    cache.set(`${row.provider}:${row.model}`, {
      input_price: Number(row.input_price),
      output_price: Number(row.output_price),
      cache_read_price: Number(row.cache_read_price),
      cache_write_price: Number(row.cache_write_price),
    });
  }
}

async function getPricing(provider: string, model: string): Promise<PricingRow | null> {
  const key = `${provider}:${model}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const result = await pool.query(
    `SELECT input_price, output_price, cache_read_price, cache_write_price
     FROM model_pricing WHERE provider = $1 AND model = $2 AND is_active = true`,
    [provider, model],
  );
  if (result.rows.length === 0) return null;

  const row = {
    input_price: Number(result.rows[0].input_price),
    output_price: Number(result.rows[0].output_price),
    cache_read_price: Number(result.rows[0].cache_read_price),
    cache_write_price: Number(result.rows[0].cache_write_price),
  };
  cache.set(key, row);
  return row;
}

export async function calculateCost(
  provider: string,
  model: string,
  usage: CapturedUsage,
): Promise<{ input_cost: number; output_cost: number; total_cost: number }> {
  const pricing = await getPricing(provider, model);
  if (!pricing) return { input_cost: 0, output_cost: 0, total_cost: 0 };

  const input_cost =
    (usage.prompt_tokens * pricing.input_price) / MTok +
    (usage.cache_creation_tokens * pricing.cache_write_price) / MTok +
    (usage.cache_read_tokens * pricing.cache_read_price) / MTok;

  const output_cost = (usage.completion_tokens * pricing.output_price) / MTok;

  return {
    input_cost: Number(input_cost.toFixed(8)),
    output_cost: Number(output_cost.toFixed(8)),
    total_cost: Number((input_cost + output_cost).toFixed(8)),
  };
}
