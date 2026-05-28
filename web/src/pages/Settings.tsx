import { useEffect, useState } from 'react';
import { Card, Text, Table, TableBody, TableRow, TableCell, Switch } from '@tremor/react';
import {
  fetchKeys, createKey, updateKey, deleteKey, testKey,
  fetchAlertConfig, updateAlertConfig, fetchAlertStatus,
} from '../api/client';
import type { ApiKeyItem, AlertConfigData, AlertStatusItem } from '../api/types';

export default function Settings() {
  // Keys
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [showAddKey, setShowAddKey] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Alerts
  const [alertConfig, setAlertConfig] = useState<AlertConfigData>({
    enabled: false, daily_limit: 5, weekly_limit: 30, monthly_limit: 100,
  });
  const [alertStatus, setAlertStatus] = useState<AlertStatusItem[]>([]);

  // Export
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportPeriod, setExportPeriod] = useState('30d');

  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadKeys = () => {
    fetchKeys().then(r => setKeys(r.keys)).catch(err => showToast('Key 加载失败: ' + (err as Error).message));
  };

  useEffect(() => {
    loadKeys();
    fetchAlertConfig().then(setAlertConfig).catch(() => {});
    fetchAlertStatus().then(r => setAlertStatus(r.alerts)).catch(() => {});
  }, []);

  const getStatus = (type: string) => alertStatus.find(a => a.type === type);

  const statusColor = (pct: number) => pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-400';

  return (
    <div className="p-6 space-y-6">
      {toast && <div className="fixed top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">{toast}</div>}

      {/* API Keys */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <Text>API Key 管理</Text>
          <button onClick={() => setShowAddKey(true)} className="text-sm px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
            + 添加 Key
          </button>
        </div>
        <Table>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow><TableCell colSpan={7}><Text className="text-center text-gray-400 py-4">尚未添加 API Key</Text></TableCell></TableRow>
            ) : keys.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="text-sm">{k.provider}</TableCell>
                <TableCell className="text-sm font-medium text-gray-800">{k.key_alias}</TableCell>
                <TableCell className="text-sm font-mono text-gray-500">{k.key_value}</TableCell>
                <TableCell className="text-xs text-gray-400">{k.base_url || '(默认)'}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${k.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    {k.is_active ? '启用' : '禁用'}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-gray-400">
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('zh-CN') : '从未使用'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingKey(k)} className="text-sm text-indigo-500">编辑</button>
                    <button onClick={() => {
                      testKey(k.id).then(r => showToast(r.success ? `连接成功 ${r.latency_ms}ms` : `失败: ${r.message}`));
                    }} className="text-sm text-cyan-500">测试</button>
                    <button onClick={() => setDeleteConfirm(k.id)} className="text-sm text-red-400">删除</button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Alert Config */}
      <Card>
        <Text>成本预警设置</Text>
        <div className="mt-4 space-y-4 max-w-md">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={alertConfig.enabled}
              onChange={e => setAlertConfig({ ...alertConfig, enabled: e.target.checked })} />
            <span className="text-sm">启用成本预警</span>
          </label>

          {(['daily','weekly','monthly'] as const).map((type) => {
            const status = getStatus(type);
            const key = `${type}_limit` as const;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500">{type === 'daily' ? '日' : type === 'weekly' ? '周' : '月'}预算上限</label>
                  {status && (
                    <span className={`text-xs ${status.percentage >= 80 ? 'text-amber-500' : 'text-gray-400'}`}>
                      当前: ${status.current.toFixed(2)} ({status.percentage}%)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">$</span>
                  <input type="number" step="0.01" min="0"
                    value={alertConfig[key]}
                    onChange={e => setAlertConfig({ ...alertConfig, [key]: Number(e.target.value) })}
                    className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                  {status && (
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${statusColor(status.percentage)}`}
                        style={{ width: `${Math.min(status.percentage, 100)}%` }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button onClick={() => {
            updateAlertConfig(alertConfig).then(() => showToast('预警设置已保存'));
          }} className="px-4 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
            保存预警设置
          </button>
        </div>
      </Card>

      {/* Export */}
      <Card>
        <Text>数据导出</Text>
        <div className="mt-4 flex items-center gap-3">
          <select value={exportFormat} onChange={e => setExportFormat(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <select value={exportPeriod} onChange={e => setExportPeriod(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            <option value="7d">7天</option>
            <option value="30d">30天</option>
            <option value="90d">90天</option>
            <option value="all">全部</option>
          </select>
          <a href={`/api/export?format=${exportFormat}&period=${exportPeriod}`}
            className="text-sm px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 no-underline">
            导出并下载
          </a>
        </div>
      </Card>

      {/* Key Modals */}
      {showAddKey && <KeyFormModal title="添加 API Key" onClose={() => setShowAddKey(false)}
        onSubmit={(body) => createKey(body).then(() => { setShowAddKey(false); showToast('已添加'); loadKeys(); })} />}

      {editingKey && <KeyFormModal title="编辑 API Key" initial={editingKey} onClose={() => setEditingKey(null)}
        onSubmit={(body) => updateKey(editingKey.id, body).then(() => { setEditingKey(null); showToast('已更新'); loadKeys(); })} />}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">确认删除</h2>
            <p className="text-sm text-gray-500 mb-4">确定要删除这个 API Key 吗？关联的历史记录将保留。</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-1.5 text-sm border rounded-lg">取消</button>
              <button onClick={() => {
                deleteKey(deleteConfirm).then(() => { setDeleteConfirm(null); showToast('已删除'); loadKeys(); });
              }} className="px-4 py-1.5 text-sm bg-red-500 text-white rounded-lg">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyFormModal({ title, initial, onClose, onSubmit }: {
  title: string;
  initial?: ApiKeyItem;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <form onSubmit={e => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit({
            provider: fd.get('provider'),
            key_alias: fd.get('key_alias'),
            key_value: fd.get('key_value'),
            base_url: fd.get('base_url') || null,
            is_active: fd.get('is_active') === 'true',
          });
        }} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">厂商</label>
            <select name="provider" defaultValue={initial?.provider}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {['openai','anthropic','deepseek','zhipu','qwen','gemini'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">别名</label>
            <input name="key_alias" defaultValue={initial?.key_alias} required
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">API Key</label>
            <input name="key_value" type="password" required
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            {initial && <div className="text-xs text-gray-400 mt-1">当前: {initial.key_value}</div>}
          </div>
          <div>
            <label className="text-xs text-gray-500">自定义 URL (可选)</label>
            <input name="base_url" defaultValue={initial?.base_url || ''}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">状态</label>
            <select name="is_active" defaultValue={initial?.is_active !== false ? 'true' : 'false'}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="true">启用</option>
              <option value="false">禁用</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm border rounded-lg">取消</button>
            <button type="submit" className="px-4 py-1.5 text-sm bg-indigo-500 text-white rounded-lg">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
