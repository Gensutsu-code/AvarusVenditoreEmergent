import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Search, Plus, Minus, Trash2, Loader2, ChevronDown, ChevronRight, Package, RotateCcw, Send } from 'lucide-react';
import { useManagerDraft } from '../../lib/managerDraft';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { PeriodSwitch, ManagerStatsView, money } from './ManagerStats';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const err = (e) => { const d = e.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Проверьте заполнение полей'); };
const STATUS = { pending: 'Новый', processing: 'В работе', shipped: 'Отправлен', delivered: 'Доставлен', completed: 'Выполнен', cancelled: 'Отменён' };
const PAY = { cash: 'Наличные', card: 'Карта (клиент оплатит позже)', balance: 'С баланса клиента', deferral: 'В отсрочку' };
const Spinner = () => <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-500" /></div>;

// Statistics of one client of the manager
export const ClientStatsModal = ({ client, onClose }) => {
  const [period, setPeriod] = useState('all');
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (client) axios.get(`${API}/manager/clients/${client.id}/stats`, { params: { period } }).then((r) => setStats(r.data)).catch(err);
  }, [client, period]);
  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="manager-client-stats-modal">
        <DialogHeader><DialogTitle>Статистика клиента: {client?.name}</DialogTitle></DialogHeader>
        <PeriodSwitch value={period} onChange={setPeriod} />
        <ManagerStatsView stats={stats} />
      </DialogContent>
    </Dialog>
  );
};

