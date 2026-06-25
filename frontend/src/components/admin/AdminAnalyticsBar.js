import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ShoppingBag, TrendingUp, Receipt, Users, BarChart3 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import AdminDashboard from './AdminDashboard';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));

export default function AdminAnalyticsBar({ onNavigate }) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(() => localStorage.getItem('adminAnalyticsOpen') === 'true');
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    axios.get(`${API}/admin/dashboard`).then(r => setTotals(r.data?.totals || null)).catch(() => {});
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem('adminAnalyticsOpen', String(next));
  };

  const kpis = [
    { key: 'orders', label: 'Всего заказов', value: fmt(totals?.orders_total), Icon: ShoppingBag, color: 'text-teal-600', bg: isDark ? 'bg-teal-500/10' : 'bg-teal-50', testid: 'analytics-kpi-orders' },
    { key: 'revenue', label: 'Выручка', value: `${fmt(totals?.total_revenue)} ₽`, Icon: TrendingUp, color: 'text-emerald-600', bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50', testid: 'analytics-kpi-revenue' },
    { key: 'avg', label: 'Средний чек', value: `${fmt(totals?.avg_order_value)} ₽`, Icon: Receipt, color: 'text-amber-600', bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50', testid: 'analytics-kpi-avg' },
    { key: 'customers', label: 'Всего клиентов', value: fmt(totals?.total_customers), Icon: Users, color: 'text-violet-600', bg: isDark ? 'bg-violet-500/10' : 'bg-violet-50', testid: 'analytics-kpi-customers' },
  ];

  return (
    <div
      className={`mb-6 rounded-xl border ${isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'}`}
      data-testid="admin-analytics-bar"
    >
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3">
        <div className={`hidden sm:flex w-9 h-9 rounded-lg items-center justify-center flex-shrink-0 ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
          <BarChart3 className="w-5 h-5 text-teal-600" />
        </div>
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 min-w-0">
          {kpis.map(k => (
            <div key={k.key} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${k.bg}`} data-testid={k.testid}>
              <k.Icon className={`w-4 h-4 flex-shrink-0 ${k.color}`} />
              <div className="min-w-0">
                <p className={`text-[10px] uppercase tracking-wide truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{k.label}</p>
                <p className={`text-sm font-bold tabular-nums truncate ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={toggle}
          className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-slate-100 text-slate-500'}`}
          data-testid="analytics-collapse-toggle"
          title={open ? 'Свернуть аналитику' : 'Развернуть аналитику'}
        >
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5" />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className={`border-t px-4 sm:px-5 py-5 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
              <AdminDashboard onNavigate={onNavigate} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
