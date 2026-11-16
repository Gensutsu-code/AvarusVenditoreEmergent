import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const token = !!user;
  const pendingUpdates = useRef({});
  const debounceTimers = useRef({});

  // Cleanup all pending timers on unmount to prevent ref leaks that confuse
  // third-party DOM walkers (e.g., PostHog session recorder) during navigation
  useEffect(() => {
    const timers = debounceTimers.current;
    const pending = pendingUpdates.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
      Object.keys(timers).forEach((k) => delete timers[k]);
      Object.keys(pending).forEach((k) => delete pending[k]);
    };
  }, []);

  const fetchCart = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/cart`);
      setCart(res.data);
    } catch (err) {
      console.error('Failed to fetch cart', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      fetchCart();
    } else {
      setCart({ items: [] });
    }
  }, [user, token, fetchCart]);

  const addToCart = useCallback(async (productId, quantity = 1) => {
    if (!token) return false;
    try {
      await axios.post(`${API}/cart/add`, { product_id: productId, quantity });
      await fetchCart();
      return true;
    } catch (err) {
      console.error('Failed to add to cart', err);
      return false;
    }
  }, [token, fetchCart]);

  // Optimistic update with debounce for API call
  const updateQuantity = useCallback((productId, quantity) => {
    if (!token) return;
    
    const newQuantity = Math.max(0, quantity);
    
    // Optimistic UI update immediately
    setCart(prev => ({
      ...prev,
      items: newQuantity === 0 
        ? prev.items.filter(item => item.product_id !== productId)
        : prev.items.map(item => 
            item.product_id === productId 
              ? { ...item, quantity: newQuantity }
              : item
          )
    }));

    // Clear existing timer for this product
    if (debounceTimers.current[productId]) {
      clearTimeout(debounceTimers.current[productId]);
    }

    // Store pending update
    pendingUpdates.current[productId] = newQuantity;

    // Debounced API call (300ms delay)
    debounceTimers.current[productId] = setTimeout(async () => {
      const finalQuantity = pendingUpdates.current[productId];
      delete pendingUpdates.current[productId];
      
      try {
        if (finalQuantity === 0) {
          await axios.delete(`${API}/cart/${productId}`);
        } else {
          const res = await axios.post(`${API}/cart/update`, { product_id: productId, quantity: finalQuantity });
          // Apply server-recomputed prices (tier/quantity discounts) instantly,
          // but only if the user hasn't queued another change in the meantime.
          if (res?.data?.items && !(productId in pendingUpdates.current)) {
            setCart(res.data);
          }
        }
      } catch (err) {
        console.error('Failed to update cart', err);
        // Revert on error
        fetchCart();
      }
    }, 300);
  }, [token, fetchCart]);

  const removeFromCart = useCallback(async (productId) => {
    if (!token) return;
    
    // Optimistic removal
    setCart(prev => ({
      ...prev,
      items: prev.items.filter(item => item.product_id !== productId)
    }));
    
    // Clear any pending updates
    if (debounceTimers.current[productId]) {
      clearTimeout(debounceTimers.current[productId]);
      delete debounceTimers.current[productId];
    }
    delete pendingUpdates.current[productId];
    
    try {
      await axios.delete(`${API}/cart/${productId}`);
    } catch (err) {
      console.error('Failed to remove from cart', err);
      fetchCart();
    }
  }, [token, fetchCart]);

  const clearCart = useCallback(async () => {
    if (!token) return;
    
    // Clear all pending
    Object.values(debounceTimers.current).forEach(timer => clearTimeout(timer));
    debounceTimers.current = {};
    pendingUpdates.current = {};
    
    setCart({ items: [] });
    
    try {
      await axios.delete(`${API}/cart`);
    } catch (err) {
      console.error('Failed to clear cart', err);
      fetchCart();
    }
  }, [token, fetchCart]);

  const cartTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  // Memoize context value so the provider does not emit a fresh object every
  // render — otherwise downstream observers (PostHog rrweb, devtools, etc.)
  // re-walk closures containing refs and may stack-overflow on navigation.
  const value = useMemo(
    () => ({
      cart,
      loading,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      fetchCart,
      cartTotal,
      cartCount,
    }),
    [cart, loading, addToCart, updateQuantity, removeFromCart, clearCart, fetchCart, cartTotal, cartCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
