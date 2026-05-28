import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CostAnalysis from './pages/CostAnalysis';
import CacheHitRate from './pages/CacheHitRate';
import History from './pages/History';
import Models from './pages/Models';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="cost" element={<CostAnalysis />} />
          <Route path="cache" element={<CacheHitRate />} />
          <Route path="history" element={<History />} />
          <Route path="models" element={<Models />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
