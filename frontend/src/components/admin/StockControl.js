import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Stock check (product total vs sum over warehouses) and the shop-wide minimum stock
export const StockControl = ({ defaultMin, onChanged }) => {
  const [check, setCheck] = useState(null);
  const [minValue, setMinValue] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => axios.get(`${API}/admin/warehouse/reconcile`).then((r) => setCheck(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setMinValue(defaultMin ?? ''); }, [defaultMin]);

  const fix = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/admin/warehouse/reconcile`);
      toast.success(`Исправлено товаров: ${res.data.fixed}`);
      load(); onChanged();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setBusy(false); }
  };

  const saveMin = async () => {
    if (String(minValue) === String(defaultMin ?? '')) return;
    try {
      await axios.put(`${API}/admin/warehouse/settings`, { default_min_stock: minValue });
      toast.success('Минимальный остаток по умолчанию сохранён');
      onChanged();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); setMinValue(defaultMin ?? ''); }
  };

  const bad = check?.items || [];
  return (
    <div className="grid md:grid-cols-2 gap-3 mb-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="stock-check-card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {bad.length === 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-rose-500" />}
            <div>
              <p className="font-semibold text-slate-800 text-sm">Сверка остатков</p>
              <p className="text-xs text-slate-500" data-testid="stock-check-status">{check === null ? 'Проверка…' : bad.length === 0 ? 'Расхождений нет: остатки совпадают с суммой по складам' : `Расхождений: ${bad.length}`}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} className="rounded-lg" data-testid="stock-check-refresh">Проверить</Button>
            {bad.length > 0 && <Button size="sm" onClick={fix} disabled={busy} className="bg-rose-500 hover:bg-rose-600 text-white rounded-lg" data-testid="stock-check-fix">Исправить по складам</Button>}
          </div>
        </div>
        {bad.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2 text-sm space-y-1">
            {bad.map((m) => (
              <div key={m.product_id} className="flex justify-between gap-3" data-testid={`stock-mismatch-${m.product_id}`}>
                <span className="truncate text-slate-700">{m.name} <span className="text-xs text-slate-400">{m.article}</span></span>
                <span className="whitespace-nowrap text-slate-500">в карточке {m.stock} · на складах <b className="text-slate-800">{m.warehouses_total}</b></span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap" data-testid="default-min-card">
        <div>
          <p className="font-semibold text-slate-800 text-sm">Минимальный остаток по умолчанию</p>
          <p className="text-xs text-slate-500">Действует для товаров без своего минимума. 0 — не отслеживать.</p>
        </div>
        <Input type="number" min="0" value={minValue} onChange={(e) => setMinValue(e.target.value)} onBlur={saveMin} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} className="rounded-xl w-24 text-right" data-testid="default-min-input" />
      </div>
    </div>
  );
};
