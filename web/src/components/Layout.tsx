import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { healthCheck, fetchAlertStatus } from '../api/client';
import type { AlertStatusItem } from '../api/types';

/* eslint-disable react-refresh/only-export-components */

// Minimalist SVG line icons — 18x18, 1.5px stroke, rounded
function NavIcon({ name }: { name: string }): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    dashboard: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="6.5" height="6.5" rx="1" />
        <rect x="10.5" y="1" width="6.5" height="6.5" rx="1" />
        <rect x="1" y="10.5" width="6.5" height="6.5" rx="1" />
        <rect x="10.5" y="10.5" width="6.5" height="6.5" rx="1" />
      </svg>
    ),
    cost: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 1v16M4 5h8a3 3 0 0 1 0 6H5" />
      </svg>
    ),
    cache: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1,10 4,6 7,9 10,3 13,9 17,5" />
        <circle cx="17" cy="5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
    history: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="4" x2="17" y2="4" />
        <line x1="1" y1="9" x2="17" y2="9" />
        <line x1="1" y1="14" x2="13" y2="14" />
      </svg>
    ),
    models: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 10l4 4 4-8 3 6 3-4" />
      </svg>
    ),
    settings: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="2.5" />
        <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M3.3 14.7l1.4-1.4M13.3 4.7l1.4-1.4" />
      </svg>
    ),
  };
  return icons[name] || icons.dashboard;
}

const NAV_ITEMS = [
  { to: '/', label: '总览', icon: 'dashboard', end: true },
  { to: '/cost', label: '成本分析', icon: 'cost', end: false },
  { to: '/cache', label: '缓存命中', icon: 'cache', end: false },
  { to: '/history', label: '请求历史', icon: 'history', end: false },
  { to: '/models', label: '模型定价', icon: 'models', end: false },
  { to: '/settings', label: '设置', icon: 'settings', end: false },
];

function AlertBar({ alerts }: { alerts: AlertStatusItem[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="mt-auto pt-3 border-t border-gray-200">
      <div className="text-xs text-gray-400 mb-2 px-1">成本预警</div>
      {alerts.map((a) => {
        const pct = Math.min(a.percentage, 100);
        const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-emerald-400';
        const textColor = pct >= 100 ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : '';
        return (
          <div key={a.type} className="px-1 mb-2">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-500">{a.type === 'daily' ? '日' : a.type === 'weekly' ? '周' : '月'}</span>
              <span className={textColor || 'text-gray-600'}>${a.current.toFixed(2)} / ${a.limit.toFixed(0)}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <div className={`text-xs mt-0.5 text-right ${textColor || 'text-gray-400'}`}>{a.percentage}%</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isHealthy, setIsHealthy] = useState(false);
  const [alerts, setAlerts] = useState<AlertStatusItem[]>([]);

  useEffect(() => {
    healthCheck().then(r => setIsHealthy(r.db_connected)).catch(() => setIsHealthy(false));
    const hTimer = setInterval(() => {
      healthCheck().then(r => setIsHealthy(r.db_connected)).catch(() => setIsHealthy(false));
    }, 30_000);

    fetchAlertStatus().then(r => setAlerts(r.alerts)).catch(() => {});

    return () => clearInterval(hTimer);
  }, []);

  const sidebarWidth = collapsed ? 'w-[65px]' : 'w-[220px]';

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarWidth} flex flex-col bg-white border-r border-gray-200 shrink-0 transition-all duration-200 h-full`}>
        {/* Health dot */}
        <div className={`flex items-center gap-2 pt-4 pb-1 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
          <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${isHealthy ? 'bg-emerald-400' : 'bg-red-400'}`} title={isHealthy ? 'Online' : 'Offline'} />
          {!collapsed && <span className="text-xs text-gray-400">{isHealthy ? 'Online' : 'Offline'}</span>}
        </div>

        {/* Logo + toggle */}
        <div className={`px-4 py-2 mb-2 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} className="text-lg font-bold text-indigo-500" title="展开侧栏">T</button>
          ) : (
            <>
              <div className="text-lg font-bold text-gray-800">TokenViz Lite</div>
              <button
                onClick={() => setCollapsed(true)}
                className="text-gray-300 hover:text-gray-500 transition-colors"
                title="收起侧栏"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M11 4L6 9l5 5" />
                </svg>
              </button>
            </>
          )}
        </div>

        <div className="border-t border-gray-100 mx-3" />

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${isActive ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="shrink-0"><NavIcon name={item.icon} /></span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Alert bars — only in expanded mode */}
        {!collapsed && alerts.length > 0 && (
          <div className="px-3 pb-2">
            <AlertBar alerts={alerts} />
          </div>
        )}
        {collapsed && alerts.length > 0 && (
          <div className="px-2 pb-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${alerts.some(a => a.triggered) ? 'bg-red-400' : alerts.some(a => a.percentage >= 80) ? 'bg-amber-400' : 'bg-emerald-400'}`}
              title={alerts.map(a => `${a.type} ${a.percentage}%`).join('\n')}
            />
          </div>
        )}

      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <header className="h-[70px] flex items-center justify-end px-6 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="语言切换">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="9" r="7.5" />
                <ellipse cx="9" cy="9" rx="3.5" ry="7.5" />
                <line x1="2" y1="9" x2="16" y2="9" />
              </svg>
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="主题切换">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="9" r="4.5" />
                <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M3.3 14.7l1.4-1.4M13.3 4.7l1.4-1.4" />
              </svg>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
