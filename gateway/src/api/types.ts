// ─── 通用 ───
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

// ─── Dashboard ───
export interface DashboardSummary {
  period: string;
  total_cost: number;
  today_cost: number;
  total_tokens: number;
  active_models: number;
  cache_hit_rate: number;
  request_count: number;
  avg_latency_ms: number;
}

export interface RecentActivityItem {
  id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost: number;
  is_streaming: boolean;
  latency_ms: number;
  first_token_ms: number | null;
  user_agent: string | null;
  created_at: string;
}

// ─── Trend ───
export interface TrendPoint {
  time: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  request_count: number;
}

export interface CostTrendPoint {
  time: string;
  input_cost: number;
  output_cost: number;
  total_cost: number;
}

// ─── By Model ───
export interface ModelUsageSummary {
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  request_count: number;
  avg_latency_ms: number;
}

// ─── By Provider ───
export interface ProviderUsageSummary {
  provider: string;
  total_tokens: number;
  total_cost: number;
  request_count: number;
  model_count: number;
  models: { model: string; total_cost: number; total_tokens: number }[];
}

// ─── Cache ───
export interface CacheStatsItem {
  provider: string;
  model: string;
  prompt_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cache_hit_rate: number;
  total_cost: number;
  estimated_savings: number;
  request_count: number;
}

export interface CacheTrendPoint {
  time: string;
  prompt_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cache_hit_rate: number;
  total_cost: number;
  estimated_savings: number;
}

// ─── History ───
export interface UsageHistoryItem {
  id: string;
  request_id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_read_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  endpoint: string;
  is_streaming: boolean;
  status_code: number;
  latency_ms: number;
  first_token_ms: number | null;
  user_agent: string | null;
  usage_captured: boolean;
  created_at: string;
}

// ─── Models ───
export interface ModelPricing {
  id: string;
  provider: string;
  model: string;
  input_price: number;
  output_price: number;
  cache_read_price: number;
  cache_write_price: number;
  is_active: boolean;
  updated_at: string;
}

// ─── Keys ───
export interface ApiKeyItem {
  id: string;
  provider: string;
  key_alias: string;
  key_value: string;
  base_url: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

// ─── Alerts ───
export interface AlertConfig {
  enabled: boolean;
  daily_limit: number;
  weekly_limit: number;
  monthly_limit: number;
}

export interface AlertStatusItem {
  type: 'daily' | 'weekly' | 'monthly';
  limit: number;
  current: number;
  percentage: number;
  triggered: boolean;
}

// ─── Performance ───
export interface PerformanceOverall {
  avg_latency_ms: number;
  avg_first_token_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
}

export interface ModelPerformance {
  provider: string;
  model: string;
  avg_latency_ms: number;
  avg_first_token_ms: number;
  request_count: number;
}

export interface PerformanceTrendPoint {
  time: string;
  avg_latency_ms: number;
  avg_first_token_ms: number;
}

// ─── Error ───
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
