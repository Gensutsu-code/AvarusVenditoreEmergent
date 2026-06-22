import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Package, Trash2, Edit3, X, CheckSquare, Square,
  BadgeCheck, ShieldCheck, Sparkles, Gift, Boxes, Percent, Tag, Loader2, Save, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const SORTS = [
  { v: 'created_at:desc', label: 'Сначала новые' },
  { v: 'created_at:asc', label: 'Сначала старые' },
  { v: 'name:asc', label: 'Название А-Я' },
  { v: 'name:desc', label: 'Название Я-А' },
  { v: 'price:asc', label: 'Цена ↑' },
  { v: 'price:desc', label: 'Цена ↓' },
  { v: 'stock:asc', label: 'Остаток ↑' },
  { v: 'stock:desc', label: 'Остаток ↓' },
  { v: 'manufacturer:asc', label: 'Производитель А-Я' },
];

const fmt = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p || 0));
const selectCls = 'h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-400';

export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('created_at:desc');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // all|in|out
  const [discountedFilter, setDiscountedFilter] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [selected, setSelected] = useState(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const searchTimer = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'admin') { navigate('/'); return; }
    axios.get(`${API}/categories`).then(r => setCategories(r.data || [])).catch(() => {});
  }, [user, authLoading, navigate]);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const buildParams = useCallback(() => {
    const [sort_by, sort_order] = sort.split(':');
    const p = { sort_by, sort_order };
    if (debouncedSearch) p.search = debouncedSearch;
    if (categoryFilter) p.category_id = categoryFilter;
    if (stockFilter === 'in') p.in_stock = true;
    if (stockFilter === 'out') p.in_stock = false;
    if (discountedFilter) p.discounted = true;
    return p;
  }, [sort, debouncedSearch, categoryFilter, stockFilter, discountedFilter]);

  const fetchProducts = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/products`, { params: { ...buildParams(), page, page_size: pageSize } });
      setProducts(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error('Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  }, [user, buildParams, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Reset selection when filters/page change
  useEffect(() => { setSelected(new Set()); setSelectAllMatching(false); }, [debouncedSearch, categoryFilter, stockFilter, discountedFilter, page, sort]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleSelect = (id) => {
    setSelectAllMatching(false);
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const allPageSelected = products.length > 0 && products.every(p => selected.has(p.id));
  const toggleSelectPage = () => {
    setSelectAllMatching(false);
    setSelected(prev => {
      const n = new Set(prev);
      if (allPageSelected) products.forEach(p => n.delete(p.id));
      else products.forEach(p => n.add(p.id));
      return n;
    });
  };

  const clearSelection = () => { setSelected(new Set()); setSelectAllMatching(false); };

  const selectionCount = selectAllMatching ? total : selected.size;

  const runBulk = async (action, payload = {}, confirmMsg) => {
    if (selectionCount === 0) { toast.error('Выберите товары'); return; }
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBulkBusy(true);
    try {
      const body = { action, payload };
      if (selectAllMatching) {
        Object.assign(body, { apply_all: true, ...buildParams() });
      } else {
        body.product_ids = [...selected];
      }
      const res = await axios.post(`${API}/admin/products/bulk`, body);
      toast.success(`Готово: обновлено ${res.data.modified_count} тов.`);
      clearSelection();
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка массовой операции');
    } finally {
      setBulkBusy(false);
    }
  };

  const deleteOne = async (id, name) => {
    if (!window.confirm(`Удалить «${name}»?`)) return;
    try {
      await axios.delete(`${API}/products/${id}`);
      toast.success('Товар удалён');
      fetchProducts();
    } catch { toast.error('Ошибка удаления'); }
  };

  if (authLoading || !user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-products-page">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin')} className="p-2 rounded-xl hover:bg-slate-100 transition" data-testid="back-to-admin">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Каталог — массовое редактирование</h1>
            <p className="text-sm text-slate-500">{total} товаров</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: артикул, производитель, описание, название..."
              className="pl-9 rounded-xl"
              data-testid="admin-product-search"
            />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls} data-testid="admin-product-sort">
            {SORTS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className={selectCls} data-testid="admin-product-category">
            <option value="">Все категории</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setPage(1); }} className={selectCls} data-testid="admin-product-stock-filter">
            <option value="all">Наличие: все</option>
            <option value="in">В наличии</option>
            <option value="out">Нет в наличии</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={discountedFilter} onChange={(e) => { setDiscountedFilter(e.target.checked); setPage(1); }} className="w-4 h-4 accent-rose-500" data-testid="admin-product-discounted-filter" />
            Со скидкой
          </label>
        </div>

        {/* Bulk toolbar */}
        <AnimatePresence>
          {selectionCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="sticky top-2 z-30 bg-white rounded-2xl shadow-lg border border-teal-200 p-4 mb-4"
              data-testid="bulk-toolbar"
            >
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <span className="text-sm font-bold text-slate-800" data-testid="bulk-selection-count">
                  Выбрано: {selectionCount}{selectAllMatching ? ' (все по фильтру)' : ''}
                </span>
                <div className="flex items-center gap-2">
                  {!selectAllMatching && total > products.length && (
                    <button onClick={() => setSelectAllMatching(true)} className="text-xs text-teal-600 hover:underline" data-testid="select-all-matching">
                      Выбрать все {total} по фильтру
                    </button>
                  )}
                  <button onClick={clearSelection} className="text-xs text-slate-500 hover:underline" data-testid="clear-selection">Снять выделение</button>
                </div>
              </div>

              {bulkBusy && <div className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Применяю...</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Badges */}
                <div className="border border-slate-100 rounded-xl p-3">
                  <p className="text-[11px] font-bold uppercase text-slate-400 mb-2">Значки</p>
                  <BadgeRow icon={BadgeCheck} label="Оригинал" field="is_original" onSet={runBulk} testid="badge-original" />
                  <BadgeRow icon={ShieldCheck} label="Гарантия" field="has_guarantee" onSet={runBulk} testid="badge-guarantee" />
                  <BadgeRow icon={Sparkles} label="Новинка" field="is_new" onSet={runBulk} testid="badge-new" />
                  <BadgeRow icon={Gift} label="Бонусы" field="bonus_eligible" onSet={runBulk} testid="badge-bonus" />
                </div>

                {/* Availability */}
                <div className="border border-slate-100 rounded-xl p-3">
                  <p className="text-[11px] font-bold uppercase text-slate-400 mb-2">Наличие</p>
                  <AvailabilityControl onSet={runBulk} />
                </div>

                {/* Discounts */}
                <div className="border border-slate-100 rounded-xl p-3">
                  <p className="text-[11px] font-bold uppercase text-slate-400 mb-2">Акции / Скидки</p>
                  <DiscountControl onSet={runBulk} />
                </div>

                {/* Price + delete */}
                <div className="border border-slate-100 rounded-xl p-3">
                  <p className="text-[11px] font-bold uppercase text-slate-400 mb-2">Цена и удаление</p>
                  <PriceControl onSet={runBulk} />
                  <Button
                    size="sm" variant="outline"
                    onClick={() => runBulk('delete', {}, `Удалить ${selectionCount} товаров? Это действие необратимо.`)}
                    className="w-full mt-2 border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                    data-testid="bulk-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Удалить выбранные
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product list */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <button onClick={toggleSelectPage} className="text-slate-500 hover:text-teal-600" data-testid="select-page">
              {allPageSelected ? <CheckSquare className="w-5 h-5 text-teal-600" /> : <Square className="w-5 h-5" />}
            </button>
            <span className="text-xs font-semibold text-slate-500">Выбрать страницу</span>
          </div>

          {loading ? (
            <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin text-teal-500 mx-auto" /></div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center text-slate-400"><Package className="w-10 h-10 mx-auto mb-2 opacity-40" />Товары не найдены</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {products.map(p => {
                const isSel = selectAllMatching || selected.has(p.id);
                return (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isSel ? 'bg-teal-50/50' : 'hover:bg-slate-50'}`} data-testid={`product-row-${p.id}`}>
                    <button onClick={() => toggleSelect(p.id)} disabled={selectAllMatching} className="text-slate-400 hover:text-teal-600 disabled:opacity-40" data-testid={`select-product-${p.id}`}>
                      {isSel ? <CheckSquare className="w-5 h-5 text-teal-600" /> : <Square className="w-5 h-5" />}
                    </button>
                    <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="w-5 h-5" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.article} · {p.manufacturer || '—'}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.is_original && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Оригинал</span>}
                        {p.has_guarantee && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">Гарантия</span>}
                        {p.is_new && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">Новинка</span>}
                        {p.discount_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">Скидка</span>}
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-slate-800">{fmt(p.price)} ₽</p>
                      <p className={`text-xs ${p.stock > 0 ? 'text-emerald-600' : 'text-red-400'}`}>{p.stock > 0 ? `${p.stock} шт` : 'нет в наличии'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(p)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg" data-testid={`edit-product-${p.id}`}><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => deleteOne(p.id, p.name)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" data-testid={`delete-product-${p.id}`}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4 border-t border-slate-100">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40" data-testid="page-prev"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm text-slate-600" data-testid="page-info">Стр. {page} из {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40" data-testid="page-next"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>

      {editing && <EditModal product={editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchProducts(); }} />}
    </div>
  );
}

const BadgeRow = ({ icon: Icon, label, field, onSet, testid }) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className="text-xs text-slate-600 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{label}</span>
    <div className="flex gap-1">
      <button onClick={() => onSet('set_fields', { [field]: true })} className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200" data-testid={`${testid}-on`}>Вкл</button>
      <button onClick={() => onSet('set_fields', { [field]: false })} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200" data-testid={`${testid}-off`}>Выкл</button>
    </div>
  </div>
);

