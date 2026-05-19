import Fastify from 'fastify';
import { detectProvider, buildUpstreamContext } from './router.js';

const app = Fastify({ logger: true });

const HEADERS_TO_STRIP = [
  'host', 'connection', 'transfer-encoding', 'keep-alive', 'te', 'trailer',
  'content-length', 'content-encoding',
];

app.route({
  method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  url: '/v1/*',
  handler: async (request, reply) => {
    const provider = detectProvider(request);
    const ctx = await buildUpstreamContext(provider, request.url);

    const cleanHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (!HEADERS_TO_STRIP.includes(key.toLowerCase()) && value) {
        cleanHeaders[key] = Array.isArray(value) ? value[0] : value;
      }
    }
    cleanHeaders['authorization'] = `Bearer ${ctx.apiKey}`;
    cleanHeaders['host'] = new URL(ctx.upstreamUrl).host;

    const startTime = Date.now();

    const upstream = await fetch(ctx.upstreamUrl, {
      method: request.method,
      headers: cleanHeaders,
      body: request.method !== 'GET' ? JSON.stringify(request.body) : undefined,
    });

    for (const [key, value] of upstream.headers.entries()) {
      if (!HEADERS_TO_STRIP.includes(key.toLowerCase())) {
        reply.header(key, value);
      }
    }
    reply.status(upstream.status);

    const latency = Date.now() - startTime;
    app.log.info({ provider, status: upstream.status, latency_ms: latency }, 'request proxied');

    return upstream.body;
  },
});

export async function startProxy(port: number = 3100) {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[proxy] listening on :${port}`);
}

export default app;