// Orders of the manager's clients
export const ManagerOrdersTab = ({ onRepeat }) => {
  const [orders, setOrders] = useState(null);
  const [open, setOpen] = useState(null);
  const draft = useManagerDraft();
  // Puts the goods of an old order into the new-order draft with today's prices and stock
  const repeat = async (o) => {
    try {
      const ids = o.items.map((i) => i.product_id).filter(Boolean);
      const r = ids.length ? await axios.get(`${API}/manager/products`, { params: { ids: ids.join(',') } }) : { data: [] };
      const live = Object.fromEntries(r.data.map((p) => [p.id, p]));
      const items = o.items.filter((i) => (live[i.product_id]?.stock || 0) > 0).map((i) => {
        const p = live[i.product_id];
        return { id: p.id, name: p.name, article: p.article, price: p.price, stock: p.stock, commission: p.commission || 0, quantity: Math.min(i.quantity, p.stock) };
      });
      if (!items.length) { toast.error('Товаров этого заказа сейчас нет в наличии'); return; }
      draft.replace(items, o.user_id);
      const short = items.length < o.items.length || items.some((x, n) => x.quantity < o.items.find((i) => i.product_id === x.id).quantity);
      toast.success(short ? 'Заказ перенесён частично: части товаров не хватает на складе' : 'Товары перенесены в новый заказ');
      onRepeat();
    } catch (e) { err(e); }
  };
  useEffect(() => { axios.get(`${API}/manager/orders`).then((r) => setOrders(r.data)).catch(err); }, []);
  if (!orders) return <Spinner />;
  if (!orders.length) return <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400" data-testid="manager-orders-empty">У ваших клиентов пока нет заказов</div>;
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden" data-testid="manager-orders">
      {orders.map((o) => (
        <div key={o.id} className="border-b border-slate-100 last:border-0">
          <button onClick={() => setOpen(open === o.id ? null : o.id)} className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors" data-testid={`manager-order-${o.id}`}>
            {open === o.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            <span className="text-sm font-mono text-slate-500">#{o.id.slice(0, 8)}</span>
            <span className="text-sm font-medium text-slate-800 flex-1 truncate">{o.client_name}</span>
            {o.created_by_manager && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white">оформлен вами</span>}
            <span className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString('ru-RU')}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{STATUS[o.status] || o.status}</span>
            <span className="text-sm font-semibold text-slate-800 w-24 text-right">{money(o.total)}</span>
            {o.commission != null && <span className="text-xs font-semibold text-emerald-600 w-28 text-right" data-testid={`manager-order-commission-${o.id}`}>ваш доход {money(o.commission)}</span>}
          </button>
          {open === o.id && (
            <div className="px-11 pb-3 text-sm text-slate-600 space-y-1">
              {o.items.map((i, idx) => <div key={idx} className="flex gap-3"><span className="flex-1 truncate">{i.name} <span className="font-mono text-[11px] text-slate-400">{i.article}</span></span><span>{i.quantity} шт. × {money(i.price)}</span>{i.commission != null && <span className="w-24 text-right font-semibold text-emerald-600" data-testid={`manager-order-${o.id}-item-${idx}-commission`}>+{money(i.commission)}</span>}</div>)}
              <p className="text-xs text-slate-400 pt-1">{o.address}{o.phone ? ` · ${o.phone}` : ''}{o.comment ? ` · ${o.comment}` : ''}</p>
              <Button size="sm" variant="outline" onClick={() => repeat(o)} className="mt-2" data-testid={`manager-order-repeat-${o.id}`}><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Повторить заказ</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Catalog (stock + selling prices, no purchase prices) and placing an order for a client
export const ManagerCatalogTab = ({ clients }) => {
  const [search, setSearch] = useState('');
  const [inStock, setInStock] = useState(true);
  const [products, setProducts] = useState(null);
  const [sort, setSort] = useState('name');
  const shared = useManagerDraft();
  const draft = shared.items;
  const [fields, setFields] = useState({ payment_method: 'cash', address: '', phone: '', comment: '' });
  // the chosen client lives in the shared draft, so the showcase shows prices for the same client
  const user_id = clients.some((c) => c.id === shared.clientId) ? shared.clientId : '';
  const form = { ...fields, user_id };
  const setForm = ({ user_id: uid, ...rest }) => { setFields(rest); if (uid !== user_id) shared.setClientId(uid); };
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => axios.get(`${API}/manager/products`, { params: { search, in_stock: inStock, sort, client_id: user_id } }).then((r) => setProducts(r.data)).catch(err), [search, inStock, sort, user_id]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const add = (p) => shared.add(p);
  const qty = shared.changeQty;
  const pickClient = (id) => { const c = clients.find((x) => x.id === id); setForm({ ...form, user_id: id, phone: c?.phone || form.phone }); };
  const submit = async () => {
    if (!form.user_id) { toast.error('Выберите клиента'); return; }
    if (!draft.length) { toast.error('Добавьте товары в заказ'); return; }
    if (!form.address.trim() || !form.phone.trim()) { toast.error('Укажите адрес и телефон'); return; }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/manager/clients/${form.user_id}/orders`, { items: draft.map((x) => ({ product_id: x.id, quantity: x.quantity })), payment_method: form.payment_method, address: form.address, phone: form.phone, comment: form.comment });
      toast.success(`Заказ #${r.data.id.slice(0, 8)} оформлен на ${money(r.data.total)}`);
      shared.clear(); load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const sendSelection = async () => {
    if (!form.user_id) { toast.error('Выберите клиента'); return; }
    if (!draft.length) { toast.error('Добавьте товары'); return; }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/manager/clients/${form.user_id}/selection`, { items: draft.map((x) => ({ product_id: x.id, quantity: x.quantity })), note: form.comment });
      toast.success(`Подборка из ${r.data.sent} поз. отправлена клиенту в личный кабинет`);
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  const sel = 'w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-teal-400';

  return (
    <div className="grid lg:grid-cols-5 gap-5" data-testid="manager-catalog">
      <div className="lg:col-span-3">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative flex-1 min-w-[220px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Название, артикул, кросс-номер, производитель" className="pl-9" data-testid="manager-product-search" /></div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer"><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="w-4 h-4 accent-teal-500" data-testid="manager-in-stock-toggle" />Только в наличии</label>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" data-testid="manager-product-sort">
            <option value="name">По названию</option><option value="price_asc">Сначала дешёвые</option><option value="price_desc">Сначала дорогие</option><option value="stock">Больше в наличии</option><option value="commission">Больше мой доход</option>
          </select>
          <Link to="/manager/showcase" className="text-sm font-semibold text-teal-600 hover:underline" data-testid="manager-open-showcase">Открыть витрину</Link>
        </div>
        {!products ? <Spinner /> : products.length === 0 ? <p className="py-10 text-center text-slate-400">Товары не найдены</p> : (
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 max-h-[640px] overflow-y-auto" data-testid="manager-products">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5" data-testid={`manager-product-${p.id}`}>
                <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">{p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-slate-300" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{p.name}</p>
                  <p className="text-[11px] text-slate-400"><span className="font-mono">{p.article}</span>{p.manufacturer ? ` · ${p.manufacturer}` : ''}{(p.stock_regions || []).length ? ` · ${p.stock_regions.join(', ')}` : ''}</p>
                </div>
                <span className={`text-xs font-semibold w-20 text-right ${p.stock > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{p.stock > 0 ? `${p.stock} шт.` : 'нет'}</span>
                <span className="text-sm font-semibold text-slate-800 w-28 text-right">{money(p.promo_price ?? p.price)}{p.client_price != null && <span className="block text-[11px] font-semibold text-teal-700" data-testid={`manager-product-client-price-${p.id}`}>клиенту {money(p.client_price)}</span>}</span>
                <span className="text-xs font-semibold text-emerald-600 w-24 text-right" title="Ваш заработок с одной штуки по цене прайса" data-testid={`manager-product-commission-${p.id}`}>+{money(p.commission)}</span>
                <Button size="sm" onClick={() => add(p)} disabled={!(p.stock > 0)} className="bg-teal-500 hover:bg-teal-600 text-white" data-testid={`manager-add-product-${p.id}`}><Plus className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 h-fit lg:sticky lg:top-24" data-testid="manager-order-form">
        <p className="font-semibold text-slate-800 mb-3">Заказ для клиента</p>
        <select value={form.user_id} onChange={(e) => pickClient(e.target.value)} className={sel} data-testid="manager-order-client">
          <option value="">— выберите клиента —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
        </select>
        <div className="my-3 space-y-1.5" data-testid="manager-order-draft">
          {draft.length === 0 && <p className="text-sm text-slate-400">Добавьте товары кнопкой «+» из списка слева</p>}
          {draft.map((x) => (
            <div key={x.id} className="flex items-center gap-2 text-sm" data-testid={`manager-draft-${x.id}`}>
              <span className="flex-1 truncate text-slate-700">{x.name}</span>
              <span className="text-xs font-semibold text-emerald-600 whitespace-nowrap" data-testid={`manager-draft-commission-${x.id}`}>+{money(x.commission * x.quantity)}</span>
              <button onClick={() => qty(x.id, -1)} className="p-1 rounded border border-slate-200"><Minus className="w-3 h-3" /></button>
              <span className="w-7 text-center font-semibold">{x.quantity}</span>
              <button onClick={() => qty(x.id, 1)} className="p-1 rounded border border-slate-200"><Plus className="w-3 h-3" /></button>
              <button onClick={() => shared.remove(x.id)} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
        {draft.length > 0 && <p className="text-sm text-slate-500 mb-3">По прайсу: <b className="text-slate-800">{money(draft.reduce((s, x) => s + x.price * x.quantity, 0))}</b>. Итог со скидками и доставкой клиента посчитается при оформлении.<br />Ваш заработок по прайсу: <b className="text-emerald-600" data-testid="manager-draft-commission-total">{money(draft.reduce((s, x) => s + x.commission * x.quantity, 0))}</b> — скидки клиента его уменьшат.</p>}
        <div className="space-y-2">
          <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={sel} data-testid="manager-order-payment">
            {Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Адрес доставки *" data-testid="manager-order-address" />
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Телефон *" data-testid="manager-order-phone" />
          <Input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Комментарий" maxLength={1000} data-testid="manager-order-comment" />
          <Button onClick={submit} disabled={busy} className="w-full bg-teal-500 hover:bg-teal-600 text-white" data-testid="manager-order-submit">{busy ? 'Оформление…' : 'Оформить заказ'}</Button>
          <Button onClick={sendSelection} disabled={busy} variant="outline" className="w-full" title="Клиент увидит список товаров со своими ценами в личном кабинете и сможет добавить их в корзину" data-testid="manager-send-selection"><Send className="w-4 h-4 mr-1.5" />Отправить подборку клиенту</Button>
        </div>
      </div>
    </div>
  );
};
