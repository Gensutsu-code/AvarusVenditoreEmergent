import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ListChecks, Package, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const money = (n) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(n) || 0)} ₽`;

const SelectionItem = ({ item, sid, onAdd, isDark }) => (
  <div className="flex flex-wrap items-center gap-3 py-2" data-testid={`selection-item-${sid}-${item.product_id}`}>
    <Link to={`/product/${item.product_id}`} className={`w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
      {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300" />}
    </Link>
    <div className="min-w-0 flex-1 basis-48">
      <Link to={`/product/${item.product_id}`} className={`text-sm font-semibold line-clamp-1 hover:text-teal-600 ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{item.name}</Link>
      <p className="text-[11px] text-slate-400"><span className="font-mono">{item.article}</span>{item.manufacturer ? ` · ${item.manufacturer}` : ''}</p>
      <p className={`text-xs font-semibold ${item.stock > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{item.stock > 0 ? `В наличии: ${item.stock} шт.` : 'Нет в наличии'}</p>
    </div>
    <span className={`text-sm whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{item.quantity} шт. × <b>{money(item.price)}</b></span>
    <Button size="sm" variant="outline" disabled={!(item.stock > 0)} onClick={() => onAdd([item])} data-testid={`selection-add-${sid}-${item.product_id}`}><ShoppingCart className="w-4 h-4" /></Button>
  </div>
);

// Client account: lists of parts prepared by the personal manager
export const ManagerSelections = ({ isDark = false }) => {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const { addToCart } = useCart();
  const load = useCallback(() => axios.get(`${API}/my-selections`).then((r) => setList(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!list.length) return null;

  const add = async (items) => {
    setBusy(true);
    let added = 0;
    for (const i of items.filter((x) => x.stock > 0)) {
      if (await addToCart(i.product_id, Math.min(i.quantity, i.stock))) added += 1;
    }
    setBusy(false);
    if (added) toast.success(added === 1 ? 'Товар добавлен в корзину' : `В корзину добавлено позиций: ${added}`);
  };
  const remove = async (id) => {
    try { await axios.delete(`${API}/my-selections/${id}`); toast.success('Подборка удалена'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Не удалось удалить подборку'); }
  };

  return (
    <div className="mb-6 space-y-4" data-testid="manager-selections">
      {list.map((s) => (
        <div key={s.id} className={`rounded-2xl border p-4 ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-teal-200 bg-white'}`} data-testid={`selection-${s.id}`}>
          <div className="flex flex-wrap items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0"><ListChecks className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>Подборка от менеджера</p>
              <p className="text-xs text-slate-400">{s.manager_name}{s.manager_name ? ' · ' : ''}{new Date(s.created_at).toLocaleDateString('ru-RU')}</p>
              {s.note && <p className={`text-sm mt-1 whitespace-pre-line ${isDark ? 'text-zinc-300' : 'text-slate-600'}`} data-testid={`selection-note-${s.id}`}>{s.note}</p>}
            </div>
            <button type="button" onClick={() => remove(s.id)} title="Удалить подборку" className="p-2 text-slate-400 hover:text-rose-500 transition-colors duration-200" data-testid={`selection-delete-${s.id}`}><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className={`mt-2 divide-y ${isDark ? 'divide-zinc-800' : 'divide-slate-100'}`}>
            {s.items.length === 0 && <p className="py-2 text-sm text-slate-400">Товары этой подборки больше не продаются</p>}
            {s.items.map((i) => <SelectionItem key={i.product_id} item={i} sid={s.id} onAdd={add} isDark={isDark} />)}
          </div>
          {s.items.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>Итого: <b data-testid={`selection-total-${s.id}`}>{money(s.total)}</b> <span className="text-xs text-slate-400">— точная сумма посчитается в корзине</span></p>
              <Button onClick={() => add(s.items)} disabled={busy || !s.items.some((i) => i.stock > 0)} className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl" data-testid={`selection-add-all-${s.id}`}><ShoppingCart className="w-4 h-4 mr-1.5" />Добавить всё в корзину</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
