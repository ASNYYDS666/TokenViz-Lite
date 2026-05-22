import { describe, it, expect } from 'vitest';
import { extractUsageByProvider } from '../index.js';

describe('extractUsageByProvider 分发', () => {
  const openAIJson = { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };

  it('openai → extractOpenAIUsage', () => {
    const r = extractUsageByProvider(openAIJson, 'openai');
    expect(r!.prompt_tokens).toBe(10);
    expect(r!.completion_tokens).toBe(5);
  });

  it('deepseek → extractOpenAIUsage（兼容格式）', () => {
    const r = extractUsageByProvider(openAIJson, 'deepseek');
    expect(r!.prompt_tokens).toBe(10);
  });

  it('zhipu → extractOpenAIUsage（兼容格式）', () => {
    const r = extractUsageByProvider(openAIJson, 'zhipu');
    expect(r!.prompt_tokens).toBe(10);
  });

  it('qwen → extractOpenAIUsage（兼容格式）', () => {
    const r = extractUsageByProvider(openAIJson, 'qwen');
    expect(r!.prompt_tokens).toBe(10);
  });

  it('anthropic → extractAnthropicUsage', () => {
    const json = { type: 'message', usage: { input_tokens: 20, output_tokens: 10 } };
    const r = extractUsageByProvider(json, 'anthropic');
    expect(r!.prompt_tokens).toBe(20);
    expect(r!.completion_tokens).toBe(10);
  });

  it('gemini → extractGeminiUsage', () => {
    const json = { usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 15, cachedContentTokenCount: 0 } };
    const r = extractUsageByProvider(json, 'gemini');
    expect(r!.prompt_tokens).toBe(30);
  });

  it('无 usage 数据返回 null', () => {
    expect(extractUsageByProvider({}, 'openai')).toBeNull();
    expect(extractUsageByProvider({}, 'anthropic')).toBeNull();
    expect(extractUsageByProvider({}, 'gemini')).toBeNull();
  });
});
