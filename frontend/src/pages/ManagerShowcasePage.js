import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, LayoutGrid, List, Package, Plus, ArrowLeft, ShoppingCart, MapPin, Truck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { useManagerDraft } from '../lib/managerDraft';
import { money } from '../components/staff/ManagerStats';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SORTS = [['name', 'По названию'], ['price_asc', 'Сначала дешёвые'], ['price_desc', 'Сначала дорогие'], ['stock', 'Больше в наличии'], ['commission', 'Больше мой доход'], ['new', 'Сначала новые']];
const sel = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-teal-400';

const Stock = ({ p }) => (
  <span className={`text-xs font-semibold ${p.stock > 0 ? 'text-emerald-600' : 'text-rose-500'}`} data-testid={`showcase-stock-${p.id}`}>
    {p.stock > 0 ? `В наличии: ${p.stock} шт.` : 'Нет в наличии'}{p.stock > 0 && (p.stock_regions || []).length ? ` · ${p.stock_regions.join(', ')}` : ''}
  </span>
);

// Everything a manager may know about prices: list price, promo, floor price, price for the chosen client, his own earning
const Prices = ({ p, big }) => (
  <div data-testid={`showcase-prices-${p.id}`}>
    <p className={`font-bold text-slate-900 ${big ? 'text-3xl' : 'text-lg'}`}>
      {p.promo_price != null ? <>{money(p.promo_price)} <span className="text-sm font-normal text-slate-400 line-through">{money(p.price)}</span></> : money(p.price)}
      {p.promo_price != null && <span className="ml-2 align-middle text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">{p.discount_label || 'Акция'}</span>}
    </p>
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {p.client_price != null && <span className="font-semibold text-teal-700" data-testid={`showcase-client-price-${p.id}`}>Клиенту: {money(p.client_price)}{p.client_individual ? ' (личная цена)' : ''}</span>}
      {p.min_price > 0 && <span className="text-slate-500" title="Ниже этой цены продавать нельзя" data-testid={`showcase-min-price-${p.id}`}>Мин. цена: {money(p.min_price)}</span>}
      <span className="font-semibold text-emerald-600" title="Ваш заработок с одной штуки по цене прайса" data-testid={`showcase-commission-${p.id}`}>Ваш доход: +{money(p.commission)}</span>
    </div>
  </div>
);

