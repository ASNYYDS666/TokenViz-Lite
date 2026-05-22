import { describe, it, expect } from 'vitest';
import { extractAnthropicUsage } from '../anthropic.js';

describe('extractAnthropicUsage', () => {
  it('非流式：直接从 response.usage 提取全部字段', () => {
    const json = {
      id: 'msg_xxx',
      model: 'claude-sonnet-4-20250514',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 20,
        cache_creation_input_tokens: 10,
      },
    };

    const result = extractAnthropicUsage(json);
    expect(result).not.toBeNull();
    expect(result!.prompt_tokens).toBe(100);
    expect(result!.completion_tokens).toBe(50);
    expect(result!.total_tokens).toBe(150);
    expect(result!.cache_read_tokens).toBe(20);
    expect(result!.cache_creation_tokens).toBe(10);
  });

  it('流式：message_start 事件提取 input_tokens + cache', () => {
    const json = {
      type: 'message_start',
      message: {
        id: 'msg_xxx',
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 200,
          cache_read_input_tokens: 50,
          cache_creation_input_tokens: 30,
        },
      },
    };

    const result = extractAnthropicUsage(json);
    expect(result).not.toBeNull();
    expect(result!.prompt_tokens).toBe(200);
    expect(result!.completion_tokens).toBe(0);  // message_start 阶段没有 output
    expect(result!.cache_read_tokens).toBe(50);
    expect(result!.cache_creation_tokens).toBe(30);
  });

  it('流式：message_delta 事件提取 output_tokens', () => {
    const json = {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 80 },
    };

    const result = extractAnthropicUsage(json);
    expect(result).not.toBeNull();
    expect(result!.prompt_tokens).toBe(0);
    expect(result!.completion_tokens).toBe(80);
    expect(result!.cache_read_tokens).toBe(0);
    expect(result!.cache_creation_tokens).toBe(0);
  });

  it('流式合并：message_start + message_delta 相加得到完整 usage', () => {
    const msgStart = {
      type: 'message_start',
      message: { usage: { input_tokens: 200, cache_read_input_tokens: 50, cache_creation_input_tokens: 10 } },
    };
    const msgDelta = {
      type: 'message_delta',
      usage: { output_tokens: 80 },
    };

    const first = extractAnthropicUsage(msgStart);
    const second = extractAnthropicUsage(msgDelta);

    // 模拟 streaming.ts 中的相加合并逻辑
    const merged = {
      prompt_tokens: first!.prompt_tokens + second!.prompt_tokens,
      completion_tokens: first!.completion_tokens + second!.completion_tokens,
      total_tokens: first!.total_tokens + second!.total_tokens,
      cache_read_tokens: first!.cache_read_tokens + second!.cache_read_tokens,
      cache_creation_tokens: first!.cache_creation_tokens + second!.cache_creation_tokens,
      cache_creation_5m_tokens: 0,
      cache_creation_1h_tokens: 0,
    };
    expect(merged.prompt_tokens).toBe(200);
    expect(merged.completion_tokens).toBe(80);
    expect(merged.cache_read_tokens).toBe(50);
    expect(merged.cache_creation_tokens).toBe(10);
  });

  it('content_block_delta 事件（无 usage）返回 null', () => {
    const json = {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hello' },
    };
    expect(extractAnthropicUsage(json)).toBeNull();
  });

  it('message_stop 事件（无 usage）返回 null', () => {
    const json = { type: 'message_stop' };
    expect(extractAnthropicUsage(json)).toBeNull();
  });

  it('ping 事件（无 type）返回 null', () => {
    const json = { ping: true };
    expect(extractAnthropicUsage(json)).toBeNull();
  });
});
