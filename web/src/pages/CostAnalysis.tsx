import { useEffect, useState } from 'react';
import { Card, Text, AreaChart, BarChart, Table, TableBody, TableRow, TableCell } from '@tremor/react';
import { fetchByModel, fetchCostTrend } from '../api/client';
import type { ModelUsageSummary, CostTrendPoint } from '../api/types';

const PERIOD_OPTIONS = [
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
  { value: '90d', label: '90天' },
];

const CHART_COLORS = ['indigo', 'violet', 'cyan', 'emerald', 'amber', 'rose'];

function fmtCost(n: number) { return '$' + n.toFixed(2); }
function fmtTokens(n: number) { return n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(1) + 'K' : String(n); }
function fmtMs(n: number) { return n >= 1000 ? (n / 1000).toFixed(1) + 's' : n + 'ms'; }
function shortName(name: string, max = 18) { return name.length > max ? name.slice(0, max - 2) + '…' : name; }

export default function CostAnalysis() {
  const [period, setPeriod] = useState('30d');
  const [models, setModels] = useState<ModelUsageSummary[]>([]);
  const [costTrend, setCostTrend] = useState<{ series: CostTrendPoint[] }>({ series: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchByModel(period, 'total_cost', 'desc', 20),
      fetchCostTrend(period, 'day'),
    ]).then(([m, c]) => {
      setModels(m.models);
      setCostTrend({ series: c.series });
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return <div className="p-6 text-gray-400">加载中...</div>;
  }

  const costBarData = models.slice(0, 10).map((m) => ({
    name: shortName(m.model),
    cost: Number(m.total_cost.toFixed(4)),
    provider: m.provider,
  })).reverse();

  const tokenBarData = models.slice(0, 10).map((m) => ({
    name: shortName(m.model),
    '输入Token': m.prompt_tokens,
    '输出Token': m.completion_tokens,
  })).reverse();

  const trendData = costTrend.series.map((p) => ({
    date: new Date(p.time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    '输入成本': Number(p.input_cost.toFixed(4)),
    '输出成本': Number(p.output_cost.toFixed(4)),
    '总成本': Number(p.total_cost.toFixed(4)),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">成本分析</h1>
        <div className="flex items-center gap-2">
        {PERIOD_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setPeriod(o.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors
              ${period === o.value ? 'bg-indigo-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            {o.label}
          </button>
        ))}
        </div>
      </div>

      {/* Cost trend */}
      <Card>
        <Text>成本趋势</Text>
        <AreaChart
          className="h-72 mt-4"
          data={trendData}
          index="date"
          categories={['输入成本', '输出成本']}
          colors={['indigo', 'violet']}
          valueFormatter={(v) => '$' + (v as number).toFixed(2)}
          stack
        />
      </Card>

      {/* Side-by-side charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <Text>各模型成本 (USD)</Text>
          <BarChart
            className="h-72 mt-4"
            data={costBarData}
            index="name"
            categories={['cost']}
            colors={['indigo']}
            layout="vertical"
            valueFormatter={(v) => '$' + (v as number).toFixed(2)}
          />
        </Card>

        <Card>
          <Text>Token 用量对比</Text>
          <BarChart
            className="h-72 mt-4"
            data={tokenBarData}
            index="name"
            categories={['输入Token', '输出Token']}
            colors={['indigo', 'violet']}
            layout="vertical"
            valueFormatter={(v) => fmtTokens(v as number)}
          />
        </Card>
      </div>

      {/* Model table */}
      <Card>
        <Text>模型消耗排行榜</Text>
        <Table className="mt-4">
          <TableBody>
            {models.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Text className="text-center text-gray-400 py-4">暂无数据</Text>
                </TableCell>
              </TableRow>
            ) : (
              models.map((m) => {
                const colorIdx = ['openai','anthropic','deepseek','zhipu','qwen','gemini'].indexOf(m.provider);
                return (
                  <TableRow key={`${m.provider}:${m.model}`}>
                    <TableCell className="text-sm font-medium text-gray-800">{m.model}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-${CHART_COLORS[colorIdx >= 0 ? colorIdx : 0]}-50 text-${CHART_COLORS[colorIdx >= 0 ? colorIdx : 0]}-600`}>
                        {m.provider}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{fmtTokens(m.prompt_tokens)}</TableCell>
                    <TableCell className="text-sm text-gray-600">{fmtTokens(m.completion_tokens)}</TableCell>
                    <TableCell className="text-sm text-gray-800">{fmtCost(m.total_cost)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{m.request_count}</TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtMs(m.avg_latency_ms)}</TableCell>
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
