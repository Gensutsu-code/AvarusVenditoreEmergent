import { useSyncExternalStore } from 'react';

const KEY = 'manager_draft';
const read = () => { try { return { items: [], clientId: '', ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { items: [], clientId: '' }; } };

// One draft for the whole cabinet: showcase, product page, orders tab and "new order" tab see the same state
let state = read();
const listeners = new Set();
const update = (fn) => {
  state = fn(state);
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
};
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

const add = (p, quantity = 1) => update((s) => {
  const max = Math.max(0, p.stock || 0);
  const found = s.items.find((x) => x.id === p.id);
  const items = found
    ? s.items.map((x) => (x.id === p.id ? { ...x, stock: max, quantity: Math.min(x.quantity + quantity, max) } : x))
    : [...s.items, { id: p.id, name: p.name, article: p.article, price: p.price, stock: max, commission: p.commission || 0, quantity: Math.min(quantity, max) }];
  return { ...s, items };
});
const changeQty = (id, delta) => update((s) => ({ ...s, items: s.items.map((x) => (x.id === id ? { ...x, quantity: Math.max(1, Math.min(x.stock, x.quantity + delta)) } : x)) }));
const remove = (id) => update((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) }));
const clear = () => update((s) => ({ ...s, items: [] }));
const setClientId = (clientId) => update((s) => ({ ...s, clientId }));
const replace = (items, clientId) => update(() => ({ items, clientId }));

export const useManagerDraft = () => {
  const s = useSyncExternalStore(subscribe, () => state);
  return { items: s.items, clientId: s.clientId, add, changeQty, remove, clear, setClientId, replace };
};
