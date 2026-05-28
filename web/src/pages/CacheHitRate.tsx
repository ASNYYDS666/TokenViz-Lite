import { useEffect, useState } from 'react';
import { Card, Metric, Text, BarChart, LineChart, Table, TableBody, TableRow, TableCell } from '@tremor/react';
import { fetchCacheStats, fetchCacheTrend } from '../api/client';
import type { CacheStatsItem, CacheTrendPoint } from '../api/types';

function fmtTokens(n: number) { return n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(1) + 'K' : String(n); }
function shortName(name: string, max = 18) { return name.length > max ? name.slice(0, max - 2) + '…' : name; }

const PERIOD_OPTIONS = [
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
];

export default function CacheHitRate() {
  const [period, setPeriod] = useState('7d');
  const [stats, setStats] = useState<CacheStatsItem[]>([]);
  const [trend, setTrend] = useState<{ series: CacheTrendPoint[] }>({ series: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCacheStats(period),
      fetchCacheTrend(period, 'day'),
    ]).then(([s, t]) => {
      setStats(s.models);
      setTrend({ series: t.series });
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  const totalSavings = stats.reduce((sum, m) => sum + m.estimated_savings, 0);

  const hitRateData = stats.map((m) => ({
    name: shortName(m.model),
    '缓存命中 (%)': Math.round(m.cache_hit_rate * 1000) / 10,
    未命中: Math.round((1 - m.cache_hit_rate) * 1000) / 10,
  }));

  const trendData = trend.series.map((p) => ({
    date: new Date(p.time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    命中率: Math.round(p.cache_hit_rate * 1000) / 10,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">缓存命中率</h1>
        <div className="flex items-center gap-2">
        {PERIOD_OPTIONS.map((o) => (
          <button key={o.value} onClick={() => setPeriod(o.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors
              ${period === o.value ? 'bg-indigo-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
            {o.label}
          </button>
        ))}
        </div>
      </div>

      {/* Savings card */}
      <Card className="max-w-sm">
        <Text>缓存为你节省了</Text>
        <Metric>${totalSavings.toFixed(2)}</Metric>
      </Card>

      {/* Hit rate chart */}
      <Card>
        <Text>各模型缓存命中率 (%)</Text>
        <BarChart
          className="h-72 mt-4"
          data={hitRateData}
          index="name"
          categories={['缓存命中 (%)', '未命中']}
          colors={['indigo', 'gray-200']}
          layout="vertical"
          stack
        />
      </Card>

      {/* Trend */}
      <Card>
        <Text>缓存命中率趋势</Text>
        <LineChart
          className="h-64 mt-4"
          data={trendData}
          index="date"
          categories={['命中率']}
          colors={['indigo']}
          valueFormatter={(v) => (v as number).toFixed(1) + '%'}
        />
      </Card>

      {/* Detail table */}
      <Card>
        <Text>缓存详情</Text>
        <Table className="mt-4">
          <TableBody>
            {stats.length === 0 ? (
              <TableRow><TableCell colSpan={6}><Text className="text-center text-gray-400 py-4">暂无数据</Text></TableCell></TableRow>
            ) : stats.map((m) => (
              <TableRow key={`${m.provider}:${m.model}`}>
                <TableCell className="text-sm font-medium text-gray-800">{m.model}</TableCell>
                <TableCell className="text-sm text-gray-600">{fmtTokens(m.cache_read_tokens)}</TableCell>
                <TableCell className="text-sm text-gray-600">{fmtTokens(m.cache_creation_tokens)}</TableCell>
                <TableCell className="text-sm text-gray-800">{(m.cache_hit_rate * 100).toFixed(1)}%</TableCell>
                <TableCell className="text-sm text-gray-800">${m.total_cost.toFixed(2)}</TableCell>
                <TableCell className="text-sm text-emerald-600">${m.estimated_savings.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
