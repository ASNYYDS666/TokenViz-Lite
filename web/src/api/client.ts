import axios from 'axios';
import type {
  DashboardSummary, RecentActivityItem, TrendPoint, CostTrendPoint,
  ModelUsageSummary, ProviderUsageSummary, CacheStatsItem, CacheTrendPoint,
  UsageHistoryItem, PaginationMeta, ModelPricingItem, ApiKeyItem,
  AlertConfigData, AlertStatusItem, PerformanceOverall, ModelPerformance, PerformanceTrendPoint,
} from './types';

const api = axios.create({ baseURL: '/api' });

const encodeAuth = () => {
  // Default Basic Auth for management endpoints
  return 'Basic ' + btoa('admin:changeme');
};

// ─── Dashboard ───
export async function fetchSummary(period = '30d'): Promise<DashboardSummary> {
  const { data } = await api.get('/dashboard/summary', { params: { period } });
  return data;
}

export async function fetchRecentActivity(limit = 10): Promise<{ items: RecentActivityItem[] }> {
  const { data } = await api.get('/dashboard/recent-activity', { params: { limit } });
  return data;
}

// ─── Usage ───
export async function fetchTrend(period = '7d', granularity = 'hour', provider = 'all', model = 'all'): Promise<{ period: string; granularity: string; series: TrendPoint[] }> {
  const { data } = await api.get('/usage/trend', { params: { period, granularity, provider, model } });
  return data;
}

export async function fetchCostTrend(period = '7d', granularity = 'day'): Promise<{ period: string; granularity: string; series: CostTrendPoint[] }> {
  const { data } = await api.get('/usage/trend/cost', { params: { period, granularity } });
  return data;
}

export async function fetchByModel(period = '30d', sortBy = 'total_cost', order = 'desc', limit = 20): Promise<{ period: string; models: ModelUsageSummary[] }> {
  const { data } = await api.get('/usage/by-model', { params: { period, sort_by: sortBy, order, limit } });
  return data;
}

export async function fetchByProvider(period = '30d'): Promise<{ period: string; providers: ProviderUsageSummary[] }> {
  const { data } = await api.get('/usage/by-provider', { params: { period } });
  return data;
}

export async function fetchCacheStats(period = '7d', provider = 'all'): Promise<{ period: string; models: CacheStatsItem[] }> {
  const { data } = await api.get('/usage/cache-stats', { params: { period, provider } });
  return data;
}

export async function fetchCacheTrend(period = '7d', granularity = 'day', model = 'all'): Promise<{ period: string; granularity: string; series: CacheTrendPoint[] }> {
  const { data } = await api.get('/usage/cache-trend', { params: { period, granularity, model } });
  return data;
}

export async function fetchHistory(params: {
  page?: number; limit?: number; provider?: string; model?: string;
  is_streaming?: string; sort_by?: string; order?: string;
  date_from?: string; date_to?: string; usage_captured?: string;
} = {}): Promise<{ items: UsageHistoryItem[]; pagination: PaginationMeta }> {
  const { data } = await api.get('/usage/history', { params });
  return data;
}

export async function fetchPerformance(period = '7d', provider = 'all', model = 'all'): Promise<{
  period: string; overall: PerformanceOverall;
  by_model: ModelPerformance[]; trend: PerformanceTrendPoint[];
}> {
  const { data } = await api.get('/usage/performance', { params: { period, provider, model } });
  return data;
}

// ─── Models ───
export async function fetchPricing(): Promise<{ pricing: ModelPricingItem[] }> {
  const { data } = await api.get('/models/pricing');
  return data;
}

export async function updatePricing(id: string, body: Record<string, unknown>): Promise<ModelPricingItem> {
  const { data } = await api.put(`/models/pricing/${id}`, body, {
    headers: { Authorization: encodeAuth() },
  });
  return data;
}

export async function createPricing(body: Record<string, unknown>): Promise<ModelPricingItem> {
  const { data } = await api.post('/models/pricing', body, {
    headers: { Authorization: encodeAuth() },
  });
  return data;
}

export async function refreshPricing(): Promise<{ message: string; updated: number; inserted: number }> {
  const { data } = await api.post('/models/pricing/refresh', null, {
    headers: { Authorization: encodeAuth() },
  });
  return data;
}

// ─── Keys ───
export async function fetchKeys(): Promise<{ keys: ApiKeyItem[] }> {
  const { data } = await api.get('/keys', {
    headers: { Authorization: encodeAuth() },
  });
  return data;
}

export async function createKey(body: Record<string, unknown>): Promise<ApiKeyItem> {
  const { data } = await api.post('/keys', body, {
    headers: { Authorization: encodeAuth() },
  });
  return data;
}

export async function updateKey(id: string, body: Record<string, unknown>): Promise<ApiKeyItem> {
  const { data } = await api.put(`/keys/${id}`, body, {
    headers: { Authorization: encodeAuth() },
  });
  return data;
}

export async function deleteKey(id: string): Promise<void> {
  await api.delete(`/keys/${id}`, {
    headers: { Authorization: encodeAuth() },
  });
}

export async function testKey(id: string): Promise<{ success: boolean; latency_ms: number; message: string }> {
  const { data } = await api.post(`/keys/${id}/test`, null, {
    headers: { Authorization: encodeAuth() },
  });
  return data;
}

// ─── Alerts ───
export async function fetchAlertConfig(): Promise<AlertConfigData> {
  const { data } = await api.get('/alerts/config');
  return data;
}

export async function updateAlertConfig(body: AlertConfigData): Promise<AlertConfigData> {
  const { data } = await api.put('/alerts/config', body, {
    headers: { Authorization: encodeAuth() },
  });
  return data;
}

export async function fetchAlertStatus(): Promise<{ alerts: AlertStatusItem[] }> {
  const { data } = await api.get('/alerts/status');
  return data;
}

// ─── Health ───
export async function healthCheck(): Promise<{ status: string; db_connected: boolean }> {
  const { data } = await api.get('/health');
  return data;
}
