import type { CapturedUsage, Provider } from '../../types.js';
import { extractOpenAIUsage } from './openai.js';
import { extractAnthropicUsage } from './anthropic.js';
import { extractGeminiUsage } from './gemini.js';

export function extractUsageByProvider(
  json: Record<string, unknown>,
  provider: Provider,
): CapturedUsage | null {
  switch (provider) {
    case 'anthropic':
      return extractAnthropicUsage(json);
    case 'gemini':
      return extractGeminiUsage(json);
    default:
      // openai / deepseek / zhipu / qwen — all OpenAI-compatible
      return extractOpenAIUsage(json);
  }
}
