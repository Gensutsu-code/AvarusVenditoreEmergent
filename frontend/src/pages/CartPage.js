import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowLeft, ShoppingCart, Minus, Plus, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));

  // Simple cart total without discounts
  const cartTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950" data-testid="cart-login-required">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ShoppingCart className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
          <p className="text-zinc-400 text-lg mb-4">Для просмотра корзины необходимо войти</p>
          <Link to="/login">
            <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl">Войти</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950" data-testid="cart-empty">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/catalog" className="inline-flex items-center gap-2 text-zinc-500 hover:text-orange-400 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Продолжить покупки
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-100 mb-8">Корзина</h1>
          <motion.div 
            className="glass-card text-center py-16"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <ShoppingCart className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
            <p className="text-zinc-400 text-lg mb-4">Корзина пуста</p>
            <p className="text-zinc-500 text-sm mb-6">Добавьте товары из каталога</p>
            <Link to="/catalog">
              <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl">Перейти в каталог</Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950" data-testid="cart-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/catalog" className="inline-flex items-center gap-2 text-zinc-500 hover:text-orange-400 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Продолжить покупки
        </Link>
        
        <motion.h1 
          className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-100 mb-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          Корзина <span className="text-orange-400">({cart.items.length})</span>
        </motion.h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="popLayout">
              {cart.items.map((item, index) => (
                <motion.div
                  key={item.product_id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="glass-card p-4"
                  data-testid={`cart-item-${item.product_id}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Image */}
                    <Link to={`/catalog?search=${item.article}`} className="flex-shrink-0">
                      <div className="w-20 h-20 bg-zinc-800/50 rounded-xl overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Package className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link to={`/catalog?search=${item.article}`} className="hover:text-orange-400 transition-colors">
                        <h3 className="font-semibold text-zinc-100 line-clamp-2 mb-1">{item.name}</h3>
                      </Link>
                      <p className="text-xs font-mono text-zinc-500">{item.article}</p>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <p className="font-bold text-lg text-orange-400">{formatPrice(item.price * item.quantity)} ₽</p>
                      <p className="text-xs text-zinc-500">{formatPrice(item.price)} × {item.quantity}</p>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800/50">
                    {/* Quantity */}
                    <div className="flex items-center bg-zinc-800/50 rounded-xl overflow-hidden border border-zinc-700/50">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="p-2 hover:bg-zinc-700/50 transition-colors text-zinc-400"
                      >
                        <Minus className="w-4 h-4" />
                      </motion.button>
                      <span className="px-4 font-semibold text-zinc-100 min-w-[40px] text-center">{item.quantity}</span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="p-2 hover:bg-zinc-700/50 transition-colors text-zinc-400"
                      >
                        <Plus className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Remove */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeFromCart(item.product_id)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                      data-testid={`remove-item-${item.product_id}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <motion.div 
              className="glass-card p-6 sticky top-24"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-lg font-bold text-zinc-100 mb-4">Итого</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Товары ({cart.items.length})</span>
                  <span className="text-zinc-100">{formatPrice(cartTotal)} ₽</span>
                </div>
                <div className="border-t border-zinc-800/50 pt-3">
                  <div className="flex justify-between">
                    <span className="font-semibold text-zinc-100">Итого:</span>
                    <span className="text-xl font-bold text-orange-400">{formatPrice(cartTotal)} ₽</span>
                  </div>
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold uppercase h-12 rounded-xl shadow-glow transition-all duration-300"
                  data-testid="checkout-button"
                >
                  Оформить заказ
                </Button>
              </motion.div>

              <p className="text-xs text-zinc-500 text-center mt-4">
                Скидки и наценки за способ оплаты будут применены на следующем шаге
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
