import { Gift, CheckCircle, Clock } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export const RewardTerms = ({ config }) => (
  <div className="flex flex-wrap gap-2 mt-4" data-testid="reward-terms">
    <span className="px-3 py-1 rounded-full bg-white/15 text-sm font-medium">{config.percent}% от суммы заказа</span>
    {config.min_order > 0 && <span className="px-3 py-1 rounded-full bg-white/15 text-sm font-medium">при заказе от {fmt(config.min_order)} ₽</span>}
    {config.tiers.map((t) => (
      <span key={t.from} className="px-3 py-1 rounded-full bg-white/15 text-sm font-medium">от {fmt(t.from)} ₽ — {t.percent}%</span>
    ))}
    {config.exclude_discounted && <span className="px-3 py-1 rounded-full bg-white/15 text-sm font-medium">кроме товаров со скидкой</span>}
  </div>
);

export const OzonRewardView = ({ info }) => {
  const certs = info.certificates || [];
  return (
    <div data-testid="ozon-reward-view">
      <div className="rounded-3xl bg-indigo-950 text-white p-8 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300 flex items-center gap-2"><Gift className="w-4 h-4" />Ваша бонусная система</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tighter">Сертификаты Ozon</h1>
        <RewardTerms config={info.config} />
        <div className="mt-8 grid grid-cols-2 gap-6 max-w-md">
          <div>
            <p className="text-sm text-indigo-300">Ожидают выдачи</p>
            <p className="text-3xl font-black tabular-nums" data-testid="ozon-pending-total">{fmt(info.certificates_pending)} ₽</p>
          </div>
          <div>
            <p className="text-sm text-indigo-300">Выдано</p>
            <p className="text-3xl font-black tabular-nums" data-testid="ozon-issued-total">{fmt(info.certificates_issued)} ₽</p>
          </div>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-bold tracking-tight text-slate-900">Сертификаты по заказам</h2>
      {certs.length === 0 ? (
        <p className="mt-3 text-slate-500" data-testid="ozon-certs-empty">Сертификат появится здесь после выполнения заказа.</p>
      ) : (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {certs.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-4" data-testid={`ozon-cert-row-${c.id}`}>
              <div>
                <p className="text-sm font-semibold text-slate-800">Заказ #{c.id.slice(0, 8)}</p>
                <p className="text-xs text-slate-400">{fmtDate(c.created_at)} · {fmt(c.total)} ₽</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-indigo-600 tabular-nums">{fmt(c.ozon_certificate)} ₽</p>
                {c.ozon_certificate_issued ? (
                  <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Выдан</span>
                ) : (
                  <span className="text-xs text-amber-600 inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Ожидает выдачи</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
