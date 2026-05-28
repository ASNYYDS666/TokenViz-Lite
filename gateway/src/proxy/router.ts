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

// model → provider cache, refreshed periodically
const modelProviderMap = new Map<string, Provider>();

export async function refreshModelProviderMap(): Promise<void> {
  const result = await pool.query(
    `SELECT model, provider FROM model_pricing WHERE is_active = true`,
  );
  modelProviderMap.clear();
  for (const row of result.rows) {
    modelProviderMap.set(row.model, row.provider as Provider);
  }
}

// Initialize on load
refreshModelProviderMap().catch(() => {});
// Refresh every 5 minutes
setInterval(() => refreshModelProviderMap().catch(() => {}), 5 * 60_000);

function detectProviderByUrl(url: string): Provider {
  if (url.includes('/v1/messages')) return 'anthropic';
  if (url.includes('/v1beta/')) return 'gemini';
  return 'openai';
}

function detectProviderByModel(model: unknown, urlProvider: Provider): Provider {
  // Model-based routing only for OpenAI-compatible URLs.
  // Anthropic and Gemini have unique URL patterns — keep them as-is.
  if (urlProvider !== 'openai') return urlProvider;
  if (typeof model !== 'string' || !model) return urlProvider;

  // Check model→provider map from model_pricing table
  const mapped = modelProviderMap.get(model);
  if (mapped) return mapped;

  // Heuristic: model name prefixes
  const m = model.toLowerCase();
  if (m.startsWith('deepseek')) return 'deepseek';
  if (m.includes('glm')) return 'zhipu';
  if (m.startsWith('qwen')) return 'qwen';

  return urlProvider;
}

export function detectProvider(req: FastifyRequest, model?: unknown): Provider {
  const override = req.headers['x-tokenviz-provider'] as string | undefined;
  if (override) return override as Provider;

  const urlProvider = detectProviderByUrl(req.url);
  return detectProviderByModel(model, urlProvider);
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
