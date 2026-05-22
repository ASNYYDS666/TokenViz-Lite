import type { CapturedUsage } from '../../types.js';

/**
 * Gemini API usage 提取
 *
 * 关键：promptTokenCount 包含 cachedContentTokenCount，必须减掉！
 * 否则 prompt_tokens 会多算缓存的 token 数，导致成本偏大。
 *
 * 参考：Sub2API backend/internal/pkg/antigravity/stream_transformer.go L112-L118
 */
export function extractGeminiUsage(json: Record<string, unknown>): CapturedUsage | null {
  const meta = json.usageMetadata as Record<string, unknown> | undefined;
  if (!meta) return null;

  const cached = (meta.cachedContentTokenCount as number) ?? 0;
  const prompt = (meta.promptTokenCount as number) ?? 0;

  return {
    prompt_tokens: prompt - cached,
    completion_tokens: (meta.candidatesTokenCount as number) ?? 0,
    total_tokens:
      (meta.promptTokenCount as number ?? 0) +
      (meta.candidatesTokenCount as number ?? 0),
    cache_read_tokens: cached,
    cache_creation_tokens: 0,
    cache_creation_5m_tokens: 0,
    cache_creation_1h_tokens: 0,
  };
}
