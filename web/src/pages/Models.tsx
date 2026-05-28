import { useEffect, useState } from 'react';
import { Card, Text, Table, TableBody, TableRow, TableCell } from '@tremor/react';
import { fetchPricing, updatePricing, createPricing, refreshPricing } from '../api/client';
import type { ModelPricingItem } from '../api/types';

export default function Models() {
  const [pricing, setPricing] = useState<ModelPricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ModelPricingItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  const load = () => {
    setLoading(true);
    fetchPricing().then(r => setPricing(r.pricing)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  if (loading) return <div className="p-6 text-gray-400">加载中...</div>;

  return (
    <div className="p-6 space-y-4">
      {toast && <div className="fixed top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">模型定价管理</h1>
        <div className="flex gap-2">
          <button onClick={() => { refreshPricing().then(r => { showToast(`已更新 ${r.updated} 条，新增 ${r.inserted} 条`); load(); }); }}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            刷新定价数据
          </button>
          <button onClick={() => setAdding(true)}
            className="text-sm px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
            + 添加模型
          </button>
        </div>
      </div>

      <Card>
        <Table>
          <TableBody>
            {pricing.length === 0 ? (
              <TableRow><TableCell colSpan={8}><Text className="text-center text-gray-400 py-4">暂无定价数据，请点击"刷新定价数据"从 pricing.json 导入</Text></TableCell></TableRow>
            ) : pricing.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">{p.provider}</TableCell>
                <TableCell className="text-sm font-medium text-gray-800">{p.model}</TableCell>
                <TableCell className="text-sm">${p.input_price.toFixed(2)}</TableCell>
                <TableCell className="text-sm">${p.output_price.toFixed(2)}</TableCell>
                <TableCell className="text-sm">${p.cache_read_price.toFixed(2)}</TableCell>
                <TableCell className="text-sm">${p.cache_write_price.toFixed(2)}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    {p.is_active ? '启用' : '禁用'}
                  </span>
                </TableCell>
                <TableCell>
                  <button onClick={() => setEditing(p)} className="text-sm text-indigo-500 hover:text-indigo-600">
                    编辑
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">编辑定价 — {editing.model}</h2>
            <form onSubmit={e => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updatePricing(editing.id, {
                input_price: Number(fd.get('input_price')),
                output_price: Number(fd.get('output_price')),
                cache_read_price: Number(fd.get('cache_read_price')),
                cache_write_price: Number(fd.get('cache_write_price')),
                is_active: fd.get('is_active') === 'true',
              }).then(() => { setEditing(null); showToast('已更新'); load(); });
            }} className="space-y-3">
              {(['input_price','output_price','cache_read_price','cache_write_price'] as const).map(field => (
                <div key={field}>
                  <label className="text-xs text-gray-500">{field}</label>
                  <input name={field} defaultValue={editing[field]} type="number" step="0.01" min="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500">状态</label>
                <select name="is_active" defaultValue={editing.is_active ? 'true' : 'false'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                  <option value="true">启用</option>
                  <option value="false">禁用</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-1.5 text-sm border rounded-lg">取消</button>
                <button type="submit" className="px-4 py-1.5 text-sm bg-indigo-500 text-white rounded-lg">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setAdding(false)}>
          <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">添加模型定价</h2>
            <form onSubmit={e => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createPricing({
                provider: fd.get('provider'),
                model: fd.get('model'),
                input_price: Number(fd.get('input_price')),
                output_price: Number(fd.get('output_price')),
                cache_read_price: Number(fd.get('cache_read_price') || 0),
                cache_write_price: Number(fd.get('cache_write_price') || 0),
              }).then(() => { setAdding(false); showToast('已添加'); load(); });
            }} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">厂商</label>
                <select name="provider" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                  {['openai','anthropic','deepseek','zhipu','qwen','gemini'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">模型名</label>
                <input name="model" required className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              </div>
              {(['input_price','output_price','cache_read_price','cache_write_price'] as const).map(field => (
                <div key={field}>
                  <label className="text-xs text-gray-500">{field} ($/1M tokens)</label>
                  <input name={field} defaultValue={0} type="number" step="0.01" min="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                </div>
              ))}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setAdding(false)} className="px-4 py-1.5 text-sm border rounded-lg">取消</button>
                <button type="submit" className="px-4 py-1.5 text-sm bg-indigo-500 text-white rounded-lg">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
