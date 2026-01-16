import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(false);
  const { user, token } = useAuth();

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

  const updateQuantity = async (productId, quantity) => {
    if (!token) return;
    try {
      await axios.post(`${API}/cart/update`, { product_id: productId, quantity });
      await fetchCart();
    } catch (err) {
      console.error('Failed to update cart', err);
    }
  };

  const removeFromCart = async (productId) => {
    if (!token) return;
    try {
      await axios.delete(`${API}/cart/${productId}`);
      await fetchCart();
    } catch (err) {
      console.error('Failed to remove from cart', err);
    }
  };

  const clearCart = async () => {
    if (!token) return;
    try {
      await axios.delete(`${API}/cart`);
      setCart({ items: [] });
    } catch (err) {
      console.error('Failed to clear cart', err);
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
