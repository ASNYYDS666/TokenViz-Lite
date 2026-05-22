import { describe, it, expect } from 'vitest';
import { extractOpenAIUsage } from '../openai.js';

describe('extractOpenAIUsage', () => {
  it('提取标准 OpenAI 非流式响应', () => {
    const json = {
      id: 'chatcmpl-xxx',
      model: 'gpt-4o-2024-08-06',
      choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        prompt_tokens_details: { cached_tokens: 20 },
      },
    };

    const result = extractOpenAIUsage(json);
    expect(result).not.toBeNull();
    expect(result!.prompt_tokens).toBe(100);
    expect(result!.completion_tokens).toBe(50);
    expect(result!.total_tokens).toBe(150);
    expect(result!.cache_read_tokens).toBe(20);
    expect(result!.cache_creation_tokens).toBe(0);
  });

  it('提取 OpenAI 流式 usage chunk（带 stream_options）', () => {
    const json = {
      id: 'chatcmpl-xxx',
      choices: [{ delta: {}, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 80,
        completion_tokens: 30,
        total_tokens: 110,
        prompt_tokens_details: { cached_tokens: 0 },
      },
    };

    const result = extractOpenAIUsage(json);
    expect(result).not.toBeNull();
    expect(result!.prompt_tokens).toBe(80);
    expect(result!.completion_tokens).toBe(30);
    expect(result!.cache_read_tokens).toBe(0);
  });

  it('提取 DeepSeek 响应（prompt_cache_hit/miss 在 usage 层级）', () => {
    // 基于实测数据：deepseek-nonstream.json
    const json = {
      id: '3e685052-f57c-4b91-bfbb-f3dbf99f8cde',
      model: 'deepseek-v4-flash',
      choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 11,
        completion_tokens: 153,
        total_tokens: 164,
        prompt_tokens_details: { cached_tokens: 0 },
        prompt_cache_hit_tokens: 5,
        prompt_cache_miss_tokens: 6,
      },
    };

    const result = extractOpenAIUsage(json);
    expect(result).not.toBeNull();
    expect(result!.prompt_tokens).toBe(11);
    expect(result!.completion_tokens).toBe(153);
    // DeepSeek 字段优先级高于 OpenAI 字段
    expect(result!.cache_read_tokens).toBe(5);
    expect(result!.cache_creation_tokens).toBe(6);
  });

  it('DeepSeek 缓存全命中时 cache_miss 为 0', () => {
    const json = {
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        prompt_cache_hit_tokens: 10,
        prompt_cache_miss_tokens: 0,
      },
    };

    const result = extractOpenAIUsage(json);
    expect(result!.cache_read_tokens).toBe(10);
    expect(result!.cache_creation_tokens).toBe(0);
  });

  it('无 usage 字段返回 null', () => {
    const json = { id: 'no-usage', choices: [{ message: { content: 'x' } }] };
    expect(extractOpenAIUsage(json)).toBeNull();
  });

  it('usage 为空对象时不崩溃', () => {
    const json = { usage: {} };
    const result = extractOpenAIUsage(json);
    expect(result).not.toBeNull();
    expect(result!.prompt_tokens).toBe(0);
    expect(result!.completion_tokens).toBe(0);
    expect(result!.total_tokens).toBe(0);
    expect(result!.cache_read_tokens).toBe(0);
  });

  it('智谱/通义标准 OpenAI 格式（无 DeepSeek 字段）', () => {
    const json = {
      usage: {
        prompt_tokens: 50,
        completion_tokens: 30,
        total_tokens: 80,
        prompt_tokens_details: { cached_tokens: 10 },
      },
    };

    const result = extractOpenAIUsage(json);
    expect(result!.prompt_tokens).toBe(50);
    expect(result!.cache_read_tokens).toBe(10);
    expect(result!.cache_creation_tokens).toBe(0);
    // 确认没有误走到 DeepSeek 路径
  });
});
