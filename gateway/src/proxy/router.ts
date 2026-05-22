import type { FastifyRequest } from 'fastify';
import type { Provider, UpstreamContext } from '../types.js';
import pool from '../db/connection.js';

const DEFAULT_BASE_URLS: Record<string, string> = {
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

export function detectProvider(req: FastifyRequest): Provider {
  // 显式指定（用于多厂商路由或测试）
  const override = req.headers['x-tokenviz-provider'] as string | undefined;
  if (override) return override as Provider;

  const url = req.url;
  if (url.includes('/v1/messages')) return 'anthropic';
  if (url.includes('/v1beta/')) return 'gemini';
  return 'openai';
}

export async function buildUpstreamContext(
  provider: Provider,
  url: string,
): Promise<UpstreamContext> {
  const result = await pool.query(
    `SELECT id, key_value, base_url FROM api_keys
     WHERE provider = $1 AND is_active = true LIMIT 1`,
    [provider],
  );

  if (result.rows.length === 0) {
    throw new Error(`No active API key found for provider: ${provider}`);
  }

  const row = result.rows[0];
  const baseUrl = row.base_url || DEFAULT_BASE_URLS[provider];
  const upstreamUrl = baseUrl + url;

  return {
    provider,
    upstreamUrl,
    apiKey: row.key_value,
    keyId: row.id,
    authHeader: AUTH_HEADERS[provider],
  };
}
