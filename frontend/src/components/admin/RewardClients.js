import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n || 0);
const LABELS = { points: 'Бонусные баллы', ozon: 'Сертификаты Ozon', cashback: 'Кэшбэк' };

export const RewardClients = () => {
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ users: [], counts: {} });

  const load = useCallback(() => {
    axios.get(`${API}/admin/rewards/users`, { params: { search } }).then((r) => setData(r.data)).catch(() => {});
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const setSystem = async (u, reward_system) => {
    try {
      await axios.put(`${API}/admin/rewards/users/${u.id}`, { reward_system: reward_system || null });
      toast.success('Бонусная система клиента изменена');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
  };

  const adjustCashback = async (u) => {
    const raw = window.prompt(`Корректировка кэшбэка для ${u.name || u.email}.\nВведите сумму (отрицательная — списать):`);
    if (!raw) return;
    try {
      await axios.post(`${API}/admin/rewards/users/${u.id}/cashback`, { amount: Number(raw.replace(',', '.')) });
      toast.success('Кэшбэк скорректирован');
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
  };

  return (
    <div data-testid="reward-clients">
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input placeholder="Поиск по имени или email" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl pl-9" data-testid="reward-clients-search" />
        </div>
        {Object.entries(LABELS).map(([k, label]) => (
          <span key={k} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600" data-testid={`reward-clients-count-${k}`}>
            {label}: <b>{data.counts[k] || 0}</b>
          </span>
        ))}
      </div>
      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[480px] overflow-auto">
        {data.users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap" data-testid={`reward-client-${u.id}`}>
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-semibold text-slate-800">{u.name || '—'}</p>
              <p className="text-xs text-slate-400">{u.email} · {u.customer_status === 'wholesale' ? 'опт' : 'розница'}</p>
            </div>
            {u.reward_system === 'cashback' && (
              <Button type="button" variant="outline" size="sm" className="rounded-xl tabular-nums" onClick={() => adjustCashback(u)} data-testid={`reward-client-${u.id}-cashback`}>
                {fmt(u.cashback_balance)} ₽
              </Button>
            )}
            <select value={u.reward_system || ''} onChange={(e) => setSystem(u, e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm" data-testid={`reward-client-${u.id}-system`}>
              <option value="">Не выбрана (клиент выберет сам)</option>
              {Object.entries(LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        ))}
        {data.users.length === 0 && <p className="px-4 py-6 text-sm text-slate-400">Клиенты не найдены</p>}
      </div>
    </div>
  );
};
