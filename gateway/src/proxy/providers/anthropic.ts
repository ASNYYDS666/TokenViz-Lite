import type { CapturedUsage } from '../../types.js';

/**
 * Anthropic Messages API usage 提取
 *
 * 非流式：response.usage 包含全部字段 (input_tokens, output_tokens,
 *         cache_read_input_tokens, cache_creation_input_tokens)
 * 流式：  message_start 事件 → message.usage (input_tokens + cache)
 *         message_delta 事件 → usage (output_tokens)
 *         两次结果在 handleStreaming 中通过 spread 合并
 *
 * 参考：Sub2API backend/internal/pkg/apicompat/types.go L126-L141
 */
export function extractAnthropicUsage(json: Record<string, unknown>): CapturedUsage | null {
  // 非流式：type === 'message' 且顶层有 usage
  const topUsage = json.usage as Record<string, unknown> | undefined;
  if (topUsage && json.type === 'message') {
    return {
      prompt_tokens: (topUsage.input_tokens as number) ?? 0,
      completion_tokens: (topUsage.output_tokens as number) ?? 0,
      total_tokens:
        ((topUsage.input_tokens as number) ?? 0) + ((topUsage.output_tokens as number) ?? 0),
      cache_read_tokens: (topUsage.cache_read_input_tokens as number) ?? 0,
      cache_creation_tokens: (topUsage.cache_creation_input_tokens as number) ?? 0,
      cache_creation_5m_tokens: 0,
      cache_creation_1h_tokens: 0,
    };
  }

  // 流式：message_start 事件 → input_tokens + cache
  if (json.type === 'message_start') {
    const msg = json.message as Record<string, unknown> | undefined;
    const mu = msg?.usage as Record<string, unknown> | undefined;
    if (mu) {
      return {
        prompt_tokens: (mu.input_tokens as number) ?? 0,
        completion_tokens: 0,
        total_tokens: (mu.input_tokens as number) ?? 0,
        cache_read_tokens: (mu.cache_read_input_tokens as number) ?? 0,
        cache_creation_tokens: (mu.cache_creation_input_tokens as number) ?? 0,
        cache_creation_5m_tokens: 0,
        cache_creation_1h_tokens: 0,
      };
    }
  }

  // 流式：message_delta 事件 → output_tokens
  if (json.type === 'message_delta') {
    const du = json.usage as Record<string, unknown> | undefined;
    if (du) {
      return {
        prompt_tokens: 0,
        completion_tokens: (du.output_tokens as number) ?? 0,
        total_tokens: (du.output_tokens as number) ?? 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        cache_creation_5m_tokens: 0,
        cache_creation_1h_tokens: 0,
      };
    }
  }

  return null;
}
