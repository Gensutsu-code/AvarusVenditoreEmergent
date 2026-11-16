import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLive } from '../../lib/live';
import { motion } from 'framer-motion';
import { TrendingUp, ShoppingBag, Clock, PackageX, AlertTriangle, CreditCard, Wallet, ArrowRight, BarChart3 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p || 0));

const PM_LABEL = { card: 'Карта', crypto: 'Крипта', mixed: 'Смешанная', cash: 'Наличные' };

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200/70 rounded-lg ${className}`} />
);

const KPI = ({ icon: Icon, label, value, accent, onClick, testid }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={onClick ? { y: -3 } : {}}
    className={`text-left p-5 rounded-2xl border bg-white shadow-sm transition-shadow ${onClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'} ${accent.border}`}
    data-testid={testid}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accent.bg}`}>
      <Icon className={`w-5 h-5 ${accent.text}`} />
    </div>
    <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
  </motion.button>
);

export default function AdminDashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    axios.get(`${API}/admin/dashboard`)
      .then((r) => { if (mounted) setData(r.data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  useLive(() => axios.get(`${API}/admin/dashboard`).then((r) => setData(r.data)).catch(() => {}), 30000);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-2xl border border-slate-200 bg-white">
              <Skeleton className="w-10 h-10 mb-3" />
              <Skeleton className="h-7 w-24 mb-2" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-16 text-slate-400" data-testid="dashboard-error">Не удалось загрузить данные дашборда</div>;
  }

  const maxRev = Math.max(1, ...data.revenue_by_day.map((d) => d.revenue));

  const accents = {
    teal: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200/60' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200/60' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200/60' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200/60' },
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} data-testid="admin-dashboard">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={TrendingUp} label="Выручка сегодня" value={`${fmt(data.today.revenue)} ₽`} accent={accents.teal} testid="kpi-today-revenue" />
        <KPI icon={ShoppingBag} label="Всего заказов" value={fmt(data.totals.orders_total)} accent={accents.emerald} onClick={() => navigate('/admin/orders')} testid="kpi-total-orders" />
        <KPI icon={Clock} label="Ожидают оплаты" value={fmt(data.totals.awaiting_payment)} accent={accents.amber} onClick={() => navigate('/admin/orders')} testid="kpi-awaiting-payment" />
        <KPI icon={PackageX} label="В обработке" value={fmt(data.totals.pending_processing)} accent={accents.indigo} onClick={() => navigate('/admin/orders')} testid="kpi-pending" />
      </div>

      {/* Revenue chart */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="dashboard-revenue-chart">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-teal-500" />Выручка за 14 дней</h3>
          <span className="text-sm text-slate-500">За 30 дней: <b className="text-slate-800">{fmt(data.totals.revenue_30d)} ₽</b></span>
        </div>
        <div className="flex items-end gap-1.5 h-40">
          {data.revenue_by_day.map((d, i) => {
            const h = (d.revenue / maxRev) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end group">
                <div className="text-[9px] text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{fmt(d.revenue)}</div>
                <motion.div
                  className="w-full rounded-t-md bg-gradient-to-t from-teal-500 to-emerald-400 hover:from-teal-600 hover:to-emerald-500 transition-colors"
                  style={{ minHeight: d.revenue > 0 ? '6px' : '2px' }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(h, d.revenue > 0 ? 4 : 1)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.03 }}
                  title={`${d.date}: ${fmt(d.revenue)} ₽ · ${d.orders} зак.`}
                />
                <div className="text-[9px] text-slate-400 mt-1.5">{d.date.slice(8, 10)}.{d.date.slice(5, 7)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="dashboard-top-products">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" />Топ товары (30 дней)</h3>
          {data.top_products.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Нет продаж за период</p>
          ) : (
            <div className="space-y-2">
              {data.top_products.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                    <p className="text-[11px] font-mono text-slate-400">{p.article}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800">{p.qty} шт</p>
                    <p className="text-[11px] text-slate-400">{fmt(p.revenue)} ₽</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="dashboard-low-stock">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-500" />Низкие остатки (≤{data.low_stock_threshold})</h3>
            {onNavigate && <button onClick={() => onNavigate('warehouse')} className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">Склад <ArrowRight className="w-3 h-3" /></button>}
          </div>
          {data.low_stock.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Все товары в достатке 👍</p>
          ) : (
            <div className="space-y-2">
              {data.low_stock.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                    <p className="text-[11px] font-mono text-slate-400">{p.article}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${p.stock <= 0 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>{p.stock} шт</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Awaiting payment orders */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="dashboard-awaiting-payment">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" />Заказы в ожидании оплаты</h3>
        {data.awaiting_payment_orders.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">Нет заказов, ожидающих оплаты</p>
        ) : (
          <div className="space-y-2">
            {data.awaiting_payment_orders.map((o) => (
              <div key={o.id} onClick={() => navigate('/admin/orders')} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors" data-testid={`awaiting-order-${o.id}`}>
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                  {o.payment_method === 'crypto' ? <Wallet className="w-4 h-4 text-amber-500" /> : <CreditCard className="w-4 h-4 text-amber-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">#{o.id.slice(0, 8)} · {o.full_name || '—'}</p>
                  <p className="text-[11px] text-slate-400">{PM_LABEL[o.payment_method] || o.payment_method} · {String(o.created_at).slice(0, 10)}{o.card_receipt_url ? ' · чек загружен' : ''}</p>
                </div>
                <span className="text-sm font-bold text-slate-800 flex-shrink-0">{fmt(o.total)} ₽</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
