import { useState } from 'react';
import axios from 'axios';
import { Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { RewardTerms } from './OzonRewardView';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const W_STATUS = {
  pending: ['На рассмотрении', 'bg-amber-50 text-amber-700'],
  paid: ['Выплачено', 'bg-emerald-50 text-emerald-700'],
  rejected: ['Отклонено', 'bg-rose-50 text-rose-700'],
};

const WithdrawForm = ({ config, balance, reload }) => {
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await axios.post(`${API}/rewards/cashback/withdraw`, { amount: Number(amount), details });
      toast.success('Заявка на вывод отправлена');
      setAmount(''); setDetails('');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3" data-testid="cashback-withdraw-form">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">Вывод деньгами</h2>
      <p className="text-sm text-slate-500">Минимальная сумма — {fmt(config.min_withdraw)} ₽. Выплата выполняется менеджером по заявке.</p>
      <Input type="number" min="0" step="0.01" max={balance} placeholder="Сумма, ₽" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-xl" data-testid="cashback-withdraw-amount" />
      <Textarea placeholder="Реквизиты: номер карты или счёта, банк, получатель" value={details} onChange={(e) => setDetails(e.target.value)} className="rounded-xl" rows={3} data-testid="cashback-withdraw-details" />
      <Button type="submit" disabled={busy || !amount || !details.trim()} className="rounded-full bg-slate-900 hover:bg-emerald-600 text-white" data-testid="cashback-withdraw-submit">
        Отправить заявку
      </Button>
    </form>
  );
};

export const CashbackView = ({ info, reload }) => {
  const { config, transactions = [], withdrawals = [] } = info;
  return (
    <div data-testid="cashback-view">
      <div className="rounded-3xl bg-emerald-950 text-white p-8 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 flex items-center gap-2"><Wallet className="w-4 h-4" />Ваша бонусная система — кэшбэк</p>
        <h1 className="mt-3 text-5xl sm:text-6xl font-black tracking-tighter tabular-nums" data-testid="cashback-balance">{fmt(info.cashback_balance)} ₽</h1>
        <p className="mt-1 text-sm text-emerald-300">
          Доступно на счёте кэшбэка{config.allow_pay ? ` · можно оплатить до ${config.max_pay_percent}% заказа в корзине` : ''}
        </p>
        <RewardTerms config={config} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">История операций</h2>
          {transactions.length === 0 ? (
            <p className="mt-3 text-slate-500" data-testid="cashback-tx-empty">Кэшбэк начислится после выполнения первого заказа.</p>
          ) : (
            <div className="mt-4 bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5" data-testid={`cashback-tx-${t.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {t.amount > 0 ? <ArrowDownLeft className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <ArrowUpRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.description}</p>
                      <p className="text-xs text-slate-400">{fmtDate(t.created_at)}</p>
                    </div>
                  </div>
                  <span className={`font-bold tabular-nums whitespace-nowrap ${t.amount > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {t.amount > 0 ? '+' : ''}{fmt(t.amount)} ₽
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {config.allow_withdraw && <WithdrawForm config={config} balance={info.cashback_balance} reload={reload} />}
          {withdrawals.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6" data-testid="cashback-withdrawals">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 mb-3">Заявки на вывод</h2>
              <div className="space-y-2">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 text-sm" data-testid={`cashback-withdrawal-${w.id}`}>
                    <span className="text-slate-500">{fmtDate(w.created_at)}</span>
                    <span className="font-semibold tabular-nums text-slate-800">{fmt(w.amount)} ₽</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${W_STATUS[w.status][1]}`}>{W_STATUS[w.status][0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