const Thumb = ({ p, cls }) => (
  <div className={`bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0 ${cls}`}>
    {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-slate-300" />}
  </div>
);

const AddButton = ({ p, onAdd, full }) => (
  <Button size="sm" onClick={() => onAdd(p)} disabled={!(p.stock > 0)} className={`bg-teal-500 hover:bg-teal-600 text-white rounded-xl ${full ? 'w-full' : ''}`} data-testid={`showcase-add-${p.id}`}>
    <Plus className="w-4 h-4 mr-1" />В заказ
  </Button>
);

const DraftBar = ({ count }) => (count > 0 ? (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-2xl bg-slate-900 text-white pl-5 pr-2 py-2 shadow-2xl" data-testid="showcase-draft-bar">
    <span className="text-sm"><ShoppingCart className="w-4 h-4 inline mr-1.5" />В заказе позиций: <b>{count}</b></span>
    <Link to="/manager?tab=catalog" className="h-9 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 transition-colors duration-200 flex items-center text-sm font-semibold" data-testid="showcase-go-order">Оформить или отправить клиенту</Link>
  </div>
) : null);

const useClients = (enabled) => {
  const [clients, setClients] = useState([]);
  useEffect(() => { if (enabled) axios.get(`${API}/manager/clients`).then((r) => setClients(r.data)).catch(() => {}); }, [enabled]);
  return clients;
};

const ClientSelect = ({ clients, value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`${sel} max-w-[240px]`} title="Показать цены для клиента" data-testid="showcase-client">
    <option value="">Цена для клиента: не выбран</option>
    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
  </select>
);

export default function ManagerShowcasePage() {
  const { user, loading } = useAuth();
  const isManager = user?.role === 'manager';
  const draft = useManagerDraft();
  const clients = useClients(isManager);
  const [filters, setFilters] = useState({ categories: [], manufacturers: [] });
  const [q, setQ] = useState({ search: '', category_id: '', manufacturer: '', in_stock: false, sort: 'name' });
  const [view, setView] = useState(() => localStorage.getItem('manager_showcase_view') || 'grid');
  const [products, setProducts] = useState(null);
  const clientId = clients.some((c) => c.id === draft.clientId) ? draft.clientId : '';

  useEffect(() => { if (isManager) axios.get(`${API}/manager/products/filters`).then((r) => setFilters(r.data)).catch(() => {}); }, [isManager]);
  const load = useCallback(() => {
    if (isManager) axios.get(`${API}/manager/products`, { params: { ...q, client_id: clientId } }).then((r) => setProducts(r.data)).catch(() => toast.error('Не удалось загрузить товары'));
  }, [isManager, q, clientId]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  if (loading) return null;
  if (!isManager) return <Navigate to="/" replace />;
  const set = (k) => (e) => setQ((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const switchView = (v) => { setView(v); localStorage.setItem('manager_showcase_view', v); };
  const add = (p) => { draft.add(p); toast.success('Добавлено в заказ'); };

  return (
    <div className="min-h-screen pb-24" data-testid="manager-showcase-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Витрина товаров</h1>
        <p className="text-sm text-slate-500 mb-5">Цены, наличие и ваш доход. Закупочные цены не показываются.</p>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[240px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={q.search} onChange={set('search')} placeholder="Название, артикул, кросс-номер, производитель — можно несколько слов" className="pl-9 rounded-xl" data-testid="showcase-search" /></div>
          <select value={q.category_id} onChange={set('category_id')} className={sel} data-testid="showcase-category"><option value="">Все категории</option>{filters.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={q.manufacturer} onChange={set('manufacturer')} className={sel} data-testid="showcase-manufacturer"><option value="">Все производители</option>{filters.manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          <select value={q.sort} onChange={set('sort')} className={sel} data-testid="showcase-sort">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <ClientSelect clients={clients} value={clientId} onChange={draft.setClientId} />
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer"><input type="checkbox" checked={q.in_stock} onChange={set('in_stock')} className="w-4 h-4 accent-teal-500" data-testid="showcase-in-stock" />Только в наличии</label>
          <div className="inline-flex p-1 rounded-xl bg-slate-100 ml-auto" data-testid="showcase-view-switch">
            {[['grid', LayoutGrid, 'Карточки'], ['list', List, 'Список']].map(([v, Icon, label]) => (
              <button key={v} type="button" onClick={() => switchView(v)} title={label} aria-pressed={view === v} className={`h-8 w-9 rounded-lg flex items-center justify-center transition-colors duration-200 ${view === v ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} data-testid={`showcase-view-${v}`}><Icon className="w-4 h-4" /></button>
            ))}
          </div>
        </div>
        {products && <p className="text-xs text-slate-400 mb-3" data-testid="showcase-count">Найдено: {products.length}</p>}
        {!products ? <p className="py-16 text-center text-slate-400">Загрузка…</p> : products.length === 0 ? <p className="py-16 text-center text-slate-400" data-testid="showcase-empty">Товары не найдены</p> : view === 'grid' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="showcase-grid">
            {products.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-3 flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200" data-testid={`showcase-item-${p.id}`}>
                <Link to={`/manager/showcase/${p.id}`} data-testid={`showcase-open-${p.id}`}><Thumb p={p} cls="w-full aspect-[4/3] rounded-xl mb-3" /></Link>
                <Link to={`/manager/showcase/${p.id}`} className="font-semibold text-slate-800 line-clamp-2 hover:text-teal-600">{p.name}</Link>
                <p className="text-[11px] text-slate-400 mb-1"><span className="font-mono">{p.article}</span>{p.manufacturer ? ` · ${p.manufacturer}` : ''}</p>
                <Stock p={p} />
                <div className="mt-2 mb-3 flex-1"><Prices p={p} /></div>
                <AddButton p={p} onAdd={add} full />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100" data-testid="showcase-list">
            {products.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors duration-200" data-testid={`showcase-item-${p.id}`}>
                <Link to={`/manager/showcase/${p.id}`} data-testid={`showcase-open-${p.id}`}><Thumb p={p} cls="w-12 h-12 rounded-lg" /></Link>
                <div className="min-w-0 flex-1 basis-56">
                  <Link to={`/manager/showcase/${p.id}`} className="text-sm font-semibold text-slate-800 line-clamp-1 hover:text-teal-600">{p.name}</Link>
                  <p className="text-[11px] text-slate-400"><span className="font-mono">{p.article}</span>{p.manufacturer ? ` · ${p.manufacturer}` : ''}</p>
                  <Stock p={p} />
                </div>
                <div className="basis-64"><Prices p={p} /></div>
                <AddButton p={p} onAdd={add} />
              </div>
            ))}
          </div>
        )}
      </div>
      <DraftBar count={draft.items.length} />
    </div>
  );
}

export function ManagerProductPage() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const isManager = user?.role === 'manager';
  const draft = useManagerDraft();
  const clients = useClients(isManager);
  const [p, setP] = useState(null);
  const [photo, setPhoto] = useState('');
  const clientId = clients.some((c) => c.id === draft.clientId) ? draft.clientId : '';

  useEffect(() => {
    if (isManager) axios.get(`${API}/manager/products/${id}`, { params: { client_id: clientId } }).then((r) => setP(r.data)).catch(() => setP(false));
  }, [isManager, id, clientId]);

  if (loading) return null;
  if (!isManager) return <Navigate to="/" replace />;
  if (p === false) return <p className="py-24 text-center text-slate-400" data-testid="manager-product-missing">Товар не найден. <Link to="/manager/showcase" className="text-teal-600 underline">Вернуться на витрину</Link></p>;
  if (!p) return <p className="py-24 text-center text-slate-400">Загрузка…</p>;
  const photos = [...new Set([p.image_url, ...(p.images || [])].filter(Boolean))];
  const crosses = (p.cross_articles || '').split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

  return (
    <div className="min-h-screen pb-24" data-testid="manager-product-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/manager/showcase" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-600 mb-5" data-testid="manager-product-back"><ArrowLeft className="w-4 h-4" />Витрина</Link>
        <div className="grid md:grid-cols-5 gap-8">
          <div className="md:col-span-2">
            <Thumb p={{ ...p, image_url: photo || photos[0] }} cls="w-full aspect-square rounded-2xl" />
            {photos.length > 1 && <div className="flex gap-2 mt-2 flex-wrap">{photos.map((src) => <button key={src} type="button" onClick={() => setPhoto(src)} className={`w-14 h-14 rounded-lg overflow-hidden border-2 ${(photo || photos[0]) === src ? 'border-teal-500' : 'border-transparent'}`}><img src={src} alt="" className="w-full h-full object-cover" /></button>)}</div>}
          </div>
          <div className="md:col-span-3">
            <p className="text-xs text-slate-400 mb-1">{p.category_name}{p.category_name && p.manufacturer ? ' · ' : ''}{p.manufacturer}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900" data-testid="manager-product-name">{p.name}</h1>
            <p className="text-sm text-slate-500 mt-1">Артикул: <span className="font-mono text-slate-700">{p.article}</span>{p.is_original ? ' · оригинал' : ''}{p.has_guarantee ? ' · с гарантией' : ''}</p>
            <div className="my-5"><Prices p={p} big /></div>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <AddButton p={p} onAdd={(x) => { draft.add(x); toast.success('Добавлено в заказ'); }} />
              <ClientSelect clients={clients} value={clientId} onChange={draft.setClientId} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4" data-testid="manager-product-stock">
              <p className="font-semibold text-slate-800 text-sm mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-teal-500" />Наличие по складам</p>
              {p.warehouses.length === 0 ? <p className="text-sm text-rose-500">Нет в наличии</p> : p.warehouses.map((w) => (
                <div key={`${w.name}-${w.region}`} className="flex justify-between text-sm py-0.5"><span className="text-slate-600">{w.name} <span className="text-slate-400">· {w.region}</span></span><b className="text-emerald-600">{w.quantity} шт.</b></div>
              ))}
              {p.delivery_days != null && <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" />Срок доставки: {p.delivery_days} дн.</p>}
            </div>
            {crosses.length > 0 && (
              <div className="mb-4" data-testid="manager-product-crosses"><p className="font-semibold text-slate-800 text-sm mb-1.5">Кросс-номера</p><div className="flex flex-wrap gap-1.5">{crosses.map((c) => <span key={c} className="font-mono text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{c}</span>)}</div></div>
            )}
            <p className="font-semibold text-slate-800 text-sm mb-1.5">Описание</p>
            <p className="text-sm text-slate-600 whitespace-pre-line" data-testid="manager-product-description">{p.description || 'Описание не заполнено'}</p>
          </div>
        </div>
      </div>
      <DraftBar count={draft.items.length} />
    </div>
  );
}
