import pool from '../db/connection.js';
import type { CapturedUsage, UsageRecord } from '../types.js';
import { calculateCost } from './pricing.js';

export async function recordUsage(
  record: UsageRecord,
  usage: CapturedUsage | null,
): Promise<void> {
  try {
    const costs = usage
      ? await calculateCost(record.provider, record.model, usage)
      : null;

    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = promptTokens + completionTokens;

    await pool.query(
      `INSERT INTO usage_logs (
        request_id, provider, model,
        prompt_tokens, completion_tokens, total_tokens,
        cache_read_tokens, cache_creation_tokens,
        cache_creation_5m_tokens, cache_creation_1h_tokens,
        input_cost, output_cost, total_cost,
        api_key_id, endpoint, is_streaming, status_code,
        latency_ms, first_token_ms, user_agent, usage_captured
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        record.request_id,
        record.provider,
        record.model,
        promptTokens,
        completionTokens,
        totalTokens,
        usage?.cache_read_tokens ?? 0,
        usage?.cache_creation_tokens ?? 0,
        usage?.cache_creation_5m_tokens ?? 0,
        usage?.cache_creation_1h_tokens ?? 0,
        costs?.input_cost ?? 0,
        costs?.output_cost ?? 0,
        costs?.total_cost ?? 0,
        record.api_key_id,
        record.endpoint,
        record.is_streaming,
        record.status_code,
        record.latency_ms,
        record.first_token_ms,
        record.user_agent,
        usage !== null,
      ],
    );
  } catch (err) {
    console.error('[recorder] failed to write usage:', err);
  }
}
