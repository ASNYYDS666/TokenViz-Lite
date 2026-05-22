import type { CapturedUsage } from '../../types.js';

/**
 * OpenAI 兼容格式 usage 提取
 *
 * 覆盖厂商：OpenAI / DeepSeek / 智谱 / 通义
 *
 * OpenAI 字段：usage.prompt_tokens, usage.completion_tokens, usage.total_tokens
 *               usage.prompt_tokens_details.cached_tokens
 * DeepSeek 字段：usage.prompt_cache_hit_tokens, usage.prompt_cache_miss_tokens
 *                （在 usage 层级，和 prompt_tokens 平级）
 */
export function extractOpenAIUsage(json: Record<string, unknown>): CapturedUsage | null {
  const u = json.usage as Record<string, unknown> | undefined;
  if (!u) return null;

  const hasDeepSeekCache =
    u.prompt_cache_hit_tokens !== undefined ||
    u.prompt_cache_miss_tokens !== undefined;

  const details = u.prompt_tokens_details as Record<string, unknown> | undefined;

  return {
    prompt_tokens: (u.prompt_tokens as number) ?? 0,
    completion_tokens: (u.completion_tokens as number) ?? 0,
    total_tokens: (u.total_tokens as number) ?? 0,
    cache_read_tokens: hasDeepSeekCache
      ? ((u.prompt_cache_hit_tokens as number) ?? 0)
      : ((details?.cached_tokens as number) ?? 0),
    cache_creation_tokens: hasDeepSeekCache
      ? ((u.prompt_cache_miss_tokens as number) ?? 0)
      : 0,
    cache_creation_5m_tokens: 0,
    cache_creation_1h_tokens: 0,
  };
}
