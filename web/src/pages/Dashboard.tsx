import { useEffect, useState } from 'react';
import { Card, Metric, Text, AreaChart, DonutChart, Table, TableBody, TableRow, TableCell } from '@tremor/react';
import {
  fetchSummary, fetchTrend, fetchByProvider, fetchRecentActivity,
} from '../api/client';
import type { DashboardSummary, TrendPoint, ProviderUsageSummary, RecentActivityItem } from '../api/types';

const PERIOD_OPTIONS = [
  { value: '1d', label: '1天' },
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
function fmtCost(n: number): string { return '$' + n.toFixed(2); }
function fmtMs(n: number): string { return n >= 1000 ? (n / 1000).toFixed(1) + 's' : n + 'ms'; }

const CHART_COLORS = ['indigo', 'violet', 'cyan', 'emerald', 'amber', 'rose'];

export default function Dashboard() {
  const [period, setPeriod] = useState('30d');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<{ series: TrendPoint[] }>({ series: [] });
  const [providers, setProviders] = useState<ProviderUsageSummary[]>([]);
  const [recentItems, setRecentItems] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSummary(period),
      fetchTrend(period, period === '1d' ? 'hour' : 'day'),
      fetchByProvider(period),
      fetchRecentActivity(10),
    ]).then(([s, t, p, r]) => {
      setSummary(s);
      setTrend({ series: t.series });
      setProviders(p.providers);
      setRecentItems(r.items);
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading || !summary) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  const providerChartData = providers.map((p, i) => ({
    name: p.provider,
    value: Number(p.total_cost.toFixed(4)),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const trendChartData = trend.series.map((p) => ({
    date: new Date(p.time).toLocaleDateString('zh-CN', period === '1d' ? { hour: '2-digit' } : { month: 'short', day: 'numeric' }),
    '输入Token': p.prompt_tokens,
    '输出Token': p.completion_tokens,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Title + Period selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">总览</h1>
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors
                ${period === opt.value ? 'bg-indigo-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Big number cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="flex flex-col gap-1">
          <Text>周期总消耗</Text>
          <Metric>{fmtCost(summary.total_cost)}</Metric>
          <Text className="text-xs text-gray-400">选定时间范围</Text>
        </Card>
        <Card className="flex flex-col gap-1">
          <Text>今日消耗</Text>
          <Metric>{fmtCost(summary.today_cost)}</Metric>
          <Text className="text-xs text-gray-400">今日实时</Text>
        </Card>
        <Card className="flex flex-col gap-1">
          <Text>活跃模型</Text>
          <Metric>{String(summary.active_models)}</Metric>
          <Text className="text-xs text-gray-400">周期内使用</Text>
        </Card>
        <Card className="flex flex-col gap-1">
          <Text>缓存命中率</Text>
          <Metric>{(summary.cache_hit_rate * 100).toFixed(1) + '%'}</Metric>
          <Text className="text-xs text-gray-400">全局命中</Text>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <Text>Token 消耗趋势</Text>
          <AreaChart
            className="h-72 mt-4"
            data={trendChartData}
            index="date"
            categories={['输入Token', '输出Token']}
            colors={['indigo', 'violet']}
            valueFormatter={(v) => fmtTokens(v as number)}
            showLegend
            stack
          />
        </Card>

        <Card>
          <Text>厂商消耗分布</Text>
          <DonutChart
            className="h-72 mt-4"
            data={providerChartData}
            index="name"
            category="value"
            valueFormatter={(v) => '$' + (v as number).toFixed(2)}
            colors={CHART_COLORS}
            showLabel
          />
          <div className="mt-3 space-y-1">
            {providers.map((p) => (
              <div key={p.provider} className="text-xs text-gray-500 flex justify-between">
                <span>{p.provider}</span>
                <span>{p.model_count} 模型 · ${p.total_cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <Text>最近请求</Text>
          <a href="/history" className="text-xs text-indigo-500 hover:text-indigo-600">查看全部 →</a>
        </div>
        <Table>
          <TableBody>
            {recentItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Text className="text-center text-gray-400 py-4">暂无数据，开始使用代理后将自动记录</Text>
                </TableCell>
              </TableRow>
            ) : (
              recentItems.map((item) => {
                const colorIdx = ['openai','anthropic','deepseek','zhipu','qwen','gemini'].indexOf(item.provider);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-${CHART_COLORS[colorIdx >= 0 ? colorIdx : 0]}-50 text-${CHART_COLORS[colorIdx >= 0 ? colorIdx : 0]}-600`}>
                        {item.provider}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 max-w-40 truncate">{item.model}</TableCell>
                    <TableCell className="text-sm text-gray-600">{fmtTokens(item.prompt_tokens + item.completion_tokens)}</TableCell>
                    <TableCell className="text-sm text-gray-700">{fmtCost(item.total_cost)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtMs(item.latency_ms)}</TableCell>
                    <TableCell>
                      <span className={`text-xs ${item.is_streaming ? 'text-indigo-500' : 'text-gray-400'}`}>
                        {item.is_streaming ? 'SSE' : 'REST'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
