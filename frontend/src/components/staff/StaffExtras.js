import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DatePicker } from '../DatePicker';
import { money } from './ManagerStats';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const COLORS = ['#0d9488', '#f59e0b', '#6366f1', '#e11d48', '#0ea5e9', '#84cc16', '#a855f7', '#f97316'];
const monthLabel = (k) => new Date(`${k}-01`).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
const err = (e) => { const d = e.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Проверьте заполнение полей'); };

// Monthly goods revenue of every manager, side by side
export const StaffSalesChart = () => {
  const [chart, setChart] = useState(null);
  useEffect(() => { axios.get(`${API}/admin/staff-chart`, { params: { months: 12 } }).then((r) => setChart(r.data)).catch(() => {}); }, []);
  if (!chart || !chart.managers.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mt-5" data-testid="staff-sales-chart">
      <p className="font-semibold text-slate-800">Продажи менеджеров по месяцам</p>
      <p className="text-xs text-slate-400 mb-3">Сумма товаров в заказах клиентов менеджера за последние 12 месяцев, без отменённых заказов и доставки</p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart.data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tickFormatter={(v) => new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(v)} tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip formatter={(v) => money(v)} labelFormatter={monthLabel} />
            <Legend />
            {chart.managers.map((m, i) => <Bar key={m.id} dataKey={m.id} name={m.name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Commission earned / paid / still owed + the list of payouts
export const PayoutsPanel = ({ managerId }) => {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ amount: '', paid_at: '', comment: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => axios.get(`${API}/admin/staff/${managerId}/payouts`).then((r) => setData(r.data)).catch(err), [managerId]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  const add = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error('Укажите сумму выплаты'); return; }
    if (amount > data.balance && !window.confirm('Сумма больше остатка к выплате. Всё равно записать?')) return;
    setBusy(true);
    try { await axios.post(`${API}/admin/staff/${managerId}/payouts`, { amount, paid_at: form.paid_at || null, comment: form.comment }); toast.success('Выплата записана'); setForm({ amount: '', paid_at: '', comment: '' }); load(); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const cancel = async (p) => {
    if (!window.confirm(`Отменить выплату ${money(p.amount)}?`)) return;
    try { await axios.delete(`${API}/admin/staff/${managerId}/payouts/${p.id}`); toast.success('Выплата отменена'); load(); } catch (e) { err(e); }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mt-5" data-testid="payouts-panel">
      <p className="font-semibold text-slate-800 mb-3">Вознаграждение и выплаты</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] uppercase font-semibold text-slate-400">Начислено за всё время</p><p className="text-lg font-bold text-slate-800" data-testid="payouts-earned">{money(data.earned)}</p></div>
        <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] uppercase font-semibold text-slate-400">Выплачено</p><p className="text-lg font-bold text-slate-800" data-testid="payouts-paid">{money(data.paid)}</p></div>
        <div className="rounded-lg bg-amber-50 p-3"><p className="text-[11px] uppercase font-semibold text-amber-600">Осталось выплатить</p><p className="text-lg font-bold text-amber-700" data-testid="payouts-balance">{money(data.balance)}</p></div>
      </div>
      <div className="grid sm:grid-cols-4 gap-2 items-end">
        <label className="text-[11px] font-semibold text-slate-500">Сумма, ₽<Input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" data-testid="payout-amount-input" /></label>
        <div className="text-[11px] font-semibold text-slate-500">Дата<DatePicker value={form.paid_at} onChange={(v) => setForm({ ...form, paid_at: v })} placeholder="Сегодня" disablePast={false} data-testid="payout-date" /></div>
        <label className="text-[11px] font-semibold text-slate-500">Комментарий<Input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} maxLength={300} className="mt-1" data-testid="payout-comment-input" /></label>
        <Button onClick={add} disabled={busy} className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="payout-add-btn"><Plus className="w-4 h-4 mr-1" />Записать выплату</Button>
      </div>
      <div className="mt-4 space-y-1.5" data-testid="payouts-list">
        {data.payouts.length === 0 && <p className="text-sm text-slate-400">Выплат пока не было</p>}
        {data.payouts.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm" data-testid={`payout-${p.id}`}>
            <span className="text-slate-500 w-24">{new Date(p.paid_at).toLocaleDateString('ru-RU')}</span>
            <span className="font-semibold text-slate-800 w-28">{money(p.amount)}</span>
            <span className="flex-1 text-slate-500 truncate">{p.comment}</span>
            <button onClick={() => cancel(p)} className="p-1 text-slate-400 hover:text-rose-500" title="Отменить выплату" data-testid={`payout-cancel-${p.id}`}><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};
