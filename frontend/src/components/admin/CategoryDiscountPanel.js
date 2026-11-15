import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Layers, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DatePicker } from '../DatePicker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const empty = { category_id: '', discount_type: 'percent', discount_value: '', discount_until: '', discount_label: '' };

// One discount for every product of a category (with its subcategories)
export const CategoryDiscountPanel = ({ isDark = false, onDone }) => {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !categories.length) axios.get(`${API}/categories`).then((r) => setCategories(r.data || [])).catch(() => {});
  }, [open, categories.length]);

  const labelCls = `text-xs font-semibold uppercase ${isDark ? 'text-zinc-400' : 'text-slate-500'}`;
  const inputCls = `mt-1.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200'}`;
  const catName = categories.find((c) => c.id === form.category_id)?.name || '';

  const run = async (action) => {
    if (!form.category_id) { toast.error('Выберите категорию'); return; }
    if (action === 'apply') {
      const v = Number(form.discount_value);
      if (!v || v <= 0 || (form.discount_type === 'percent' && v > 90)) { toast.error('Скидка: от 1 до 90% или сумма больше 0'); return; }
      if (!form.discount_until) { toast.error('Укажите дату окончания акции'); return; }
    }
    const question = action === 'apply'
      ? `Применить скидку ко всем товарам категории «${catName}»? Текущие скидки этих товаров будут заменены.`
      : `Убрать скидки со всех товаров категории «${catName}»?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/admin/products/category-discount`, { ...form, action, discount_value: Number(form.discount_value) || 0, discount_until: form.discount_until || null });
      toast.success(action === 'apply' ? `Скидка применена, товаров: ${r.data.matched_count}` : `Скидки убраны, товаров: ${r.data.matched_count}`);
      if (onDone) onDone();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="border-rose-200 text-rose-600 hover:bg-rose-50" data-testid="category-discount-open-btn">
        <Layers className="w-4 h-4 mr-1.5" />Скидка на категорию
      </Button>
    );
  }

  return (
    <div className={`w-full rounded-2xl border p-4 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-rose-50/50 border-rose-200'}`} data-testid="category-discount-panel">
      <div className="flex items-center justify-between mb-3">
        <p className={`font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}><Layers className="w-4 h-4 text-rose-500" />Скидка на всю категорию</p>
        <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600" data-testid="category-discount-close-btn"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-slate-500 mb-3">Скидка применится ко всем товарам категории и её подкатегорий. Цена товара не опустится ниже его минимальной цены.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <Label className={labelCls}>Категория</Label>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={`mt-1.5 w-full h-10 rounded-md border px-3 text-sm focus:outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200 bg-white'}`} data-testid="category-discount-category">
            <option value="">— выберите —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label className={labelCls}>Тип</Label>
          <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className={`mt-1.5 w-full h-10 rounded-md border px-3 text-sm focus:outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200 bg-white'}`} data-testid="category-discount-type">
            <option value="percent">Процент (%)</option>
            <option value="amount">Сумма (₽)</option>
          </select>
        </div>
        <div>
          <Label className={labelCls}>Значение {form.discount_type === 'amount' ? '(₽)' : '(%)'}</Label>
          <Input type="number" min="0" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === 'amount' ? '500' : '10'} className={inputCls} data-testid="category-discount-value" />
        </div>
        <div>
          <Label className={labelCls}>Действует до</Label>
          <DatePicker value={form.discount_until} onChange={(v) => setForm({ ...form, discount_until: v })} isDark={isDark} data-testid="category-discount-until" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label className={labelCls}>Название акции (необязательно)</Label>
          <Input value={form.discount_label} onChange={(e) => setForm({ ...form, discount_label: e.target.value })} placeholder="Например: Неделя фильтров" maxLength={60} className={inputCls} data-testid="category-discount-label" />
        </div>
        <div className="sm:col-span-2 flex items-end gap-2">
          <Button onClick={() => run('apply')} disabled={busy} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white" data-testid="category-discount-apply-btn">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Применить
          </Button>
          <Button onClick={() => run('clear')} disabled={busy} variant="outline" className="border-slate-300 text-slate-600" data-testid="category-discount-clear-btn">Убрать скидки</Button>
        </div>
      </div>
    </div>
  );
};

export default CategoryDiscountPanel;