const AvailabilityControl = ({ onSet }) => {
  const [val, setVal] = useState(100);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input type="number" min="0" value={val} onChange={(e) => setVal(e.target.value)} className="w-20 h-8 px-2 rounded-lg border border-slate-200 text-sm" data-testid="availability-value" />
        <button onClick={() => onSet('set_fields', { stock: Number(val) })} className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center gap-1" data-testid="set-in-stock">
          <Boxes className="w-3.5 h-3.5" /> Установить наличие
        </button>
      </div>
      <button onClick={() => onSet('set_fields', { stock: 0 })} className="w-full text-xs py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" data-testid="set-out-of-stock">
        Убрать наличие (0)
      </button>
    </div>
  );
};

const DiscountControl = ({ onSet }) => {
  const [type, setType] = useState('percent');
  const [value, setValue] = useState(10);
  const [until, setUntil] = useState('');
  const [label, setLabel] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-8 px-1 rounded-lg border border-slate-200 text-xs" data-testid="discount-type">
          <option value="percent">%</option>
          <option value="amount">₽</option>
        </select>
        <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} className="w-16 h-8 px-2 rounded-lg border border-slate-200 text-xs" data-testid="discount-value" />
        <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="flex-1 h-8 px-1 rounded-lg border border-slate-200 text-xs" data-testid="discount-until" />
      </div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Метка (напр. Распродажа)" className="w-full h-8 px-2 rounded-lg border border-slate-200 text-xs" data-testid="discount-label" />
      <button onClick={() => onSet('set_fields', { discount_active: true, discount_type: type, discount_value: Number(value), discount_label: label, discount_until: until ? new Date(until).toISOString() : null })} className="w-full text-xs py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 flex items-center justify-center gap-1" data-testid="apply-discount">
        <Tag className="w-3.5 h-3.5" /> Применить скидку
      </button>
      <div className="flex gap-1">
        <button onClick={() => { if (!until) { toast.error('Укажите дату'); return; } onSet('extend_discount', { discount_until: new Date(until).toISOString() }); }} className="flex-1 text-xs py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200" data-testid="extend-discount">Продлить до даты</button>
        <button onClick={() => onSet('clear_discount', {}, 'Удалить скидки у выбранных товаров?')} className="flex-1 text-xs py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" data-testid="remove-discount">Удалить скидку</button>
      </div>
    </div>
  );
};

