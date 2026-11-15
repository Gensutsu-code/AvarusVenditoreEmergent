import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ROWS = [
  { key: 'discount', label: 'Скидка на все товары, %', max: 100 },
  { key: 'delivery_cost', label: 'Стоимость доставки, ₽', nullable: true, placeholder: 'как в «Доставка»' },
  { key: 'deferral_days', label: 'Отсрочка платежа, дней', max: 365 },
  { key: 'credit_limit', label: 'Лимит отгрузки в долг, ₽' },
];

// Standard conditions for every client status and for managers (site settings)
export const StatusConditionsSettings = ({ isDark = false }) => {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => axios.get(`${API}/admin/status-conditions`).then((r) => setData(r.data)).catch(() => toast.error('Не удалось загрузить условия')), []);
  useEffect(() => { load(); }, [load]);

  const set = (status, key, raw, nullable) => setData({ ...data, [status]: { ...data[status], [key]: raw === '' ? (nullable ? null : 0) : Math.max(0, Number(raw) || 0) } });
  const save = async () => {
    setSaving(true);
    try { const r = await axios.put(`${API}/admin/status-conditions`, data); setData(r.data); toast.success('Стандартные условия сохранены'); }
    catch (e) { const d = e.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Проверьте значения'); }
    finally { setSaving(false); }
  };

  if (!data) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-500" /></div>;
  const card = `rounded-xl border p-4 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`;
  const input = `mt-1 w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:border-teal-400 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200'}`;
  const title = `font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`;

  return (
    <div className="max-w-4xl" data-testid="status-conditions-settings">
      <p className="text-sm text-slate-400 mb-4">Стандартные условия действуют для всех клиентов статуса. Индивидуальные условия из карточки клиента или менеджера важнее стандартных. Новый клиент получает статус «Розничный»; «Оптовый» — после одобрения запроса на индивидуальные условия.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {[['retail', 'Розничный клиент'], ['wholesale', 'Оптовый клиент']].map(([status, name]) => (
          <div key={status} className={card} data-testid={`status-conditions-${status}`}>
            <p className={title}>{name}</p>
            <div className="grid grid-cols-2 gap-3">
              {ROWS.map((r) => (
                <label key={r.key} className="text-[11px] font-semibold text-slate-500">{r.label}
                  <input type="number" min="0" max={r.max} value={data[status][r.key] ?? ''} placeholder={r.placeholder} onChange={(e) => set(status, r.key, e.target.value, r.nullable)} className={input} data-testid={`status-${status}-${r.key}`} />
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className={card} data-testid="status-conditions-manager">
          <p className={title}>Менеджер</p>
          <label className="text-[11px] font-semibold text-slate-500">Вознаграждение: процент от прибыли по заказам его клиентов, %
            <input type="number" min="0" max="100" value={data.manager.commission_percent ?? 0} onChange={(e) => set('manager', 'commission_percent', e.target.value)} className={input} data-testid="status-manager-commission" />
          </label>
          <p className="text-[11px] text-slate-400 mt-2">Индивидуальный процент задаётся в карточке менеджера на странице «Сотрудники».</p>
        </div>
      </div>
      <Button onClick={save} disabled={saving} className="mt-4 bg-teal-500 hover:bg-teal-600 text-white" data-testid="status-conditions-save"><Save className="w-4 h-4 mr-2" />{saving ? 'Сохранение…' : 'Сохранить'}</Button>
    </div>
  );
};

export default StatusConditionsSettings;
