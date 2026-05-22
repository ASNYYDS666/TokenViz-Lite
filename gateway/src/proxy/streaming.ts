import { ServerResponse } from 'http';
import type { CapturedUsage, Provider } from '../types.js';
import { extractUsageByProvider } from './providers/index.js';

/**
 * 流式请求处理：逐 chunk 转发 + 尾捕获 usage
 *
 * 核心策略：
 *   1. 每个 chunk 立刻 write 给客户端（零延迟，转发优先）
 *   2. 顺手 peek data: 行中的 JSON，尝试提取 usage
 *   3. try-catch 保证解析失败不影响转发
 *   4. 缓冲跨 chunk 的不完整行
 *   5. 流结束后回调 onEnd 写库
 *
 * 参考：Sub2API backend/internal/pkg/antigravity/stream_transformer.go L76-L148
 */
export async function handleStreaming(
  upstream: Response,
  clientRes: ServerResponse,
  provider: Provider,
  model: string,
  startTime: number,
  onEnd: (usage: CapturedUsage | null, ttft: number | null) => void,
): Promise<void> {
  clientRes.writeHead(upstream.status, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let capturedUsage: CapturedUsage | null = null;
  let firstTokenTime: number | null = null;
  const decoder = new TextDecoder();
  let buffer = '';

  const body = upstream.body as AsyncIterable<Uint8Array> | null;
  if (!body) {
    clientRes.end();
    onEnd(null, null);
    return;
  }

  for await (const chunk of body) {
    clientRes.write(chunk);
    if (!firstTokenTime) firstTokenTime = Date.now();

    const text = buffer + decoder.decode(chunk, { stream: true });
    const lines = text.split('\n');
    buffer = lines[lines.length - 1];

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]' || payload === '') continue;

      try {
        const json = JSON.parse(payload) as Record<string, unknown>;
        const partial = extractUsageByProvider(json, provider);
        if (partial) {
          if (capturedUsage) {
            // 相加而非覆盖：Anthropic 的 message_start(input+cache) + message_delta(output)
            capturedUsage = {
              prompt_tokens: capturedUsage.prompt_tokens + partial.prompt_tokens,
              completion_tokens: capturedUsage.completion_tokens + partial.completion_tokens,
              total_tokens: capturedUsage.total_tokens + partial.total_tokens,
              cache_read_tokens: capturedUsage.cache_read_tokens + partial.cache_read_tokens,
              cache_creation_tokens: capturedUsage.cache_creation_tokens + partial.cache_creation_tokens,
              cache_creation_5m_tokens: capturedUsage.cache_creation_5m_tokens + partial.cache_creation_5m_tokens,
              cache_creation_1h_tokens: capturedUsage.cache_creation_1h_tokens + partial.cache_creation_1h_tokens,
            };
          } else {
            capturedUsage = partial;
          }
        }
      } catch {
        // 解析失败不影响转发
      }
    }
  }

  clientRes.end();

  const ttft = firstTokenTime ? firstTokenTime - startTime : null;
  onEnd(capturedUsage, ttft);
}
