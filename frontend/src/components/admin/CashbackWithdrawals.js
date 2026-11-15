import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n || 0);
const STATUS = {
  pending: ['Ожидает', 'bg-amber-50 text-amber-700'],
  paid: ['Выплачено', 'bg-emerald-50 text-emerald-700'],
  rejected: ['Отклонено', 'bg-rose-50 text-rose-700'],
};

export const CashbackWithdrawals = () => {
  const [items, setItems] = useState([]);

  const load = useCallback(() => {
    axios.get(`${API}/admin/rewards/withdrawals`).then((r) => setItems(r.data.withdrawals || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = async (w, status) => {
    try {
      await axios.put(`${API}/admin/rewards/withdrawals/${w.id}`, { status });
      toast.success(status === 'paid' ? 'Отмечено как выплаченное' : 'Заявка отклонена, кэшбэк возвращён клиенту');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
  };

  if (items.length === 0) return <p className="text-sm text-slate-400" data-testid="cashback-withdrawals-empty">Заявок на вывод кэшбэка пока нет.</p>;

  return (
    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100" data-testid="admin-cashback-withdrawals">
      {items.map((w) => (
        <div key={w.id} className="flex items-start gap-4 px-4 py-3 flex-wrap" data-testid={`admin-withdrawal-${w.id}`}>
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-semibold text-slate-800">{w.user_name || w.user_email} <span className="font-normal text-slate-400">· {new Date(w.created_at).toLocaleDateString('ru-RU')}</span></p>
            <p className="text-xs text-slate-500 whitespace-pre-wrap break-words">{w.details}</p>
          </div>
          <span className="font-bold tabular-nums text-slate-900">{fmt(w.amount)} ₽</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS[w.status][1]}`}>{STATUS[w.status][0]}</span>
          {w.status === 'pending' && (
            <div className="flex gap-2">
              <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => update(w, 'paid')} data-testid={`admin-withdrawal-${w.id}-paid`}>Выплачено</Button>
              <Button size="sm" variant="outline" className="rounded-xl text-rose-600" onClick={() => update(w, 'rejected')} data-testid={`admin-withdrawal-${w.id}-reject`}>Отклонить</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
