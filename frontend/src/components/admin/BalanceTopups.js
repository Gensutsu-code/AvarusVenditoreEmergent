import { useCallback, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useLive } from '../../lib/live';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const EMPTY = { card_number: '', recipient_name: '', bank: '', comment: '' };
const FIELDS = [['card_number', 'Номер карты'], ['recipient_name', 'Получатель'], ['bank', 'Банк'], ['comment', 'Комментарий']];

const TopupRow = ({ t, isDark, onDone }) => {
  const [req, setReq] = useState({ ...EMPTY, ...(t.requisites || {}) });
  const [busy, setBusy] = useState(false);
  const act = async (action, body, ok) => {
    setBusy(true);
    try { await axios.post(`${API}/admin/balance-topups/${t.id}/${action}`, body); toast.success(ok); onDone(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setBusy(false); }
  };
  const isCard = t.method === 'card';
  return (
    <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'border-zinc-700/50 bg-zinc-800/50' : 'border-zinc-200 bg-white'}`} data-testid={`topup-request-${t.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{t.user_name || t.user_email} — {Number(t.amount).toLocaleString('ru-RU')} ₽</p>
          <p className="text-xs text-zinc-500">{t.user_email} · {t.description} · {new Date(t.created_at).toLocaleString('ru-RU')}</p>
          {t.tx_hash && <p className="text-xs font-mono break-all text-zinc-500">Транзакция: {t.tx_hash}</p>}
        </div>
        <span className="text-xs font-semibold text-amber-600">{isCard && !t.requisites ? 'Ждёт реквизиты' : 'Ждёт подтверждения'}</span>
      </div>
      {isCard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FIELDS.map(([key, label]) => (
            <Input key={key} value={req[key] || ''} placeholder={label} onChange={(e) => setReq({ ...req, [key]: e.target.value })}
              className={isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''} data-testid={`topup-${key}-${t.id}`} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {isCard && <Button size="sm" variant="outline" disabled={busy} onClick={() => act('requisites', req, 'Реквизиты выданы клиенту')} data-testid={`topup-issue-${t.id}`}>{t.requisites ? 'Обновить реквизиты' : 'Выдать реквизиты'}</Button>}
        <Button size="sm" disabled={busy} className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => act('confirm', {}, 'Баланс клиента пополнен')} data-testid={`topup-confirm-${t.id}`}>Деньги получены — зачислить</Button>
        <Button size="sm" variant="outline" disabled={busy} className="text-rose-600" onClick={() => act('reject', {}, 'Заявка отклонена')} data-testid={`topup-reject-${t.id}`}>Отклонить</Button>
      </div>
    </div>
  );
};

// Admin: top-up requests wait here until the money is really received
export const BalanceTopups = ({ isDark = false }) => {
  const [items, setItems] = useState([]);
  const load = useCallback(() => axios.get(`${API}/admin/balance-topups`).then((r) => setItems(r.data)).catch(() => {}), []);
  useLive(load, 15000);
  return (
    <div className="space-y-3" data-testid="balance-topups">
      <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>Заявки на пополнение баланса</h3>
      <p className="text-sm text-zinc-500">Баланс клиента меняется только после кнопки «Деньги получены — зачислить».</p>
      {items.length === 0 && <p className="text-sm text-zinc-400" data-testid="balance-topups-empty">Новых заявок нет</p>}
      {items.map((t) => <TopupRow key={t.id} t={t} isDark={isDark} onDone={load} />)}
    </div>
  );
};
