import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(false);
  const { user, token } = useAuth();
  const pendingUpdates = useRef({});
  const debounceTimers = useRef({});

  useEffect(() => {
    if (user && token) {
      fetchCart();
    } else {
      setCart({ items: [] });
    }
  }, [user, token]);

  const fetchCart = async () => {
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
  };

  const addToCart = async (productId, quantity = 1) => {
    if (!token) return false;
    try {
      await axios.post(`${API}/cart/add`, { product_id: productId, quantity });
      await fetchCart();
      return true;
    } catch (err) {
      console.error('Failed to add to cart', err);
      return false;
    }
  };

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
          await axios.post(`${API}/cart/update`, { product_id: productId, quantity: finalQuantity });
        }
      } catch (err) {
        console.error('Failed to update cart', err);
        // Revert on error
        fetchCart();
      }
    }, 300);
  }, [token]);

  const removeFromCart = async (productId) => {
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
  };

  const clearCart = async () => {
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
  };

  const cartTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ 
      cart, 
      loading, 
      addToCart, 
      updateQuantity, 
      removeFromCart, 
      clearCart, 
      fetchCart,
      cartTotal,
      cartCount 
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
