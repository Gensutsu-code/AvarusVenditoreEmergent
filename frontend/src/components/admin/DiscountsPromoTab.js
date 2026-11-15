import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Percent, Ticket, Search, Save, Trash2, Plus, X, Tag, Loader2, Power, Pencil, ShoppingCart, Megaphone } from 'lucide-react';
import { CartDiscountRequestsSection } from './CartDiscountRequestsSection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));

const emptyCode = {
  code: '', type: 'percent', value: '', min_order: '', max_uses: 0,
  per_user_limit: 1, active: true, valid_until: '', description: '',
};

// ===================== PROMO CODES =====================
const PromoCodesSection = ({ isDark }) => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyCode);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/promo-codes`);
      setCodes(r.data || []);
    } catch { toast.error('Не удалось загрузить промокоды'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm(emptyCode); setEditingId(null); };

  const save = async () => {
    if (!form.code.trim()) { toast.error('Введите код'); return; }
    if (!form.value || Number(form.value) <= 0) { toast.error('Укажите значение скидки'); return; }
    setSaving(true);
    const payload = {
      code: form.code.trim(),
      type: form.type,
      value: Number(form.value),
      min_order: Number(form.min_order) || 0,
      max_uses: Number(form.max_uses) || 0,
      per_user_limit: Number(form.per_user_limit) || 0,
      active: !!form.active,
      valid_until: form.valid_until || null,
      description: form.description || '',
    };
    try {
      if (editingId) {
        await axios.put(`${API}/admin/promo-codes/${editingId}`, payload);
        toast.success('Промокод обновлён');
      } else {
        await axios.post(`${API}/admin/promo-codes`, payload);
        toast.success('Промокод создан');
      }
      reset();
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setForm({
      code: c.code, type: c.type, value: c.value, min_order: c.min_order || '',
      max_uses: c.max_uses || 0, per_user_limit: c.per_user_limit || 0,
      active: c.active, valid_until: c.valid_until ? String(c.valid_until).slice(0, 10) : '',
      description: c.description || '',
    });
  };

  const toggleActive = async (c) => {
    try {
      await axios.put(`${API}/admin/promo-codes/${c.id}`, { ...c, active: !c.active, valid_until: c.valid_until || null });
      load();
    } catch { toast.error('Ошибка'); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Удалить промокод ${c.code}?`)) return;
    try { await axios.delete(`${API}/admin/promo-codes/${c.id}`); toast.success('Удалён'); load(); }
    catch { toast.error('Ошибка'); }
  };

  const inputCls = `mt-1.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200'}`;
  const labelCls = 'text-xs font-semibold uppercase text-teal-600';

  return (
    <div className="grid md:grid-cols-5 gap-6" data-testid="promo-codes-section">
      {/* Form */}
      <div className={`md:col-span-2 rounded-xl border p-4 space-y-3 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-teal-500" />
          <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{editingId ? 'Редактировать промокод' : 'Новый промокод'}</h3>
        </div>
        <div>
          <Label className={labelCls}>Код</Label>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SALE10" className={inputCls} data-testid="promo-code-input" maxLength={32} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className={labelCls}>Тип</Label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={`mt-1.5 w-full h-10 rounded-md border px-3 text-sm focus:outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200 bg-white'}`} data-testid="promo-code-type">
              <option value="percent">Процент (%)</option>
              <option value="amount">Сумма (₽)</option>
            </select>
          </div>
          <div>
            <Label className={labelCls}>Значение {form.type === 'amount' ? '(₽)' : '(%)'}</Label>
            <Input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'amount' ? '500' : '10'} className={inputCls} data-testid="promo-code-value" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className={labelCls}>Мин. сумма заказа (₽)</Label>
            <Input type="number" min="0" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} placeholder="0" className={inputCls} data-testid="promo-code-min-order" />
          </div>
          <div>
            <Label className={labelCls}>Действует до</Label>
            <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className={inputCls} data-testid="promo-code-valid-until" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className={labelCls}>Всего использований</Label>
            <Input type="number" min="0" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="0 = ∞" className={inputCls} data-testid="promo-code-max-uses" />
          </div>
          <div>
            <Label className={labelCls}>На 1 клиента</Label>
            <Input type="number" min="0" value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })} placeholder="0 = ∞" className={inputCls} data-testid="promo-code-per-user" />
          </div>
        </div>
        <div>
          <Label className={labelCls}>Описание</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Внутренняя заметка" className={inputCls} data-testid="promo-code-description" maxLength={120} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer" data-testid="promo-code-active-toggle">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-teal-500 rounded" />
          <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Активен</span>
        </label>
        <div className="flex gap-2 pt-1">
          <Button onClick={save} disabled={saving} className="flex-1 bg-teal-500 hover:bg-teal-600 text-white" data-testid="promo-code-save-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            {editingId ? 'Сохранить' : 'Создать'}
          </Button>
          {editingId && <Button variant="outline" onClick={reset} data-testid="promo-code-cancel-btn">Отмена</Button>}
        </div>
      </div>

      {/* List */}
      <div className="md:col-span-3 space-y-2" data-testid="promo-codes-list">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Загрузка...</div>
        ) : codes.length === 0 ? (
          <div className={`rounded-xl border border-dashed p-8 text-center ${isDark ? 'border-zinc-700 text-zinc-500' : 'border-slate-300 text-slate-400'}`}>Пока нет промокодов</div>
        ) : codes.map((c) => (
          <div key={c.id} className={`rounded-xl border p-3 flex items-center gap-3 flex-wrap ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`} data-testid={`promo-code-row-${c.id}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-1 rounded-md text-sm ${c.active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'}`}>
                <Tag className="w-3.5 h-3.5" />{c.code}
              </span>
              <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-800'}`}>
                {c.type === 'amount' ? `−${fmt(c.value)} ₽` : `−${c.value}%`}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-3">
              {c.min_order > 0 && <span>от {fmt(c.min_order)} ₽</span>}
              {c.valid_until && <span>до {String(c.valid_until).slice(0, 10)}</span>}
              <span>исп. {c.used_count || 0}{c.max_uses ? `/${c.max_uses}` : ''}</span>
              {c.per_user_limit > 0 && <span>{c.per_user_limit}/клиент</span>}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => toggleActive(c)} title={c.active ? 'Выключить' : 'Включить'} className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`} data-testid={`promo-code-toggle-${c.id}`}><Power className="w-4 h-4" /></button>
              <button onClick={() => startEdit(c)} className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 flex items-center justify-center" data-testid={`promo-code-edit-${c.id}`}><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(c)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center" data-testid={`promo-code-delete-${c.id}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ===================== PRODUCT DISCOUNTS =====================
const ProductDiscountsSection = ({ isDark }) => {
  const [search, setSearch] = useState('');
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // selected product
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page_size: 50 };
      if (search.trim()) params.search = search.trim();
      if (onlyDiscounted) params.discounted = true;
      const r = await axios.get(`${API}/admin/products`, { params });
      setResults(r.data?.items || []);
    } catch { toast.error('Ошибка загрузки товаров'); }
    finally { setLoading(false); }
  }, [search, onlyDiscounted]);

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [load]);

  const save = async () => {
    if (!editing) return;
    if (editing.discount_active) {
      const hasTier = Array.isArray(editing.discount_tiers) && editing.discount_tiers.some((t) => Number(t.value) > 0);
      if ((!editing.discount_value || editing.discount_value <= 0) && !hasTier) { toast.error('Укажите значение базовой скидки или хотя бы один оптовый порог'); return; }
      if (!editing.discount_until) { toast.error('Укажите дату окончания акции'); return; }
    }
    setSaving(true);
    const payload = {
      discount_active: !!editing.discount_active,
      discount_type: editing.discount_type || 'percent',
      discount_value: Number(editing.discount_value) || 0,
      discount_label: editing.discount_label || '',
      discount_description: editing.discount_description || '',
      discount_until: editing.discount_until || null,
      discount_tiers: Array.isArray(editing.discount_tiers) ? editing.discount_tiers : [],
    };
    // Only send allocated stock when the admin actually changed it, so editing
    // other fields mid-campaign does not reset promo_remaining_stock.
    const curAlloc = editing.promo_allocated_stock === '' ? null : editing.promo_allocated_stock;
    if (curAlloc !== (editing._origAlloc ?? null)) {
      payload.promo_allocated_stock = curAlloc;
    }
    try {
      await axios.put(`${API}/products/${editing.id}`, payload);
      toast.success('Скидка сохранена');
      setEditing(null);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const labelCls = 'text-xs font-semibold uppercase text-rose-600';
  const inputCls = `mt-1.5 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200'} focus:border-rose-500`;

  return (
    <div data-testid="product-discounts-section">
      {!editing ? (
        <>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по артикулу, названию, производителю" className={`pl-9 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200'}`} data-testid="product-discount-search" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm" data-testid="product-discount-only-filter">
              <input type="checkbox" checked={onlyDiscounted} onChange={(e) => setOnlyDiscounted(e.target.checked)} className="w-4 h-4 accent-rose-500 rounded" />
              <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>Только со скидкой</span>
            </label>
          </div>
          <div className="space-y-2" data-testid="product-discount-results">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Загрузка...</div>
            ) : results.length === 0 ? (
              <div className={`rounded-xl border border-dashed p-8 text-center ${isDark ? 'border-zinc-700 text-zinc-500' : 'border-slate-300 text-slate-400'}`}>Товары не найдены</div>
            ) : results.map((p) => {
              const hasDisc = p.discount_active || (p.discount_tiers && p.discount_tiers.length);
              return (
                <div key={p.id} className={`rounded-xl border p-3 flex items-center gap-3 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`} data-testid={`product-discount-item-${p.id}`}>
                  {p.image_url && <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-zinc-800'}`}>{p.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{p.article} · {p.manufacturer} · {fmt(p.price)} ₽</p>
                  </div>
                  {hasDisc && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md whitespace-nowrap">
                      {(p.discount_active && Number(p.discount_value) > 0)
                        ? (p.discount_type === 'amount' ? `−${fmt(p.discount_value)}₽` : `−${p.discount_value}%`)
                        : 'тиры'}
                    </span>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...p, discount_type: p.discount_type || 'percent', _origAlloc: p.promo_allocated_stock ?? null })} className="flex-shrink-0 border-rose-200 text-rose-600 hover:bg-rose-50" data-testid={`edit-product-discount-${p.id}`}>
                    <Percent className="w-4 h-4 mr-1" />Скидка
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className={`rounded-xl border p-4 space-y-3 max-w-2xl ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`} data-testid="product-discount-editor">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`font-bold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{editing.name}</h3>
              <p className="text-[11px] text-slate-400">{editing.article} · {fmt(editing.price)} ₽{editing.min_price ? ` · мин. цена ${fmt(editing.min_price)} ₽` : ''}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} data-testid="product-discount-editor-close"><X className="w-4 h-4" /></Button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer" data-testid="editor-discount-toggle">
            <input type="checkbox" checked={editing.discount_active === true} onChange={(e) => {
              const next = { ...editing, discount_active: e.target.checked };
              if (e.target.checked && !next.discount_type) next.discount_type = 'percent';
              setEditing(next);
            }} className="w-4 h-4 accent-rose-500 rounded" />
            <span className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Скидка / акция активна</span>
          </label>

          {editing.discount_active && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={labelCls}>Тип скидки</Label>
                  <select value={editing.discount_type || 'percent'} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })} className={`mt-1.5 w-full h-10 rounded-md border px-3 text-sm focus:outline-none ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200 bg-white'}`} data-testid="editor-discount-type">
                    <option value="percent">Процент (%)</option>
                    <option value="amount">Сумма (₽)</option>
                  </select>
                </div>
                <div>
                  <Label className={labelCls}>Значение {editing.discount_type === 'amount' ? '(₽)' : '(%)'}</Label>
                  <Input type="number" min="0" step="0.01" value={editing.discount_value ?? ''} onChange={(e) => setEditing({ ...editing, discount_value: parseFloat(e.target.value) || 0 })} className={inputCls} data-testid="editor-discount-value" />
                </div>
              </div>
              <div>
                <Label className={labelCls}>Название акции</Label>
                <Input value={editing.discount_label || ''} onChange={(e) => setEditing({ ...editing, discount_label: e.target.value })} placeholder="Например: Чёрная пятница" className={inputCls} maxLength={60} data-testid="editor-discount-label" />
              </div>
              <div>
                <Label className={labelCls}>Действует до <span className="text-rose-500">*</span></Label>
                <Input type="date" value={editing.discount_until ? String(editing.discount_until).slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, discount_until: e.target.value || null })} className={inputCls} data-testid="editor-discount-until" />
              </div>
              <div>
                <Label className={labelCls}>Лимит по акции (шт.)</Label>
                <Input type="number" min="0" value={editing.promo_allocated_stock ?? ''} onChange={(e) => { const raw = e.target.value; setEditing({ ...editing, promo_allocated_stock: raw === '' ? null : (parseInt(raw, 10) || 0) }); }} placeholder="Пусто — без лимита" className={inputCls} data-testid="editor-promo-allocated-stock" />
              </div>

              {/* Tiers */}
              <div className="pt-3 border-t border-rose-200/60 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={labelCls}>Оптовые скидки (по количеству)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => {
                    const tiers = Array.isArray(editing.discount_tiers) ? [...editing.discount_tiers] : [];
                    tiers.push({ min_qty: 1, type: editing.discount_type || 'percent', value: 0 });
                    setEditing({ ...editing, discount_tiers: tiers });
                  }} className="border-rose-200 text-rose-600 hover:bg-rose-50 h-7 text-xs" data-testid="editor-add-tier-btn"><Plus className="w-3.5 h-3.5 mr-1" />Порог</Button>
                </div>
                <p className="text-[11px] text-slate-400">При заказе от N шт. применяется скидка тира вместо базовой.</p>
                {Array.isArray(editing.discount_tiers) && editing.discount_tiers.map((tier, idx) => (
                  <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-rose-50/40 border-rose-100'}`} data-testid={`editor-tier-row-${idx}`}>
                    <span className="text-xs text-slate-500">От</span>
                    <Input type="number" min="1" value={tier.min_qty} onChange={(e) => { const tiers = [...editing.discount_tiers]; tiers[idx] = { ...tier, min_qty: parseInt(e.target.value) || 1 }; setEditing({ ...editing, discount_tiers: tiers }); }} className="w-16 h-8 text-xs" />
                    <span className="text-xs text-slate-500">шт.</span>
                    <select value={tier.type || 'percent'} onChange={(e) => { const tiers = [...editing.discount_tiers]; tiers[idx] = { ...tier, type: e.target.value }; setEditing({ ...editing, discount_tiers: tiers }); }} className="h-8 rounded border border-slate-200 text-xs px-1">
                      <option value="percent">%</option>
                      <option value="amount">₽</option>
                    </select>
                    <Input type="number" min="0" step="0.01" value={tier.value} onChange={(e) => { const tiers = [...editing.discount_tiers]; tiers[idx] = { ...tier, value: parseFloat(e.target.value) || 0 }; setEditing({ ...editing, discount_tiers: tiers }); }} placeholder={tier.type === 'amount' ? '500' : '15'} className="flex-1 h-8 text-xs" />
                    <button type="button" onClick={() => { const tiers = editing.discount_tiers.filter((_, i) => i !== idx); setEditing({ ...editing, discount_tiers: tiers }); }} className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center" data-testid={`editor-remove-tier-${idx}`}><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white" data-testid="product-discount-save-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}Сохранить скидку
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} data-testid="product-discount-editor-cancel">Отмена</Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ===================== MAIN TAB =====================
export default function DiscountsPromoTab({ isDark = false, bannerSlot = null }) {
  const [sub, setSub] = useState('products');

  const tabs = [
    { id: 'products', label: 'Товарные скидки', icon: Percent },
    { id: 'promo', label: 'Промокоды', icon: Ticket },
    { id: 'cart', label: 'Скидки на корзину', icon: ShoppingCart },
    ...(bannerSlot ? [{ id: 'banner', label: 'Акционный баннер', icon: Megaphone }] : []),
  ];

  return (
    <div className="space-y-5" data-testid="discounts-promo-tab">
      <div>
        <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Скидки и акции</h2>
        <p className="text-sm text-slate-400">Скидки товаров, оптовые пороги, промокоды, скидки на корзину и акционный баннер — в одном месте.</p>
      </div>

      <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = sub === t.id;
          return (
            <button key={t.id} onClick={() => setSub(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${active ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow' : (isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-700')}`} data-testid={`discounts-subtab-${t.id}`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {sub === 'products' && <ProductDiscountsSection isDark={isDark} />}
      {sub === 'promo' && <PromoCodesSection isDark={isDark} />}
      {sub === 'cart' && <CartDiscountRequestsSection isDark={isDark} />}
      {sub === 'banner' && <div data-testid="promo-banner-section">{bannerSlot}</div>}
    </div>
  );
}
