import { useCallback, useEffect, useState } from 'react';

const KEY = 'manager_draft';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

// Order draft of a manager, shared by the showcase, the product page and the "new order" tab
export const useManagerDraft = () => {
  const [state, setState] = useState(() => ({ items: [], clientId: '', ...read() }));
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);

  const add = useCallback((p, quantity = 1) => setState((s) => {
    const max = Math.max(0, p.stock || 0);
    const found = s.items.find((x) => x.id === p.id);
    const items = found
      ? s.items.map((x) => (x.id === p.id ? { ...x, stock: max, quantity: Math.min(x.quantity + quantity, max) } : x))
      : [...s.items, { id: p.id, name: p.name, article: p.article, price: p.price, stock: max, commission: p.commission || 0, quantity: Math.min(quantity, max) }];
    return { ...s, items };
  }), []);
  const changeQty = useCallback((id, delta) => setState((s) => ({ ...s, items: s.items.map((x) => (x.id === id ? { ...x, quantity: Math.max(1, Math.min(x.stock, x.quantity + delta)) } : x)) })), []);
  const remove = useCallback((id) => setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== id) })), []);
  const clear = useCallback(() => setState((s) => ({ ...s, items: [] })), []);
  const setClientId = useCallback((clientId) => setState((s) => ({ ...s, clientId })), []);
  const replace = useCallback((items, clientId) => setState({ items, clientId }), []);

  return { items: state.items, clientId: state.clientId, add, changeQty, remove, clear, setClientId, replace };
};
