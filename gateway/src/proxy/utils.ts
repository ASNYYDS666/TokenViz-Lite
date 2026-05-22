import { v4 as uuidv4 } from 'uuid';
import type { FastifyRequest } from 'fastify';

export function generateRequestId(): string {
  return uuidv4();
}

export function extractEndpoint(url: string): string {
  const pathname = url.split('?')[0];
  const parts = pathname.split('/');
  // Extract meaningful endpoint: /v1/chat/completions, /v1/messages, /v1beta/models/...:generateContent
  if (pathname.includes('/v1beta/')) {
    const idx = parts.indexOf('v1beta');
    const modelAction = parts.slice(idx + 1).join('/');
    return `/v1beta/${modelAction}`;
  }
  if (pathname.includes('/v1/')) {
    const idx = parts.indexOf('v1');
    return '/' + parts.slice(idx).join('/');
  }
  return pathname;
}

export function isStreamingRequest(request: FastifyRequest): boolean {
  const body = request.body as Record<string, unknown> | undefined;
  return body?.stream === true;
}
