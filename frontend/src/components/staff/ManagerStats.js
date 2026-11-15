import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export const PERIODS = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'year', label: 'Год' },
  { id: 'all', label: 'Всё время' },
];
export const money = (n) => `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0))} ₽`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const STATUS = { pending: 'Новый', processing: 'В работе', shipped: 'Отправлен', delivered: 'Доставлен', cancelled: 'Отменён' };

export const PeriodSwitch = ({ value, onChange }) => (
  <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100" data-testid="period-switch">
    {PERIODS.map((p) => (
      <button key={p.id} onClick={() => onChange(p.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${value === p.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} data-testid={`period-${p.id}`}>
        {p.label}
      </button>
    ))}
  </div>
);

const Kpi = ({ label, value, accent = 'text-slate-800', testid }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-[11px] font-semibold uppercase text-slate-400">{label}</p>
    <p className={`text-xl font-bold mt-1 ${accent}`} data-testid={testid}>{value}</p>
  </div>
);

const Th = ({ children, right }) => <th className={`px-3 py-2 text-[11px] font-semibold uppercase text-slate-400 ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
const Td = ({ children, right, className = '' }) => <td className={`px-3 py-2 text-sm ${right ? 'text-right whitespace-nowrap' : ''} ${className}`}>{children}</td>;

// Totals + sales by client, by product and every order with its items
export const ManagerStatsView = ({ stats }) => {
  const [openOrder, setOpenOrder] = useState(null);
  if (!stats) return null;
  return (
    <div className="space-y-5" data-testid="manager-stats">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Продано на сумму" value={money(stats.revenue)} testid="stat-revenue" />
        <Kpi label="Прибыль" value={money(stats.profit)} accent={stats.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'} testid="stat-profit" />
        <Kpi label={`Вознаграждение (${stats.commission_percent}%${stats.commission_individual ? ', инд.' : ''})`} value={money(stats.commission)} accent="text-teal-600" testid="stat-commission" />
        <Kpi label="Заказов" value={stats.orders_count} testid="stat-orders" />
        <Kpi label="Клиентов с заказами" value={stats.clients_count} testid="stat-clients" />
      </div>

      {stats.orders_count === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400" data-testid="stats-empty">За выбранный период продаж нет</div>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden" data-testid="stats-by-client">
              <p className="px-4 pt-3 pb-1 font-semibold text-slate-800">По клиентам</p>
              <div className="overflow-x-auto"><table className="w-full">
                <thead><tr><Th>Клиент</Th><Th right>Заказов</Th><Th right>Сумма</Th><Th right>Прибыль</Th></tr></thead>
                <tbody>{stats.by_client.map((c) => (
                  <tr key={c.user_id} className="border-t border-slate-100">
                    <Td><span className="font-medium text-slate-800">{c.name || '—'}</span><span className="block text-[11px] text-slate-400">{c.email}</span></Td>
                    <Td right>{c.orders}</Td><Td right>{money(c.revenue)}</Td><Td right className="text-emerald-600 font-medium">{money(c.profit)}</Td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden" data-testid="stats-by-product">
              <p className="px-4 pt-3 pb-1 font-semibold text-slate-800">По товарам</p>
              <div className="overflow-x-auto max-h-96 overflow-y-auto"><table className="w-full">
                <thead><tr><Th>Товар</Th><Th right>Кол-во</Th><Th right>Сумма</Th><Th right>Прибыль</Th></tr></thead>
                <tbody>{stats.by_product.map((p) => (
                  <tr key={p.product_id} className="border-t border-slate-100">
                    <Td><span className="font-medium text-slate-800">{p.name}</span><span className="block text-[11px] font-mono text-slate-400">{p.article}</span></Td>
                    <Td right>{p.quantity}</Td><Td right>{money(p.revenue)}</Td><Td right className="text-emerald-600 font-medium">{money(p.profit)}</Td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden" data-testid="stats-orders">
            <p className="px-4 pt-3 pb-1 font-semibold text-slate-800">Заказы: что и кому продано</p>
            {stats.orders.map((o) => (
              <div key={o.id} className="border-t border-slate-100">
                <button onClick={() => setOpenOrder(openOrder === o.id ? null : o.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors" data-testid={`stats-order-${o.id}`}>
                  {openOrder === o.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="text-sm font-mono text-slate-500">#{o.id.slice(0, 8)}</span>
                  <span className="text-sm text-slate-800 font-medium flex-1 truncate">{o.client_name || '—'}</span>
                  <span className="text-xs text-slate-400 hidden sm:inline">{fmtDate(o.created_at)}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{STATUS[o.status] || o.status}</span>
                  <span className="text-sm font-semibold text-slate-800 w-24 text-right">{money(o.revenue)}</span>
                  <span className="text-sm font-semibold text-emerald-600 w-24 text-right">{money(o.profit)}</span>
                </button>
                {openOrder === o.id && (
                  <div className="px-11 pb-3 space-y-1">
                    {o.items.map((i, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm text-slate-600">
                        <span className="flex-1 truncate">{i.name} <span className="font-mono text-[11px] text-slate-400">{i.article}</span></span>
                        <span>{i.quantity} шт.</span>
                        <span className="w-24 text-right">{money(i.revenue)}</span>
                        <span className="w-24 text-right text-emerald-600">{money(i.profit)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Shared editor of individual client conditions (admin requests / manager cabinet)
export const ConditionsFields = ({ value, onChange, prefix = 'cond' }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const num = (v) => (v === '' ? '' : Math.max(0, Number(v) || 0));
  const cls = 'mt-1 w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-teal-400';
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="text-[11px] font-semibold text-slate-500">Скидка на все товары, %
        <input type="number" min="0" max="100" value={value.individual_discount ?? ''} onChange={(e) => set('individual_discount', num(e.target.value))} className={cls} data-testid={`${prefix}-discount`} />
      </label>
      <label className="text-[11px] font-semibold text-slate-500">Стоимость доставки, ₽
        <input type="number" min="0" value={value.delivery_cost ?? ''} onChange={(e) => set('delivery_cost', e.target.value === '' ? null : num(e.target.value))} placeholder="как на сайте" className={cls} data-testid={`${prefix}-delivery`} />
      </label>
      <label className="text-[11px] font-semibold text-slate-500">Отсрочка платежа, дней
        <input type="number" min="0" max="365" value={value.deferral_days ?? ''} onChange={(e) => set('deferral_days', num(e.target.value))} className={cls} data-testid={`${prefix}-deferral`} />
      </label>
      <label className="text-[11px] font-semibold text-slate-500">Лимит отгрузки в долг, ₽
        <input type="number" min="0" value={value.credit_limit ?? ''} onChange={(e) => set('credit_limit', num(e.target.value))} className={cls} data-testid={`${prefix}-credit-limit`} />
      </label>
    </div>
  );
};

export const toConditionsPayload = (v) => ({
  individual_discount: Number(v.individual_discount) || 0,
  delivery_cost: v.delivery_cost === '' || v.delivery_cost == null ? null : Number(v.delivery_cost),
  deferral_days: parseInt(v.deferral_days, 10) || 0,
  credit_limit: Number(v.credit_limit) || 0,
});
