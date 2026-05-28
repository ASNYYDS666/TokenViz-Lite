import { useEffect, useState, useCallback } from 'react';
import { Card, Text, Table, TableBody, TableRow, TableCell } from '@tremor/react';
import { fetchHistory } from '../api/client';
import type { UsageHistoryItem, PaginationMeta } from '../api/types';

function fmtTokens(n: number) { return n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(1) + 'K' : String(n); }
function fmtMs(n: number) { return n >= 1000 ? (n / 1000).toFixed(1) + 's' : n + 'ms'; }

export default function History() {
  const [items, setItems] = useState<UsageHistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState('all');
  const [model, setModel] = useState('all');
  const [isStreaming, setIsStreaming] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchHistory({
      page, limit: 20, provider, model,
      is_streaming: isStreaming,
    }).then((r) => {
      setItems(r.items);
      setPagination(r.pagination);
    }).catch(console.error).finally(() => setLoading(false));
  }, [page, provider, model, isStreaming]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-800">请求历史</h1>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option value="all">全部厂商</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="deepseek">DeepSeek</option>
          <option value="zhipu">智谱</option>
          <option value="qwen">通义</option>
          <option value="gemini">Gemini</option>
        </select>

        <select value={model} onChange={(e) => { setModel(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option value="all">全部模型</option>
          {[...new Set(items.map(i => i.model))].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select value={isStreaming} onChange={(e) => { setIsStreaming(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option value="all">全部类型</option>
          <option value="true">流式</option>
          <option value="false">非流式</option>
        </select>

        <button onClick={() => load()} className="text-sm px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
          应用筛选
        </button>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="py-8 text-center text-gray-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-gray-400">暂无请求记录</div>
        ) : (
          <Table>
            <TableBody>
              {items.map((item) => (
                <>
                  <TableRow
                    key={item.id}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className={`cursor-pointer hover:bg-gray-50 ${!item.usage_captured ? 'bg-red-50/30' : ''}`}
                  >
                    <TableCell className="text-xs text-gray-500 w-16">
                      {new Date(item.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-sm w-20">{item.provider}</TableCell>
                    <TableCell className="text-sm max-w-32 truncate">{item.model}</TableCell>
                    <TableCell className="text-sm">{fmtTokens(item.total_tokens)}</TableCell>
                    <TableCell className="text-sm">${item.total_cost.toFixed(4)}</TableCell>
                    <TableCell className="text-sm">{fmtMs(item.latency_ms)}</TableCell>
                    <TableCell className="text-sm">{item.first_token_ms ? fmtMs(item.first_token_ms) : '--'}</TableCell>
                    <TableCell>
                      <span className={`text-xs ${item.is_streaming ? 'text-indigo-500' : 'text-gray-400'}`}>
                        {item.is_streaming ? 'SSE' : 'REST'}
                      </span>
                    </TableCell>
                  </TableRow>
                  {/* Expanded detail */}
                  {expandedId === item.id && (
                    <TableRow key={`${item.id}-detail`}>
                      <TableCell colSpan={8} className="bg-gray-50 p-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-gray-400 mb-1">请求ID</div>
                            <div className="font-mono text-xs text-gray-600">{item.request_id}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">端点</div>
                            <div className="font-mono text-xs text-gray-600">{item.endpoint}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">User-Agent</div>
                            <div className="text-xs text-gray-600">{item.user_agent || '--'}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">Token 明细</div>
                            <div className="text-xs text-gray-600">
                              P: {item.prompt_tokens} | C: {item.completion_tokens} | Cache: {item.cache_read_tokens}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">成本明细</div>
                            <div className="text-xs text-gray-600">
                              输入: ${item.input_cost.toFixed(6)} | 输出: ${item.output_cost.toFixed(6)}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">状态</div>
                            <div className="text-xs">
                              <span className={item.status_code === 200 ? 'text-emerald-500' : 'text-red-400'}>
                                {item.status_code}
                              </span>
                              <span className="text-gray-400 ml-2">usage: {item.usage_captured ? '✓' : '✗'}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <Text className="text-xs text-gray-400">
              共 {pagination.total} 条，第 {pagination.page}/{pagination.total_pages} 页
            </Text>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              >
                ◀ 上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="px-3 py-1 text-sm rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              >
                下一页 ▶
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
