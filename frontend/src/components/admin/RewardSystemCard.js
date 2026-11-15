import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { RewardRulesEditor } from './RewardRulesEditor';

const lbl = 'text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block';

const NumField = ({ label, hint, value, onChange, testid, step = '0.1' }) => (
  <div>
    <Label className={lbl}>{label}</Label>
    <Input type="number" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className="rounded-xl" data-testid={testid} />
    {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
  </div>
);

const ToggleRow = ({ label, hint, checked, onChange, testid }) => (
  <label className="flex items-start justify-between gap-4 p-3 rounded-xl border border-slate-200 cursor-pointer">
    <span>
      <span className="text-sm font-semibold text-slate-800 block">{label}</span>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </span>
    <Switch checked={checked} onCheckedChange={onChange} data-testid={testid} />
  </label>
);

export const RewardSystemCard = ({ systemKey: k, title, cfg, targets, onChange }) => {
  const set = (patch) => onChange({ ...cfg, ...patch });
  const isPoints = k === 'points';
  const rateLabel = isPoints ? 'коэффициент, %' : '% от заказа';
  const setTier = (i, patch) => set({ tiers: cfg.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });

  return (
    <div className="space-y-6" data-testid={`reward-system-${k}`}>
      <ToggleRow
        label={`Система «${title}» включена`}
        hint="Отключённую систему нельзя выбрать, начисления по ней приостанавливаются"
        checked={cfg.enabled}
        onChange={(v) => set({ enabled: v })}
        testid={`reward-${k}-enabled`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NumField label={`Розница — ${rateLabel}`} value={cfg.retail_percent} onChange={(v) => set({ retail_percent: v })} testid={`reward-${k}-retail-percent`}
          hint={isPoints ? '100% = полное начисление по правилам программы' : 'Доля суммы товаров, идущая в вознаграждение'} />
        <NumField label={`Опт — ${rateLabel}`} value={cfg.wholesale_percent} onChange={(v) => set({ wholesale_percent: v })} testid={`reward-${k}-wholesale-percent`} />
        <NumField label="Мин. сумма заказа, ₽" step="1" value={cfg.min_order} onChange={(v) => set({ min_order: v })} testid={`reward-${k}-min-order`} hint="Ниже этой суммы вознаграждение не начисляется" />
      </div>

      {k === 'ozon' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumField label="Номинал сертификата кратен, ₽" step="1" value={cfg.round_to} onChange={(v) => set({ round_to: v })} testid="reward-ozon-round-to" hint="Сумма округляется вниз, например до 500 ₽" />
        </div>
      )}

      {k === 'cashback' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ToggleRow label="Оплата заказов кэшбэком" hint="Клиент списывает кэшбэк в корзине" checked={cfg.allow_pay} onChange={(v) => set({ allow_pay: v })} testid="reward-cashback-allow-pay" />
          <ToggleRow label="Вывод деньгами по заявке" hint="Заявки появляются на вкладке «Вывод кэшбэка»" checked={cfg.allow_withdraw} onChange={(v) => set({ allow_withdraw: v })} testid="reward-cashback-allow-withdraw" />
          <NumField label="Макс. доля оплаты заказа кэшбэком, %" value={cfg.max_pay_percent} onChange={(v) => set({ max_pay_percent: v })} testid="reward-cashback-max-pay-percent" />
          <NumField label="Мин. сумма вывода, ₽" step="1" value={cfg.min_withdraw} onChange={(v) => set({ min_withdraw: v })} testid="reward-cashback-min-withdraw" />
        </div>
      )}

      <ToggleRow
        label="Не начислять на товары со скидкой"
        hint="Акционные товары, индивидуальные цены, скидка на корзину и заказы с промокодом"
        checked={cfg.exclude_discounted}
        onChange={(v) => set({ exclude_discounted: v })}
        testid={`reward-${k}-exclude-discounted`}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Пороги по сумме заказа</h3>
            <p className="text-xs text-slate-500">Повышенная (или иная) ставка для крупных заказов — заменяет базовую</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => set({ tiers: [...cfg.tiers, { from: 50000, retail_percent: cfg.retail_percent, wholesale_percent: cfg.wholesale_percent }] })} data-testid={`reward-${k}-add-tier`}>
            <Plus className="w-4 h-4 mr-1" />Порог
          </Button>
        </div>
        {cfg.tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end mb-2" data-testid={`reward-${k}-tier-${i}`}>
            <NumField label="Заказ от, ₽" step="1" value={t.from} onChange={(v) => setTier(i, { from: v })} testid={`reward-${k}-tier-${i}-from`} />
            <NumField label="Розница, %" value={t.retail_percent} onChange={(v) => setTier(i, { retail_percent: v })} testid={`reward-${k}-tier-${i}-retail`} />
            <NumField label="Опт, %" value={t.wholesale_percent} onChange={(v) => setTier(i, { wholesale_percent: v })} testid={`reward-${k}-tier-${i}-wholesale`} />
            <Button type="button" variant="ghost" size="icon" className="text-rose-500" onClick={() => set({ tiers: cfg.tiers.filter((_, idx) => idx !== i) })} data-testid={`reward-${k}-tier-${i}-delete`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <RewardRulesEditor systemKey={k} rules={cfg.rules} targets={targets} rateLabel={rateLabel} onChange={(rules) => set({ rules })} />
    </div>
  );
};
