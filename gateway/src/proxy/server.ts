import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { detectProvider, buildUpstreamContext } from './router.js';
import { recordUsage } from '../core/recorder.js';
import { handleStreaming } from './streaming.js';
import { extractUsageByProvider } from './providers/index.js';
import { generateRequestId, extractEndpoint, isStreamingRequest } from './utils.js';

const app = Fastify({ logger: true });

const HEADERS_TO_STRIP = [
  'host', 'connection', 'transfer-encoding', 'keep-alive', 'te', 'trailer',
  'content-length', 'content-encoding',
];

function buildCleanHeaders(
  request: FastifyRequest,
  ctx: { upstreamUrl: string; apiKey: string; authHeader: string },
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (!HEADERS_TO_STRIP.includes(key.toLowerCase()) && value) {
      clean[key] = Array.isArray(value) ? value[0] : value;
    }
  }
  delete clean['authorization'];
  delete clean['x-api-key'];
  delete clean['x-goog-api-key'];
  if (ctx.authHeader === 'authorization') {
    clean['authorization'] = `Bearer ${ctx.apiKey}`;
  } else {
    clean[ctx.authHeader] = ctx.apiKey;
  }
  clean['host'] = new URL(ctx.upstreamUrl).host;
  return clean;
}

export async function startProxy(port: number = 3100) {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[proxy] listening on :${port}`);
}

export default app;

app.route({
  method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  url: '/v1/*',
  handler: async (request, reply) => {
    const startTime = Date.now();
    const body = (request.body || {}) as Record<string, unknown>;
    const provider = detectProvider(request, body.model);
    const ctx = await buildUpstreamContext(provider, request.url);
    const cleanHeaders = buildCleanHeaders(request, ctx);

    // ─── 流式请求 ───
    if (isStreamingRequest(request)) {
      const streamingBody = { ...body };
      if (provider !== 'anthropic' && provider !== 'gemini' && !streamingBody.stream_options) {
        streamingBody.stream_options = { include_usage: true };
      }

      const upstream = await fetch(ctx.upstreamUrl, {
        method: 'POST',
        headers: cleanHeaders,
        body: JSON.stringify(streamingBody),
      });

      await handleStreaming(
        upstream,
        reply.raw,
        provider,
        (streamingBody.model as string) || '',
        startTime,
        (usage, ttft) => {
          recordUsage({
            request_id: generateRequestId(),
            provider,
            model: (streamingBody.model as string) || '',
            is_streaming: true,
            status_code: upstream.status,
            latency_ms: Date.now() - startTime,
            first_token_ms: ttft,
            user_agent: (request.headers['user-agent'] as string) ?? null,
            endpoint: extractEndpoint(request.url),
            api_key_id: ctx.keyId,
            usage_captured: usage !== null,
          }, usage).catch(err => app.log.error({ err }, 'recordUsage failed'));
        },
      );
      return;
    }

    // ─── 非流式请求 ───
    const upstream = await fetch(ctx.upstreamUrl, {
      method: request.method,
      headers: cleanHeaders,
      body: request.method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    for (const [key, value] of upstream.headers.entries()) {
      if (!HEADERS_TO_STRIP.includes(key.toLowerCase())) {
        reply.header(key, value);
      }
    }
    reply.status(upstream.status);

    if (!upstream.ok) {
      app.log.info({ provider, status: upstream.status }, 'upstream error');
      recordUsage({
        request_id: generateRequestId(),
        provider,
        model: (body.model as string) || '',
        is_streaming: false,
        status_code: upstream.status,
        latency_ms: Date.now() - startTime,
        first_token_ms: null,
        user_agent: (request.headers['user-agent'] as string) ?? null,
        endpoint: extractEndpoint(request.url),
        api_key_id: ctx.keyId,
        usage_captured: false,
      }, null).catch(err => app.log.error({ err }, 'recordUsage failed'));
      return upstream.body;
    }

    const responseBody = await upstream.json() as Record<string, unknown>;
    const usage = extractUsageByProvider(responseBody, provider);

    recordUsage({
      request_id: generateRequestId(),
      provider,
      model: (responseBody.model as string) || (body.model as string) || '',
      is_streaming: false,
      status_code: upstream.status,
      latency_ms: Date.now() - startTime,
      first_token_ms: null,
      user_agent: (request.headers['user-agent'] as string) ?? null,
      endpoint: extractEndpoint(request.url),
      api_key_id: ctx.keyId,
      usage_captured: usage !== null,
    }, usage).catch(err => app.log.error({ err }, 'recordUsage failed'));

    return responseBody;
  },
});