const PriceControl = ({ onSet }) => {
  const [mode, setMode] = useState('percent');
  const [dir, setDir] = useState('inc');
  const [value, setValue] = useState(10);
  return (
    <div className="flex items-center gap-1">
      <select value={dir} onChange={(e) => setDir(e.target.value)} className="h-8 px-1 rounded-lg border border-slate-200 text-xs" data-testid="price-direction">
        <option value="inc">+</option>
        <option value="dec">−</option>
      </select>
      <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} className="w-14 h-8 px-2 rounded-lg border border-slate-200 text-xs" data-testid="price-value" />
      <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-8 px-1 rounded-lg border border-slate-200 text-xs" data-testid="price-mode">
        <option value="percent">%</option>
        <option value="amount">₽</option>
      </select>
      <button onClick={() => onSet('adjust_price', { mode, direction: dir, value: Number(value) })} className="flex-1 text-xs py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center justify-center gap-1" data-testid="adjust-price">
        <Percent className="w-3.5 h-3.5" /> Цена
      </button>
    </div>
  );
};

const EditModal = ({ product, categories, onClose, onSaved }) => {
  const [f, setF] = useState({
    name: product.name || '', article: product.article || '', manufacturer: product.manufacturer || '',
    category_id: product.category_id || '', price: product.price || 0, stock: product.stock || 0,
    delivery_days: product.delivery_days || 3, description: product.description || '',
    is_original: !!product.is_original, has_guarantee: !!product.has_guarantee, is_new: !!product.is_new, bonus_eligible: product.bonus_eligible !== false,
    discount_active: !!product.discount_active, discount_type: product.discount_type || 'percent', discount_value: product.discount_value || 0,
    discount_label: product.discount_label || '', discount_until: product.discount_until ? product.discount_until.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...f,
        price: Number(f.price), stock: Number(f.stock), delivery_days: Number(f.delivery_days),
        discount_value: Number(f.discount_value),
        discount_until: f.discount_until ? new Date(f.discount_until).toISOString() : null,
      };
      await axios.put(`${API}/products/${product.id}`, payload);
      toast.success('Сохранено');
      onSaved();
    } catch (e) { toast.error('Ошибка сохранения'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="product-edit-modal">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h3 className="font-bold text-slate-800">Редактировать товар</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Название"><Input value={f.name} onChange={(e) => upd('name', e.target.value)} data-testid="edit-name" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Артикул"><Input value={f.article} onChange={(e) => upd('article', e.target.value)} data-testid="edit-article" /></Field>
            <Field label="Производитель"><Input value={f.manufacturer} onChange={(e) => upd('manufacturer', e.target.value)} data-testid="edit-manufacturer" /></Field>
          </div>
          <Field label="Категория">
            <select value={f.category_id} onChange={(e) => upd('category_id', e.target.value)} className={`${selectCls} w-full`} data-testid="edit-category">
              <option value="">Без категории</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Цена"><Input type="number" value={f.price} onChange={(e) => upd('price', e.target.value)} data-testid="edit-price" /></Field>
            <Field label="Остаток"><Input type="number" value={f.stock} onChange={(e) => upd('stock', e.target.value)} data-testid="edit-stock" /></Field>
            <Field label="Дни"><Input type="number" value={f.delivery_days} onChange={(e) => upd('delivery_days', e.target.value)} data-testid="edit-delivery" /></Field>
          </div>
          <Field label="Описание"><textarea rows={3} value={f.description} onChange={(e) => upd('description', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" data-testid="edit-description" /></Field>
          <div className="flex flex-wrap gap-3">
            <Toggle label="Оригинал" v={f.is_original} on={(v) => upd('is_original', v)} t="edit-original" />
            <Toggle label="Гарантия" v={f.has_guarantee} on={(v) => upd('has_guarantee', v)} t="edit-guarantee" />
            <Toggle label="Новинка" v={f.is_new} on={(v) => upd('is_new', v)} t="edit-new" />
            <Toggle label="Бонусы" v={f.bonus_eligible} on={(v) => upd('bonus_eligible', v)} t="edit-bonus" />
          </div>
          <div className="border border-slate-100 rounded-xl p-3 space-y-2">
            <Toggle label="Скидка активна" v={f.discount_active} on={(v) => upd('discount_active', v)} t="edit-discount-active" />
            {f.discount_active && (
              <div className="grid grid-cols-3 gap-2">
                <select value={f.discount_type} onChange={(e) => upd('discount_type', e.target.value)} className={selectCls} data-testid="edit-discount-type">
                  <option value="percent">%</option><option value="amount">₽</option>
                </select>
                <Input type="number" value={f.discount_value} onChange={(e) => upd('discount_value', e.target.value)} placeholder="Значение" data-testid="edit-discount-value" />
                <Input type="date" value={f.discount_until} onChange={(e) => upd('discount_until', e.target.value)} data-testid="edit-discount-until" />
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Отмена</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl" data-testid="save-product">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
    {children}
  </div>
);

const Toggle = ({ label, v, on, t }) => (
  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
    <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="w-4 h-4 accent-teal-500" data-testid={t} />
    {label}
  </label>
);
