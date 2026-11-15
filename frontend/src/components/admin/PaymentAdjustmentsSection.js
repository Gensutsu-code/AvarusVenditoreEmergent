import { CreditCard, DollarSign, Bitcoin, Wallet, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const METHODS = [
  { key: 'card', label: 'Банковская карта', icon: CreditCard },
  { key: 'cash', label: 'Наличные', icon: DollarSign },
  { key: 'crypto', label: 'Криптовалюта', icon: Bitcoin },
  { key: 'balance', label: 'С баланса', icon: Wallet },
];

// Скидка/наценка за способ оплаты (отрицательное значение — скидка)
export const PaymentAdjustmentsSection = ({ isDark = false, paymentSettings, setPaymentSettings, onSave }) => (
  <div className="max-w-3xl" data-testid="payment-adjustments-section">
    <p className="text-sm text-slate-400 mb-4">
      Отрицательное значение — скидка, положительное — наценка. Применяется к каждому товару заказа; цена товара не опускается ниже его минимальной цены.
    </p>
    <div className="grid sm:grid-cols-2 gap-3">
      {METHODS.map(({ key, label, icon: Icon }) => {
        const field = `${key}_adjustment`;
        const val = Number(paymentSettings[field]) || 0;
        const enabled = paymentSettings[`${key}_enabled`] !== false;
        return (
          <div key={key} className={`rounded-xl border p-4 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`} data-testid={`payment-adjustment-card-${key}`}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4 text-teal-500" />
              <span className={`font-semibold text-sm ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{label}</span>
              {!enabled && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">способ выключен</span>}
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number" min="-90" max="100" step="0.5"
                value={paymentSettings[field] ?? 0}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, [field]: e.target.value === '' ? 0 : Math.max(-90, Math.min(100, parseFloat(e.target.value) || 0)) })}
                className={`w-28 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200'}`}
                data-testid={`payment-adjustment-input-${key}`}
              />
              <span className={`text-sm font-semibold ${val < 0 ? 'text-emerald-600' : val > 0 ? 'text-rose-600' : 'text-slate-400'}`} data-testid={`payment-adjustment-label-${key}`}>
                {val < 0 ? `Скидка ${Math.abs(val)}%` : val > 0 ? `Наценка +${val}%` : 'Без изменений'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
    <Button onClick={onSave} className="mt-4 bg-teal-500 hover:bg-teal-600 text-white" data-testid="payment-adjustments-save-btn">
      <Save className="w-4 h-4 mr-2" />Сохранить
    </Button>
  </div>
);

export default PaymentAdjustmentsSection;
