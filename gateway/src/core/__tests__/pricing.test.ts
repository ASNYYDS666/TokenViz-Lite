import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { calculateCost, refreshPricingCache } from '../pricing.js';
import pool from '../../db/connection.js';

beforeAll(async () => {
  // 确保 model_pricing 有测试数据
  await pool.query(`
    INSERT INTO model_pricing (provider, model, input_price, output_price, cache_read_price, cache_write_price)
    VALUES ('openai', 'gpt-4o-mini', 0.15, 0.60, 0.075, 0.15)
    ON CONFLICT (provider, model) DO UPDATE SET
      input_price = 0.15, output_price = 0.60, cache_read_price = 0.075, cache_write_price = 0.15
  `);
  await refreshPricingCache();
});

afterAll(async () => {
  await pool.end();
});

describe('calculateCost', () => {
  it('已知模型 → 正确计算成本', async () => {
    const usage = {
      prompt_tokens: 1_000_000,
      completion_tokens: 500_000,
      total_tokens: 1_500_000,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cache_creation_5m_tokens: 0,
      cache_creation_1h_tokens: 0,
    };

    const cost = await calculateCost('openai', 'gpt-4o-mini', usage);
    // input: 1M * 0.15 = $0.15
    // output: 0.5M * 0.60 = $0.30
    // total: $0.45
    expect(cost.input_cost).toBeCloseTo(0.15, 4);
    expect(cost.output_cost).toBeCloseTo(0.30, 4);
    expect(cost.total_cost).toBeCloseTo(0.45, 4);
  });

  it('包含 cache_read → 按 cache_read_price 计算并计入 input_cost', async () => {
    const usage = {
      prompt_tokens: 1_000_000,
      completion_tokens: 0,
      total_tokens: 1_000_000,
      cache_read_tokens: 500_000,
      cache_creation_tokens: 0,
      cache_creation_5m_tokens: 0,
      cache_creation_1h_tokens: 0,
    };

    const cost = await calculateCost('openai', 'gpt-4o-mini', usage);
    // input: 1M * 0.15 = $0.15
    // cache_read: 0.5M * 0.075 = $0.0375
    // input_cost = 0.15 + 0.0375 = 0.1875
    expect(cost.input_cost).toBeCloseTo(0.1875, 4);
    expect(cost.output_cost).toBe(0);
  });

  it('包含 cache_write → 按 cache_write_price 计算', async () => {
    const usage = {
      prompt_tokens: 1_000_000,
      completion_tokens: 0,
      total_tokens: 1_000_000,
      cache_read_tokens: 0,
      cache_creation_tokens: 200_000,
      cache_creation_5m_tokens: 0,
      cache_creation_1h_tokens: 0,
    };

    const cost = await calculateCost('openai', 'gpt-4o-mini', usage);
    // input: 1M * 0.15 = $0.15
    // cache_write: 0.2M * 0.15 = $0.03
    // input_cost = 0.15 + 0.03 = 0.18
    expect(cost.input_cost).toBeCloseTo(0.18, 4);
  });

  it('未知模型 → 返回全 0（不抛异常）', async () => {
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cache_creation_5m_tokens: 0,
      cache_creation_1h_tokens: 0,
    };

    const cost = await calculateCost('unknown-provider', 'unknown-model', usage);
    expect(cost.input_cost).toBe(0);
    expect(cost.output_cost).toBe(0);
    expect(cost.total_cost).toBe(0);
  });

  it('0 token → 成本为 0', async () => {
    const usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cache_creation_5m_tokens: 0,
      cache_creation_1h_tokens: 0,
    };

    const cost = await calculateCost('openai', 'gpt-4o-mini', usage);
    expect(cost.total_cost).toBe(0);
  });
});
