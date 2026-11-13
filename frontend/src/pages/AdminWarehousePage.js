import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Warehouse, Package, TrendingUp, TrendingDown, Wallet, AlertTriangle, Plus, Minus, ArrowDownCircle, ArrowUpCircle, ShoppingCart, Trash2, Loader2, Coins, MapPin, Pencil, ArrowRightLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p || 0));

const TABS = [
  { id: 'stock', label: 'Остатки' },
  { id: 'warehouses', label: 'Склады' },
  { id: 'receipts', label: 'Приёмки' },
  { id: 'movements', label: 'Движения' },
  { id: 'cogs', label: 'Прибыль' },
  { id: 'delivery', label: 'Доставка' },
  { id: 'finance', label: 'Финансы' },
];

const DELIVERY_STATES = [
  { key: 'in_region', title: 'Свой регион', hint: 'Товар есть на складе в регионе клиента' },
  { key: 'other_region', title: 'Другой регион', hint: 'Товар есть на складе в другом регионе' },
  { key: 'out_of_stock', title: 'Нет в наличии', hint: 'Товара нет ни на одном складе' },
];

const cfgColorFallback = (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c : '#000000';
const _d2 = (n) => { const d = new Date(); d.setDate(d.getDate() + (n || 0)); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
const deliveryPreviewDate = (min, max) => (min === max ? _d2(min) : `${_d2(min)} – ${_d2(max)}`);

const MV = {
  receipt: { label: 'Приход', color: 'text-emerald-600 bg-emerald-50', icon: ArrowDownCircle, sign: '+' },
  writeoff: { label: 'Списание', color: 'text-rose-600 bg-rose-50', icon: ArrowUpCircle, sign: '−' },
  sale: { label: 'Продажа', color: 'text-indigo-600 bg-indigo-50', icon: ShoppingCart, sign: '−' },
};

const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export default function AdminWarehousePage({ embedded = false }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('stock');
  const [loading, setLoading] = useState(true);

  const [stockData, setStockData] = useState({ items: [], summary: {} });
  const [search, setSearch] = useState('');
  const [whSort, setWhSort] = useState('name');
  const [whHideOOS, setWhHideOOS] = useState(false);
  const [movements, setMovements] = useState([]);
  const [mvFilter, setMvFilter] = useState('');
  const [finance, setFinance] = useState(null);
  const [finStart, setFinStart] = useState(firstOfMonth());
  const [finEnd, setFinEnd] = useState(today());
  const [globalSync, setGlobalSync] = useState(true);

  const [mvModal, setMvModal] = useState(null); // { product, type } | { bulk:true, type }
  const [selected, setSelected] = useState([]);
  const [mvQty, setMvQty] = useState('');
  const [mvPrice, setMvPrice] = useState('');
  const [mvSupplier, setMvSupplier] = useState('');
  const [mvReason, setMvReason] = useState('');
  const [mvWarehouse, setMvWarehouse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Warehouses (склады с регионами)
  const [warehouses, setWarehouses] = useState([]);
  const [whForm, setWhForm] = useState(null); // {id?, name, region, address}
  const [transferModal, setTransferModal] = useState(null); // { product }
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trQty, setTrQty] = useState('');

  const fetchWarehouses = async () => {
    const res = await axios.get(`${API}/admin/warehouses`);
    setWarehouses(res.data || []);
  };
  const saveWarehouse = async () => {
    if (!whForm?.name?.trim() || !whForm?.region?.trim()) { toast.error('Укажите название и регион'); return; }
    setSubmitting(true);
    try {
      if (whForm.id) await axios.put(`${API}/admin/warehouses/${whForm.id}`, { name: whForm.name, region: whForm.region, address: whForm.address || '' });
      else await axios.post(`${API}/admin/warehouses`, { name: whForm.name, region: whForm.region, address: whForm.address || '' });
      toast.success('Склад сохранён');
      setWhForm(null);
      await Promise.all([fetchWarehouses(), fetchStock()]);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };
  const deleteWarehouse = async (id) => {
    try {
      await axios.delete(`${API}/admin/warehouses/${id}`);
      toast.success('Склад удалён');
      await Promise.all([fetchWarehouses(), fetchStock()]);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
  };
  const submitTransfer = async () => {
    const q = parseInt(trQty, 10);
    if (!trFrom || !trTo || !q || q <= 0) { toast.error('Заполните склады и количество'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/warehouse/transfer`, { product_id: transferModal.product.id, from_warehouse_id: trFrom, to_warehouse_id: trTo, quantity: q });
      toast.success('Перемещено');
      setTransferModal(null); setTrFrom(''); setTrTo(''); setTrQty('');
      await fetchStock();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };

  const [finModal, setFinModal] = useState(false);
  const [finType, setFinType] = useState('expense');
  const [finAmount, setFinAmount] = useState('');
  const [finCategory, setFinCategory] = useState('');
  const [finComment, setFinComment] = useState('');

  // Receipts (документы приёмки)
  const [receipts, setReceipts] = useState([]);
  const [receiptDetail, setReceiptDetail] = useState(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [rcSupplier, setRcSupplier] = useState('');
  const [rcComment, setRcComment] = useState('');
  const [rcDate, setRcDate] = useState(today());
  const [rcWarehouse, setRcWarehouse] = useState('');
  const [rcItems, setRcItems] = useState([]);
  const [rcSearch, setRcSearch] = useState('');
  const [rcResults, setRcResults] = useState([]);
  const [rcSearching, setRcSearching] = useState(false);

  // COGS / profit report
  const [cogs, setCogs] = useState(null);
  const [cogsStart, setCogsStart] = useState(firstOfMonth());
  const [cogsEnd, setCogsEnd] = useState(today());

  // Delivery display settings (3 states: свой регион / другой / нет в наличии)
  const [delivery, setDelivery] = useState(null);
  const fetchDelivery = async () => {
    const res = await axios.get(`${API}/delivery-display`);
    setDelivery(res.data);
  };
  const saveDelivery = async () => {
    setSubmitting(true);
    try {
      await axios.put(`${API}/admin/delivery-display`, delivery);
      toast.success('Настройки доставки сохранены');
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };
  const updDelivery = (key, field, val) => setDelivery(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));

  const fetchReceipts = async () => {
    const res = await axios.get(`${API}/admin/warehouse/receipts`);
    setReceipts(res.data || []);
  };
  const fetchCogs = async () => {
    const res = await axios.get(`${API}/admin/warehouse/cogs-report`, { params: { start: `${cogsStart}T00:00:00+00:00`, end: `${cogsEnd}T23:59:59+00:00` } });
    setCogs(res.data);
  };
  const rcSearchProducts = async () => {
    if (!rcSearch.trim()) { setRcResults([]); return; }
    setRcSearching(true);
    try {
      const res = await axios.get(`${API}/admin/warehouse/stock`, { params: { search: rcSearch } });
      setRcResults((res.data.items || []).slice(0, 20));
    } catch { toast.error('Ошибка поиска'); } finally { setRcSearching(false); }
  };
  const rcAddItem = (p) => {
    if (rcItems.some(i => i.product_id === p.id)) { toast.info('Товар уже добавлен'); return; }
    setRcItems(prev => [...prev, { product_id: p.id, name: p.name, article: p.article, quantity: 1, purchase_price: p.purchase_price || 0 }]);
    setRcSearch(''); setRcResults([]);
  };
  const rcUpdateItem = (idx, field, val) => setRcItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  const rcRemoveItem = (idx) => setRcItems(prev => prev.filter((_, i) => i !== idx));
  const rcTotalCost = rcItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.purchase_price) || 0), 0);
  const submitReceipt = async () => {
    const valid = rcItems.filter(it => (Number(it.quantity) || 0) > 0);
    if (!rcWarehouse) { toast.error('Выберите склад приёмки'); return; }
    if (valid.length === 0) { toast.error('Добавьте товары с количеством > 0'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/warehouse/receipts`, {
        supplier: rcSupplier, comment: rcComment, date: `${rcDate}T12:00:00+00:00`, warehouse_id: rcWarehouse,
        items: valid.map(it => ({ product_id: it.product_id, quantity: Number(it.quantity), purchase_price: it.purchase_price === '' ? null : Number(it.purchase_price) })),
      });
      toast.success('Приёмка оформлена');
      setShowReceiptForm(false);
      setRcSupplier(''); setRcComment(''); setRcDate(today()); setRcWarehouse(''); setRcItems([]); setRcSearch(''); setRcResults([]);
      await Promise.all([fetchReceipts(), fetchStock(), fetchMovements(), fetchFinance(), fetchWarehouses()]);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };

  const fetchStock = async (s = search) => {
    const res = await axios.get(`${API}/admin/warehouse/stock`, { params: s ? { search: s } : {} });
    setStockData(res.data);
  };
  const fetchMovements = async (f = mvFilter) => {
    const res = await axios.get(`${API}/admin/warehouse/movements`, { params: f ? { type: f } : {} });
    setMovements(res.data);
  };
  const fetchFinance = async () => {
    const res = await axios.get(`${API}/admin/finance`, { params: { start: `${finStart}T00:00:00+00:00`, end: `${finEnd}T23:59:59+00:00` } });
    setFinance(res.data);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') { if (!embedded) navigate('/login'); return; }
    Promise.all([fetchStock(), fetchMovements(), fetchFinance(), fetchReceipts(), fetchCogs(), fetchWarehouses(), fetchDelivery()]).catch(() => toast.error('Ошибка загрузки')).finally(() => setLoading(false));
    axios.get(`${API}/stock-sync-settings`).then(r => setGlobalSync(r.data.stock_sync_enabled)).catch(() => {});
    // eslint-disable-next-line
  }, [user, authLoading, navigate]);

  const toggleGlobalSync = async () => {
    const next = !globalSync;
    setGlobalSync(next);
    try {
      await axios.put(`${API}/admin/stock-sync-settings`, { stock_sync_enabled: next });
      toast.success(next ? 'Синхронизация включена' : 'Синхронизация выключена');
      fetchStock();
    } catch { toast.error('Ошибка'); setGlobalSync(!next); }
  };

  const openMv = (product, type) => {
    setMvModal({ product, type });
    setMvQty(''); setMvPrice(String(product.purchase_price || '')); setMvSupplier(''); setMvReason('');
    setMvWarehouse(warehouses[0]?.id || '');
  };

  const openBulkMv = (type) => {
    if (selected.length === 0) { toast.error('Выберите товары'); return; }
    setMvModal({ bulk: true, type });
    setMvQty(''); setMvPrice(''); setMvSupplier(''); setMvReason('');
    setMvWarehouse(warehouses[0]?.id || '');
  };

  const toggleSelect = (id) => setSelected((s) => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const displayedStockItems = [...(stockData.items || [])]
    .filter(it => !whHideOOS || it.stock > 0)
    .sort((a, b) => {
      switch (whSort) {
        case 'stock': return (b.stock || 0) - (a.stock || 0);
        case 'stock_asc': return (a.stock || 0) - (b.stock || 0);
        case 'purchase': return (b.purchase_price || 0) - (a.purchase_price || 0);
        case 'cost': return (b.stock_cost_value || 0) - (a.stock_cost_value || 0);
        case 'margin': return (b.margin || 0) - (a.margin || 0);
        default: return (a.name || '').localeCompare(b.name || '', 'ru');
      }
    });
  const allVisibleSelected = displayedStockItems.length > 0 && displayedStockItems.every(it => selected.includes(it.id));
  const toggleSelectAll = () => setSelected(allVisibleSelected ? [] : displayedStockItems.map(it => it.id));

  const submitMv = async () => {
    const qty = parseInt(mvQty, 10);
    if (!qty || qty <= 0) { toast.error('Укажите количество'); return; }
    if (!mvWarehouse) { toast.error('Выберите склад'); return; }
    setSubmitting(true);
    try {
      if (mvModal.bulk) {
        const payload = { product_ids: selected, type: mvModal.type, quantity: qty, warehouse_id: mvWarehouse, comment: '' };
        if (mvModal.type === 'receipt') { payload.purchase_price = mvPrice === '' ? undefined : Number(mvPrice); payload.supplier = mvSupplier; }
        else { payload.reason = mvReason; }
        const res = await axios.post(`${API}/admin/warehouse/movements/bulk`, payload);
        const sk = res.data.skipped || [];
        toast.success(`Обработано: ${res.data.processed}${sk.length ? `, пропущено: ${sk.length}` : ''}`);
        setMvModal(null); setSelected([]);
        await Promise.all([fetchStock(), fetchMovements(), fetchFinance(), fetchWarehouses()]);
        return;
      }
      const payload = { product_id: mvModal.product.id, type: mvModal.type, quantity: qty, warehouse_id: mvWarehouse, comment: '' };
      if (mvModal.type === 'receipt') { payload.purchase_price = mvPrice === '' ? undefined : Number(mvPrice); payload.supplier = mvSupplier; }
      else { payload.reason = mvReason; }
      await axios.post(`${API}/admin/warehouse/movement`, payload);
      toast.success(mvModal.type === 'receipt' ? 'Приход оформлен' : 'Списание оформлено');
      setMvModal(null);
      await Promise.all([fetchStock(), fetchMovements(), fetchFinance(), fetchWarehouses()]);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };

  const submitFin = async () => {
    const amt = Number(finAmount);
    if (!amt || amt <= 0) { toast.error('Укажите сумму'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/finance/entry`, { type: finType, amount: amt, category: finCategory, comment: finComment, date: `${today()}T12:00:00+00:00` });
      toast.success('Запись добавлена');
      setFinModal(false); setFinAmount(''); setFinCategory(''); setFinComment('');
      fetchFinance();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };

  const deleteFin = async (id) => {
    if (!window.confirm('Удалить запись?')) return;
    try { await axios.delete(`${API}/admin/finance/entry/${id}`); toast.success('Удалено'); fetchFinance(); }
    catch { toast.error('Ошибка'); }
  };

  if (!user || user.role !== 'admin') return null;
  const s = stockData.summary || {};

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'} data-testid="admin-warehouse-page">
      <div className={embedded ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Warehouse className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Склад и учёт</h1>
            <p className="text-sm text-slate-500">Остатки, движения товаров и финансовая сводка</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-amber-500 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
              data-testid={`warehouse-tab-${t.id}`}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-amber-500" /></div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* STOCK TAB */}
            {tab === 'stock' && (
              <>
                <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 flex items-center justify-between gap-3 flex-wrap" data-testid="global-sync-card">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Синхронизация наличия со складом</p>
                    <p className="text-xs text-slate-500">{globalSync ? 'Метка «В наличии / Нет в наличии» берётся из остатков склада (игнорируя ручную настройку «Наличие» в карточке товара)' : 'Метка наличия берётся из ручной настройки «Наличие» в карточке товара. Остатки списываются при заказах в любом случае.'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleGlobalSync}
                    className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-200 ${globalSync ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    data-testid="global-sync-toggle"
                  >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${globalSync ? 'translate-x-9' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                  <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="wh-stat-units"><div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-slate-400" /><p className="text-xs text-slate-500">Единиц на складе</p></div><p className="text-xl font-bold text-slate-800">{fmt(s.total_units)}</p></div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="wh-stat-reserved"><div className="flex items-center gap-2 mb-1"><ShoppingCart className="w-4 h-4 text-indigo-400" /><p className="text-xs text-slate-500">В резерве (неоплач.)</p></div><p className="text-xl font-bold text-indigo-600">{fmt(s.total_reserved)}</p></div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="flex items-center gap-2 mb-1"><Coins className="w-4 h-4 text-slate-400" /><p className="text-xs text-slate-500">Стоимость (закупка)</p></div><p className="text-xl font-bold text-slate-800">{fmt(s.total_cost_value)} ₽</p></div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-slate-400" /><p className="text-xs text-slate-500">Потенц. выручка</p></div><p className="text-xl font-bold text-slate-800">{fmt(s.total_revenue_value)} ₽</p></div>
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-4 shadow-sm" data-testid="wh-stat-profit"><div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 opacity-80" /><p className="text-xs opacity-80">Потенц. прибыль</p></div><p className="text-xl font-bold">{fmt(s.potential_profit)} ₽</p></div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-rose-400" /><p className="text-xs text-slate-500">Мало на складе (≤{s.low_stock_threshold})</p></div><p className="text-xl font-bold text-rose-600">{fmt(s.low_stock_count)}</p></div>
                </div>

                <div className="flex gap-2 mb-4 flex-wrap items-center">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchStock()} placeholder="Поиск по названию, артикулу, бренду..." className="rounded-xl max-w-md" data-testid="wh-search-input" />
                  <Button onClick={() => fetchStock()} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="wh-search-btn">Найти</Button>
                  <select
                    value={whSort}
                    onChange={(e) => setWhSort(e.target.value)}
                    className="border border-slate-200 rounded-xl px-2 h-10 text-sm bg-white focus:border-amber-400"
                    data-testid="wh-sort"
                  >
                    <option value="name">По названию</option>
                    <option value="stock">Остаток ↓</option>
                    <option value="stock_asc">Остаток ↑</option>
                    <option value="purchase">Цена закупки ↓</option>
                    <option value="cost">Стоимость остатка ↓</option>
                    <option value="margin">Маржа ↓</option>
                  </select>
                  <button
                    onClick={() => setWhHideOOS(v => !v)}
                    className={`px-3 h-10 rounded-xl text-sm font-medium border transition-all ${
                      whHideOOS ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                    }`}
                    data-testid="wh-hide-oos"
                  >
                    {whHideOOS ? 'Показать все' : 'Скрыть нет в наличии'}
                  </button>
                </div>

                {/* Bulk operations bar */}
                {selected.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex-wrap" data-testid="bulk-action-bar">
                    <span className="text-sm font-semibold text-amber-700">Выбрано товаров: {selected.length}</span>
                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                      <Button size="sm" onClick={() => openBulkMv('receipt')} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg" data-testid="bulk-receipt-btn"><Plus className="w-4 h-4 mr-1.5" />Массовая приёмка</Button>
                      <Button size="sm" onClick={() => openBulkMv('writeoff')} className="bg-rose-500 hover:bg-rose-600 text-white rounded-lg" data-testid="bulk-writeoff-btn"><Minus className="w-4 h-4 mr-1.5" />Массовое списание</Button>
                      <button onClick={() => setSelected([])} className="text-slate-500 hover:text-slate-700 text-sm font-medium px-2" data-testid="bulk-clear">Сбросить</button>
                    </div>
                  </motion.div>
                )}

                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                        <tr>
                          <th className="px-3 py-3 w-8"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} className="accent-amber-500" data-testid="wh-select-all" /></th>
                          <th className="text-left px-4 py-3 font-medium">Товар</th>
                          <th className="text-right px-4 py-3 font-medium">Остаток</th>
                          <th className="text-right px-4 py-3 font-medium">Резерв</th>
                          <th className="text-right px-4 py-3 font-medium">Доступно</th>
                          <th className="text-right px-4 py-3 font-medium">Закуп.</th>
                          <th className="text-right px-4 py-3 font-medium">Продажа</th>
                          <th className="text-right px-4 py-3 font-medium">Маржа</th>
                          <th className="text-right px-4 py-3 font-medium">Стоимость</th>
                          <th className="text-right px-4 py-3 font-medium">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockData.items.length === 0 ? (
                          <tr><td colSpan={10} className="text-center py-10 text-slate-400">Нет товаров</td></tr>
                        ) : displayedStockItems.map(it => (
                          <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`wh-row-${it.id}`}>
                            <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(it.id)} onChange={() => toggleSelect(it.id)} className="accent-amber-500" data-testid={`wh-select-${it.id}`} /></td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{it.name}</p>
                              <p className="text-xs text-slate-400">{it.manufacturer ? it.manufacturer + ' · ' : ''}{it.article}</p>
                              {it.regions?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {it.warehouses.map(w => (
                                    <span key={w.warehouse_id} className="text-[10px] bg-teal-50 text-teal-700 border border-teal-100 rounded px-1.5 py-0.5" title={w.warehouse_name}>{w.region}: {w.quantity}</span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right"><span className={`font-bold ${it.is_low ? 'text-rose-600' : 'text-slate-800'}`}>{it.stock}</span>{it.is_low && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 inline ml-1" />}</td>
                            <td className="px-4 py-3 text-right">{it.reserved > 0 ? <span className="font-medium text-indigo-600" data-testid={`wh-reserved-${it.id}`}>{it.reserved}</span> : <span className="text-slate-300">—</span>}</td>
                            <td className="px-4 py-3 text-right"><span className={`font-semibold ${it.available < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{it.available}</span></td>
                            <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{fmt(it.purchase_price)} ₽</td>
                            <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{fmt(it.price)} ₽</td>
                            <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${it.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(it.margin)} ₽</td>
                            <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{fmt(it.stock_cost_value)} ₽</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="outline" onClick={() => openMv(it, 'receipt')} className="border-emerald-200 text-emerald-600 rounded-lg h-8 px-2" data-testid={`wh-receipt-${it.id}`}><Plus className="w-4 h-4" /></Button>
                                <Button size="sm" variant="outline" onClick={() => openMv(it, 'writeoff')} className="border-rose-200 text-rose-600 rounded-lg h-8 px-2" data-testid={`wh-writeoff-${it.id}`}><Minus className="w-4 h-4" /></Button>
                                <Button size="sm" variant="outline" onClick={() => { setTransferModal({ product: it }); setTrFrom(it.warehouses?.[0]?.warehouse_id || ''); setTrTo(''); setTrQty(''); }} disabled={!(it.warehouses?.length > 0) || warehouses.length < 2} className="border-blue-200 text-blue-600 rounded-lg h-8 px-2" data-testid={`wh-transfer-${it.id}`} title="Переместить между складами"><ArrowRightLeft className="w-4 h-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* MOVEMENTS TAB */}
            {tab === 'movements' && (
              <>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {[{ id: '', label: 'Все' }, { id: 'receipt', label: 'Приход' }, { id: 'writeoff', label: 'Списание' }, { id: 'sale', label: 'Продажи' }].map(f => (
                    <button key={f.id} onClick={() => { setMvFilter(f.id); fetchMovements(f.id); }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${mvFilter === f.id ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                      data-testid={`mv-filter-${f.id || 'all'}`}>{f.label}</button>
                  ))}
                </div>
                <div className="space-y-2">
                  {movements.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center text-slate-400 shadow-sm">Движений нет</div>
                  ) : movements.map(m => {
                    const cfg = MV[m.type] || MV.writeoff; const Icon = cfg.icon;
                    return (
                      <div key={m.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-3 flex-wrap" data-testid={`movement-${m.id}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color}`}><Icon className="w-5 h-5" /></div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{m.product_name} <span className="text-xs text-slate-400">{m.product_article}</span></p>
                            <p className="text-xs text-slate-400">{String(m.created_at).slice(0, 16).replace('T', ' ')}{m.supplier ? ` · ${m.supplier}` : ''}{m.reason ? ` · ${m.reason}` : ''}{m.comment ? ` · ${m.comment}` : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${m.type === 'receipt' ? 'text-emerald-600' : 'text-rose-600'}`}>{cfg.sign}{m.quantity} шт.</p>
                          <p className="text-xs text-slate-400">{m.stock_before} → {m.stock_after}{m.total_cost ? ` · ${fmt(m.total_cost)} ₽` : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* WAREHOUSES TAB */}
            {tab === 'warehouses' && (
              <>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <p className="text-sm text-slate-500">Склады с привязкой к региону. Регион определяет срок доставки для клиента. Товар попадает на склад при приёмке.</p>
                  <Button onClick={() => setWhForm({ name: '', region: '', address: '' })} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="new-warehouse-btn"><Plus className="w-4 h-4 mr-1.5" />Добавить склад</Button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {warehouses.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl p-10 text-center text-slate-400 shadow-sm">Складов пока нет. Добавьте первый склад.</div>
                  ) : warehouses.map(w => (
                    <div key={w.id} className="bg-white rounded-2xl p-4 shadow-sm" data-testid={`warehouse-card-${w.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><Warehouse className="w-5 h-5" /></div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{w.name}</p>
                            <p className="text-xs text-teal-600 font-medium flex items-center gap-1"><MapPin className="w-3 h-3" />{w.region}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => setWhForm({ id: w.id, name: w.name, region: w.region, address: w.address || '' })} className="text-slate-400 hover:text-amber-600 p-1" data-testid={`wh-edit-${w.id}`}><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => deleteWarehouse(w.id)} className="text-slate-400 hover:text-rose-500 p-1" data-testid={`wh-delete-${w.id}`}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      {w.address && <p className="text-xs text-slate-400 mt-2">{w.address}</p>}
                      <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100 text-sm">
                        <span className="text-slate-500">Единиц: <b className="text-slate-800">{fmt(w.total_units)}</b></span>
                        <span className="text-slate-500">Позиций: <b className="text-slate-800">{fmt(w.total_skus)}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* RECEIPTS TAB (документы приёмки) */}
            {tab === 'receipts' && (
              <>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <p className="text-sm text-slate-500">Одна поставка = один документ с несколькими товарами. Проведение документа увеличивает остатки и создаёт движения прихода.</p>
                  {!showReceiptForm && (
                    <Button onClick={() => setShowReceiptForm(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl" data-testid="new-receipt-btn"><Plus className="w-4 h-4 mr-1.5" />Новая приёмка</Button>
                  )}
                </div>

                {showReceiptForm && (
                  <div className="bg-white rounded-2xl shadow-sm p-5 mb-6" data-testid="receipt-form">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div><label className="block text-xs text-slate-500 mb-1">Склад приёмки *</label>
                        <select value={rcWarehouse} onChange={(e) => setRcWarehouse(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-emerald-400" data-testid="rc-warehouse">
                          <option value="">— выберите —</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.region})</option>)}
                        </select>
                      </div>
                      <div><label className="block text-xs text-slate-500 mb-1">Поставщик</label><Input value={rcSupplier} onChange={(e) => setRcSupplier(e.target.value)} placeholder="ООО Автозапчасть..." className="rounded-xl" data-testid="rc-supplier" /></div>
                      <div><label className="block text-xs text-slate-500 mb-1">Дата</label><Input type="date" value={rcDate} onChange={(e) => setRcDate(e.target.value)} className="rounded-xl" data-testid="rc-date" /></div>
                      <div><label className="block text-xs text-slate-500 mb-1">Комментарий</label><Input value={rcComment} onChange={(e) => setRcComment(e.target.value)} placeholder="№ накладной, примечание" className="rounded-xl" data-testid="rc-comment" /></div>
                    </div>

                    {/* Product search */}
                    <div className="relative mb-3">
                      <div className="flex gap-2">
                        <Input value={rcSearch} onChange={(e) => setRcSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rcSearchProducts()} placeholder="Найти товар по названию/артикулу для добавления..." className="rounded-xl" data-testid="rc-search" />
                        <Button onClick={rcSearchProducts} variant="outline" className="rounded-xl" data-testid="rc-search-btn">{rcSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Найти'}</Button>
                      </div>
                      {rcResults.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto" data-testid="rc-results">
                          {rcResults.map(p => (
                            <button key={p.id} onClick={() => rcAddItem(p)} className="w-full text-left px-4 py-2 hover:bg-emerald-50 flex items-center justify-between gap-3 border-b border-slate-50 last:border-0" data-testid={`rc-result-${p.id}`}>
                              <div><p className="text-sm font-medium text-slate-800">{p.name}</p><p className="text-xs text-slate-400">{p.article} · остаток {p.stock}</p></div>
                              <Plus className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Items */}
                    {rcItems.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">Добавьте товары в документ через поиск выше</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-slate-500 text-xs uppercase"><tr><th className="text-left py-2">Товар</th><th className="text-right py-2 w-28">Кол-во</th><th className="text-right py-2 w-36">Закуп. цена ₽</th><th className="text-right py-2 w-28">Сумма</th><th className="w-10" /></tr></thead>
                          <tbody>
                            {rcItems.map((it, idx) => (
                              <tr key={it.product_id} className="border-t border-slate-100" data-testid={`rc-item-${it.product_id}`}>
                                <td className="py-2"><p className="font-medium text-slate-800">{it.name}</p><p className="text-xs text-slate-400">{it.article}</p></td>
                                <td className="py-2 text-right"><Input type="number" min="1" value={it.quantity} onChange={(e) => rcUpdateItem(idx, 'quantity', e.target.value)} className="rounded-lg h-9 text-right" data-testid={`rc-qty-${it.product_id}`} /></td>
                                <td className="py-2 text-right"><Input type="number" min="0" value={it.purchase_price} onChange={(e) => rcUpdateItem(idx, 'purchase_price', e.target.value)} className="rounded-lg h-9 text-right" data-testid={`rc-price-${it.product_id}`} /></td>
                                <td className="py-2 text-right font-medium text-slate-700 whitespace-nowrap">{fmt((Number(it.quantity) || 0) * (Number(it.purchase_price) || 0))} ₽</td>
                                <td className="py-2 text-right"><button onClick={() => rcRemoveItem(idx)} className="text-slate-300 hover:text-rose-500" data-testid={`rc-remove-${it.product_id}`}><Trash2 className="w-4 h-4" /></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                      <div className="text-sm text-slate-500">Позиций: <b className="text-slate-800">{rcItems.length}</b> · Итого: <b className="text-emerald-600">{fmt(rcTotalCost)} ₽</b></div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setShowReceiptForm(false); setRcItems([]); setRcSupplier(''); setRcComment(''); }} className="rounded-xl" data-testid="rc-cancel">Отмена</Button>
                        <Button onClick={submitReceipt} disabled={submitting || rcItems.length === 0} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl" data-testid="rc-submit">{submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}Провести приёмку</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Receipts list */}
                <div className="space-y-2">
                  {receipts.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center text-slate-400 shadow-sm">Документов приёмки пока нет</div>
                  ) : receipts.map(r => (
                    <button key={r.id} onClick={async () => { try { const res = await axios.get(`${API}/admin/warehouse/receipts/${r.id}`); setReceiptDetail(res.data); } catch { toast.error('Ошибка'); } }}
                      className="w-full text-left bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-3 flex-wrap hover:shadow-md transition-shadow" data-testid={`receipt-${r.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><ArrowDownCircle className="w-5 h-5" /></div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{r.number}{r.supplier ? ` · ${r.supplier}` : ''}</p>
                          <p className="text-xs text-slate-400">{String(r.date).slice(0, 10)} · {r.positions} поз. · {r.total_units} шт.{r.comment ? ` · ${r.comment}` : ''}</p>
                        </div>
                      </div>
                      <p className="font-bold text-slate-700">{fmt(r.total_cost)} ₽</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* COGS / PROFIT TAB */}
            {tab === 'cogs' && (
              <>
                <div className="flex items-end gap-3 mb-5 flex-wrap">
                  <div><label className="block text-xs text-slate-500 mb-1">С</label><Input type="date" value={cogsStart} onChange={(e) => setCogsStart(e.target.value)} className="rounded-xl" data-testid="cogs-start" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">По</label><Input type="date" value={cogsEnd} onChange={(e) => setCogsEnd(e.target.value)} className="rounded-xl" data-testid="cogs-end" /></div>
                  <Button onClick={fetchCogs} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="cogs-apply">Применить</Button>
                </div>
                {cogs && (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                      <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="cogs-revenue"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-500" /><p className="text-xs text-slate-500">Выручка (продажи)</p></div><p className="text-2xl font-bold text-slate-800">{fmt(cogs.total_revenue)} ₽</p><p className="text-xs text-slate-400">{cogs.total_units} шт · {cogs.sales_count} продаж</p></div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="cogs-cost"><div className="flex items-center gap-2 mb-1"><Coins className="w-4 h-4 text-rose-500" /><p className="text-xs text-slate-500">Себестоимость (COGS)</p></div><p className="text-2xl font-bold text-rose-600">{fmt(cogs.total_cogs)} ₽</p></div>
                      <div className={`rounded-2xl p-4 shadow-sm text-white ${cogs.profit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-rose-500 to-red-600'}`} data-testid="cogs-profit"><div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 opacity-80" /><p className="text-xs opacity-80">Валовая прибыль</p></div><p className="text-2xl font-bold">{fmt(cogs.profit)} ₽</p></div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="cogs-margin"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-indigo-500" /><p className="text-xs text-slate-500">Маржа</p></div><p className="text-2xl font-bold text-indigo-600">{cogs.margin_percent}%</p></div>
                    </div>

                    <h2 className="text-sm font-bold text-slate-700 mb-3">Прибыль по товарам</h2>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr>
                            <th className="text-left px-4 py-3 font-medium">Товар</th>
                            <th className="text-right px-4 py-3 font-medium">Продано</th>
                            <th className="text-right px-4 py-3 font-medium">Выручка</th>
                            <th className="text-right px-4 py-3 font-medium">Себест.</th>
                            <th className="text-right px-4 py-3 font-medium">Прибыль</th>
                            <th className="text-right px-4 py-3 font-medium">Маржа</th>
                          </tr></thead>
                          <tbody>
                            {cogs.products.length === 0 ? (
                              <tr><td colSpan={6} className="text-center py-10 text-slate-400">Нет продаж за период</td></tr>
                            ) : cogs.products.map(p => (
                              <tr key={p.product_id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`cogs-row-${p.product_id}`}>
                                <td className="px-4 py-3"><p className="font-medium text-slate-800">{p.product_name}</p><p className="text-xs text-slate-400">{p.product_article}</p></td>
                                <td className="px-4 py-3 text-right text-slate-700">{p.quantity}</td>
                                <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{fmt(p.revenue)} ₽</td>
                                <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">{fmt(p.cogs)} ₽</td>
                                <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${p.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(p.profit)} ₽</td>
                                <td className="px-4 py-3 text-right text-indigo-600">{p.margin_percent}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* DELIVERY DISPLAY SETTINGS TAB */}
            {tab === 'delivery' && delivery && (
              <>
                <p className="text-sm text-slate-500 mb-5">Настройте, как показывается срок доставки клиентам. Срок рассчитывается автоматически по региону клиента и наличию товара на складах. Даты формируются прибавлением указанных дней к дате заказа.</p>
                <div className="grid lg:grid-cols-3 gap-4">
                  {DELIVERY_STATES.map(st => {
                    const cfg = delivery[st.key] || {};
                    return (
                      <div key={st.key} className="bg-white rounded-2xl shadow-sm p-5" data-testid={`delivery-card-${st.key}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-4 h-4 rounded-full" style={{ background: cfg.color }} />
                          <div>
                            <p className="font-semibold text-slate-800">{st.title}</p>
                            <p className="text-[11px] text-slate-400">{st.hint}</p>
                          </div>
                        </div>
                        <label className="block text-xs text-slate-500 mb-1">Подпись (текст статуса)</label>
                        <Input value={cfg.label || ''} onChange={(e) => updDelivery(st.key, 'label', e.target.value)} className="rounded-xl mb-3" data-testid={`delivery-label-${st.key}`} />
                        <label className="block text-xs text-slate-500 mb-1">Цвет</label>
                        <div className="flex items-center gap-2 mb-3">
                          <input type="color" value={cfgColorFallback(cfg.color)} onChange={(e) => updDelivery(st.key, 'color', e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" data-testid={`delivery-color-${st.key}`} />
                          <Input value={cfg.color || ''} onChange={(e) => updDelivery(st.key, 'color', e.target.value)} className="rounded-xl flex-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="block text-xs text-slate-500 mb-1">Дней (от)</label><Input type="number" min="0" value={cfg.days_min ?? 0} onChange={(e) => updDelivery(st.key, 'days_min', parseInt(e.target.value || '0', 10))} className="rounded-xl" data-testid={`delivery-min-${st.key}`} /></div>
                          <div><label className="block text-xs text-slate-500 mb-1">Дней (до)</label><Input type="number" min="0" value={cfg.days_max ?? 0} onChange={(e) => updDelivery(st.key, 'days_max', parseInt(e.target.value || '0', 10))} className="rounded-xl" data-testid={`delivery-max-${st.key}`} /></div>
                        </div>
                        <div className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: cfg.color, background: (cfg.color || '#000') + '14', border: `1px solid ${(cfg.color || '#000')}55` }}>
                          {cfg.label} · {deliveryPreviewDate(cfg.days_min, cfg.days_max)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button onClick={saveDelivery} disabled={submitting} className="mt-5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="delivery-save-btn">{submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Сохранить настройки</Button>
              </>
            )}

            {/* FINANCE TAB */}
            {tab === 'finance' && finance && (
              <>
                <div className="flex items-end gap-3 mb-5 flex-wrap">
                  <div><label className="block text-xs text-slate-500 mb-1">С</label><Input type="date" value={finStart} onChange={(e) => setFinStart(e.target.value)} className="rounded-xl" data-testid="fin-start" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">По</label><Input type="date" value={finEnd} onChange={(e) => setFinEnd(e.target.value)} className="rounded-xl" data-testid="fin-end" /></div>
                  <Button onClick={fetchFinance} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="fin-apply">Применить</Button>
                  <Button onClick={() => { setFinType('expense'); setFinModal(true); }} variant="outline" className="rounded-xl ml-auto" data-testid="fin-add-btn"><Plus className="w-4 h-4 mr-1" />Запись</Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="fin-income"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-500" /><p className="text-xs text-slate-500">Доходы</p></div><p className="text-2xl font-bold text-emerald-600">{fmt(finance.total_income)} ₽</p><p className="text-xs text-slate-400">авто {fmt(finance.auto_income)} · ручн. {fmt(finance.manual_income)}</p></div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="fin-expense"><div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-rose-500" /><p className="text-xs text-slate-500">Расходы</p></div><p className="text-2xl font-bold text-rose-600">{fmt(finance.total_expense)} ₽</p><p className="text-xs text-slate-400">закупки {fmt(finance.auto_expense)} · ручн. {fmt(finance.manual_expense)}</p></div>
                  <div className={`rounded-2xl p-4 shadow-sm text-white ${finance.profit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-rose-500 to-red-600'}`} data-testid="fin-profit"><div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 opacity-80" /><p className="text-xs opacity-80">Прибыль</p></div><p className="text-2xl font-bold">{fmt(finance.profit)} ₽</p><p className="text-xs opacity-80">{finance.paid_orders_count} оплач. заказов</p></div>
                </div>

                <h2 className="text-sm font-bold text-slate-700 mb-3">Ручные записи</h2>
                <div className="space-y-2">
                  {finance.entries.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center text-slate-400 shadow-sm">Нет ручных записей за период</div>
                  ) : finance.entries.map(e => (
                    <div key={e.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-3" data-testid={`fin-entry-${e.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${e.type === 'income' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>{e.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}</div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{e.category || (e.type === 'income' ? 'Доход' : 'Расход')}</p>
                          <p className="text-xs text-slate-400">{String(e.date).slice(0, 10)}{e.comment ? ` · ${e.comment}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`font-bold ${e.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{e.type === 'income' ? '+' : '−'}{fmt(e.amount)} ₽</p>
                        <button onClick={() => deleteFin(e.id)} className="text-slate-300 hover:text-rose-500" data-testid={`fin-delete-${e.id}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Movement modal */}
      <Dialog open={!!mvModal} onOpenChange={(o) => !o && setMvModal(null)}>
        <DialogContent className="rounded-2xl" data-testid="movement-modal">
          <DialogTitle>{mvModal?.type === 'receipt' ? 'Приход товара' : 'Списание товара'}{mvModal?.bulk ? ' (массово)' : ''}</DialogTitle>
          <DialogDescription>{mvModal?.bulk ? `Будет применено к ${selected.length} товарам` : `${mvModal?.product?.name} · остаток ${mvModal?.product?.stock}`}</DialogDescription>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Склад {mvModal?.type === 'writeoff' ? '(списание)' : '(приход)'}</label>
              <select value={mvWarehouse} onChange={(e) => setMvWarehouse(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-amber-400" data-testid="mv-warehouse-select">
                <option value="">— выберите склад —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.region})</option>)}
              </select>
              {mvModal && !mvModal.bulk && mvModal.type === 'writeoff' && mvModal.product?.warehouses?.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">На складах: {mvModal.product.warehouses.map(w => `${w.warehouse_name}: ${w.quantity}`).join(', ')}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Количество</label>
              <Input type="number" min="1" value={mvQty} onChange={(e) => setMvQty(e.target.value)} className="rounded-xl" data-testid="mv-qty-input" />
            </div>
            {mvModal?.type === 'receipt' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Закупочная цена за ед., ₽</label>
                  <Input type="number" min="0" value={mvPrice} onChange={(e) => setMvPrice(e.target.value)} className="rounded-xl" data-testid="mv-price-input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Поставщик (необязательно)</label>
                  <Input value={mvSupplier} onChange={(e) => setMvSupplier(e.target.value)} className="rounded-xl" data-testid="mv-supplier-input" />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Причина (необязательно)</label>
                <Input value={mvReason} onChange={(e) => setMvReason(e.target.value)} placeholder="Брак, потеря, возврат поставщику..." className="rounded-xl" data-testid="mv-reason-input" />
              </div>
            )}
            <Button onClick={submitMv} disabled={submitting} className={`w-full text-white rounded-xl ${mvModal?.type === 'receipt' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`} data-testid="mv-submit-btn">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}{mvModal?.type === 'receipt' ? 'Оформить приход' : 'Списать'}
            </Button>
            <Button variant="outline" onClick={() => setMvModal(null)} className="w-full rounded-xl" data-testid="mv-cancel-btn">Отмена</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finance entry modal */}
      <Dialog open={finModal} onOpenChange={setFinModal}>
        <DialogContent className="rounded-2xl" data-testid="finance-modal">
          <DialogTitle>Добавить запись</DialogTitle>
          <DialogDescription>Ручной доход или расход</DialogDescription>
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              <button onClick={() => setFinType('expense')} className={`flex-1 py-2 rounded-xl text-sm font-medium ${finType === 'expense' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'}`} data-testid="fin-type-expense">Расход</button>
              <button onClick={() => setFinType('income')} className={`flex-1 py-2 rounded-xl text-sm font-medium ${finType === 'income' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`} data-testid="fin-type-income">Доход</button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Сумма, ₽</label>
              <Input type="number" min="0" value={finAmount} onChange={(e) => setFinAmount(e.target.value)} className="rounded-xl" data-testid="fin-amount-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Категория</label>
              <Input value={finCategory} onChange={(e) => setFinCategory(e.target.value)} placeholder="Аренда, зарплата, реклама..." className="rounded-xl" data-testid="fin-category-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Комментарий</label>
              <Input value={finComment} onChange={(e) => setFinComment(e.target.value)} className="rounded-xl" data-testid="fin-comment-input" />
            </div>
            <Button onClick={submitFin} disabled={submitting} className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="fin-submit-btn">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Сохранить
            </Button>
            <Button variant="outline" onClick={() => setFinModal(false)} className="w-full rounded-xl" data-testid="fin-cancel-btn">Отмена</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warehouse create/edit modal */}
      <Dialog open={!!whForm} onOpenChange={(o) => !o && setWhForm(null)}>
        <DialogContent className="rounded-2xl" data-testid="warehouse-modal">
          <DialogTitle>{whForm?.id ? 'Редактировать склад' : 'Новый склад'}</DialogTitle>
          <DialogDescription>Регион обязателен — по нему рассчитывается срок доставки.</DialogDescription>
          <div className="space-y-3 mt-2">
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Название *</label><Input value={whForm?.name || ''} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} placeholder="Основной склад" className="rounded-xl" data-testid="wh-name-input" /></div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Регион *</label><Input value={whForm?.region || ''} onChange={(e) => setWhForm({ ...whForm, region: e.target.value })} placeholder="Москва" className="rounded-xl" data-testid="wh-region-input" /></div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Адрес (необязательно)</label><Input value={whForm?.address || ''} onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} placeholder="ул. Ленина, 1" className="rounded-xl" data-testid="wh-address-input" /></div>
            <Button onClick={saveWarehouse} disabled={submitting} className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="wh-save-btn">{submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer modal */}
      <Dialog open={!!transferModal} onOpenChange={(o) => !o && setTransferModal(null)}>
        <DialogContent className="rounded-2xl" data-testid="transfer-modal">
          <DialogTitle>Перемещение товара</DialogTitle>
          <DialogDescription>{transferModal?.product?.name}</DialogDescription>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Со склада</label>
              <select value={trFrom} onChange={(e) => setTrFrom(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-blue-400" data-testid="tr-from">
                <option value="">— откуда —</option>
                {(transferModal?.product?.warehouses || []).map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name} ({w.region}) · {w.quantity} шт.</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">На склад</label>
              <select value={trTo} onChange={(e) => setTrTo(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-blue-400" data-testid="tr-to">
                <option value="">— куда —</option>
                {warehouses.filter(w => w.id !== trFrom).map(w => <option key={w.id} value={w.id}>{w.name} ({w.region})</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-500 mb-1">Количество</label><Input type="number" min="1" value={trQty} onChange={(e) => setTrQty(e.target.value)} className="rounded-xl" data-testid="tr-qty" /></div>
            <Button onClick={submitTransfer} disabled={submitting} className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl" data-testid="tr-submit">{submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}Переместить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt detail modal */}
      <Dialog open={!!receiptDetail} onOpenChange={(o) => !o && setReceiptDetail(null)}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="receipt-detail-modal">
          <DialogTitle>Приёмка {receiptDetail?.number}</DialogTitle>
          <DialogDescription>{receiptDetail ? `${String(receiptDetail.date).slice(0, 10)}${receiptDetail.supplier ? ` · ${receiptDetail.supplier}` : ''}${receiptDetail.comment ? ` · ${receiptDetail.comment}` : ''}` : ''}</DialogDescription>
          {receiptDetail && (
            <div className="mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-500 text-xs uppercase"><tr><th className="text-left py-2">Товар</th><th className="text-right py-2">Кол-во</th><th className="text-right py-2">Закуп.</th><th className="text-right py-2">Сумма</th></tr></thead>
                  <tbody>
                    {(receiptDetail.items || []).map((it, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2"><p className="font-medium text-slate-800">{it.product_name}</p><p className="text-xs text-slate-400">{it.product_article} · {it.stock_before} → {it.stock_after}</p></td>
                        <td className="py-2 text-right text-slate-700">{it.quantity}</td>
                        <td className="py-2 text-right text-slate-500 whitespace-nowrap">{fmt(it.unit_cost)} ₽</td>
                        <td className="py-2 text-right font-medium text-slate-700 whitespace-nowrap">{fmt(it.line_cost)} ₽</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 text-sm">
                <span className="text-slate-500">Позиций: <b className="text-slate-800">{receiptDetail.positions}</b> · Единиц: <b className="text-slate-800">{receiptDetail.total_units}</b></span>
                <span className="text-slate-500">Итого: <b className="text-emerald-600">{fmt(receiptDetail.total_cost)} ₽</b></span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
