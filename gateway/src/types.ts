export type Provider = 'openai' | 'anthropic' | 'deepseek' | 'zhipu' | 'qwen' | 'gemini';

export interface ApiKeyRow {
  id: string;
  provider: Provider;
  key_alias: string;
  key_value: string;
  base_url: string | null;
  is_active: boolean;
}

export interface UpstreamContext {
  provider: Provider;
  upstreamUrl: string;
  apiKey: string;
  keyId: string;
}

export interface CapturedUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cache_creation_5m_tokens: number;
  cache_creation_1h_tokens: number;
}

export interface UsageRecord {
  request_id: string;
  provider: string;
  model: string;
  is_streaming: boolean;
  status_code: number;
  latency_ms: number;
  first_token_ms: number | null;
  user_agent: string | null;
  endpoint: string;
  api_key_id: string | null;
  usage_captured: boolean;
}
