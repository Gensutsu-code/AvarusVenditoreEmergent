import { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Award, Gift, Wallet, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n);

const META = {
  points: {
    icon: Award, tint: 'bg-amber-50 text-amber-600', ring: 'hover:border-amber-400',
    headline: () => 'Баллы за каждый заказ',
    bullets: (o) => [
      'Копите баллы и обменивайте их на призы из каталога',
      'Уровни программы повышают начисление',
      o.percent !== 100 ? `Коэффициент начисления: ${o.percent}%` : 'Оплата доставки баллами',
    ],
  },
  ozon: {
    icon: Gift, tint: 'bg-indigo-50 text-indigo-600', ring: 'hover:border-indigo-400',
    headline: (o) => `${o.percent}% от заказа сертификатом Ozon`,
    bullets: () => ['Сертификат выдаётся после выполнения заказа', 'Тратьте на любые товары Ozon', 'Менеджер пришлёт код сертификата'],
  },
  cashback: {
    icon: Wallet, tint: 'bg-emerald-50 text-emerald-600', ring: 'hover:border-emerald-400',
    headline: (o) => `${o.percent}% от заказа возвращается рублями`,
    bullets: (o) => [
      'Кэшбэк начисляется после выполнения заказа',
      o.allow_pay ? `Оплачивайте кэшбэком до ${o.max_pay_percent}% следующих заказов` : null,
      o.allow_withdraw ? `Вывод деньгами по заявке от ${fmt(o.min_withdraw)} ₽` : null,
    ].filter(Boolean),
  },
};

export const RewardChooser = ({ options = [], onChosen }) => {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/rewards/choose`, { system: pending.key });
      toast.success(`Вы выбрали: ${pending.title}`);
      setPending(null);
      onChosen();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="reward-chooser">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Вознаграждение за заказы</p>
      <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 max-w-2xl">Выберите свою бонусную систему</h1>
      <p className="mt-3 text-base text-slate-500 max-w-xl flex items-start gap-2">
        <Lock className="w-4 h-4 mt-1 flex-shrink-0" />
        Выбор делается один раз. Изменить систему позже сможет только менеджер.
      </p>

      {options.length === 0 && (
        <p className="mt-10 text-slate-500" data-testid="reward-chooser-empty">Сейчас нет доступных бонусных систем.</p>
      )}

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
        {options.map((o, idx) => {
          const m = META[o.key];
          const Icon = m.icon;
          return (
            <motion.div
              key={o.key}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.08 }}
              className={`flex flex-col bg-white border-2 border-slate-200 rounded-2xl p-6 transition-colors duration-200 ${m.ring}`}
              data-testid={`reward-option-${o.key}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${m.tint}`}><Icon className="w-6 h-6" /></div>
              <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-900">{o.title}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-700">{m.headline(o)}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 flex-1">
                {m.bullets(o).map((b) => (
                  <li key={b} className="flex gap-2"><Check className="w-4 h-4 mt-0.5 text-teal-500 flex-shrink-0" />{b}</li>
                ))}
                {o.min_order > 0 && <li className="flex gap-2 text-slate-500"><Check className="w-4 h-4 mt-0.5 text-slate-300 flex-shrink-0" />Начисление при заказе от {fmt(o.min_order)} ₽</li>}
                {o.tiers.map((t) => (
                  <li key={t.from} className="flex gap-2 text-slate-500"><Check className="w-4 h-4 mt-0.5 text-slate-300 flex-shrink-0" />От {fmt(t.from)} ₽ — {t.percent}%</li>
                ))}
              </ul>
              <Button onClick={() => setPending(o)} className="mt-6 rounded-full bg-slate-900 hover:bg-teal-600 text-white" data-testid={`reward-choose-btn-${o.key}`}>
                Выбрать
              </Button>
            </motion.div>
          );
        })}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <AlertDialogContent data-testid="reward-choose-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Выбрать «{pending?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Все ваши будущие заказы будут вознаграждаться только по этой системе. Самостоятельно изменить выбор будет нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="reward-choose-cancel">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirm(); }} disabled={busy} data-testid="reward-choose-confirm-btn">
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
