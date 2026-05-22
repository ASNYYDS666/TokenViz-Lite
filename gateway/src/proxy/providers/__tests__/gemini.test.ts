import { describe, it, expect } from 'vitest';
import { extractGeminiUsage } from '../gemini.js';

describe('extractGeminiUsage', () => {
  it('非流式：标准响应（无缓存）', () => {
    const json = {
      candidates: [{ content: { parts: [{ text: 'Hello' }] }, finishReason: 'STOP' }],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
        totalTokenCount: 150,
        cachedContentTokenCount: 0,
      },
    };

    const result = extractGeminiUsage(json);
    expect(result).not.toBeNull();
    expect(result!.prompt_tokens).toBe(100);
    expect(result!.completion_tokens).toBe(50);
    expect(result!.total_tokens).toBe(150);
    expect(result!.cache_read_tokens).toBe(0);
    expect(result!.cache_creation_tokens).toBe(0);
  });

  it('关键：promptTokenCount 含缓存 → 必须减掉 cachedContentTokenCount', () => {
    // 这是 Geminiextractor 最重要的测试
    // 参考 Sub2API stream_transformer.go L112-L118
    const json = {
      usageMetadata: {
        promptTokenCount: 120,       // 120 = 100(实际输入) + 20(缓存命中)
        candidatesTokenCount: 50,
        totalTokenCount: 170,
        cachedContentTokenCount: 20,  // 缓存命中了 20 个 token
      },
    };

    const result = extractGeminiUsage(json);
    expect(result).not.toBeNull();
    // 核心断言：prompt_tokens = 120 - 20 = 100
    expect(result!.prompt_tokens).toBe(100);
    expect(result!.completion_tokens).toBe(50);
    expect(result!.cache_read_tokens).toBe(20);
    expect(result!.cache_creation_tokens).toBe(0);
  });

  it('缓存全部命中 → prompt_tokens = 0', () => {
    const json = {
      usageMetadata: {
        promptTokenCount: 50,
        candidatesTokenCount: 10,
        totalTokenCount: 60,
        cachedContentTokenCount: 50,
      },
    };

    const result = extractGeminiUsage(json);
    expect(result!.prompt_tokens).toBe(0);
    expect(result!.completion_tokens).toBe(10);
    expect(result!.cache_read_tokens).toBe(50);
  });

  it('无 usageMetadata → 返回 null', () => {
    const json = {
      candidates: [{ content: { parts: [{ text: 'x' }] } }],
    };
    expect(extractGeminiUsage(json)).toBeNull();
  });

  it('usageMetadata 缺少字段时不崩溃（?? 兜底）', () => {
    const json = { usageMetadata: {} };
    const result = extractGeminiUsage(json);
    expect(result).not.toBeNull();
    expect(result!.prompt_tokens).toBe(0);
    expect(result!.completion_tokens).toBe(0);
    expect(result!.total_tokens).toBe(0);
    expect(result!.cache_read_tokens).toBe(0);
  });

  it('promptTokenCount 小于 cachedContentTokenCount（极端情况）不崩溃', () => {
    const json = {
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
        cachedContentTokenCount: 20,  // 缓存比实际输入还大
      },
    };
    const result = extractGeminiUsage(json);
    expect(result!.prompt_tokens).toBe(-10); // 极端情况，不会崩溃
  });
});
