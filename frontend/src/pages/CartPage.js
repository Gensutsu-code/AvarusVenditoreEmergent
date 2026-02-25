import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowLeft, ShoppingCart, Minus, Plus, Package, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));

  const cartTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (!user) {
    return (
      <div className="min-h-screen relative" data-testid="cart-login-required">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-20 right-20 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
        </div>

        <div className="relative flex items-center justify-center min-h-screen">
          <motion.div 
            className="text-center glass-card p-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ShoppingCart className="w-20 h-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-6">Для просмотра корзины необходимо войти</p>
            <Link to="/login">
              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl shadow-lg shadow-teal-500/30">
                Войти
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen relative" data-testid="cart-empty">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-20 right-20 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/catalog" className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Продолжить покупки
          </Link>
          
          <motion.div 
            className="flex items-center gap-4 mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">Корзина</h1>
          </motion.div>

          <motion.div 
            className="glass-card text-center py-16"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <ShoppingCart className="w-20 h-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-4">Корзина пуста</p>
            <p className="text-slate-400 text-sm mb-6">Добавьте товары из каталога</p>
            <Link to="/catalog">
              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl shadow-lg shadow-teal-500/30">
                Перейти в каталог
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" data-testid="cart-page">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-20 right-20 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-cyan-400/20 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/catalog" className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Продолжить покупки
        </Link>
        
        <motion.div 
          className="flex items-center gap-4 mb-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
              Корзина
            </h1>
            <p className="text-sm text-slate-500">{cart.items.length} товаров</p>
          </div>
        </motion.div>

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
                  className="glass-card p-4 group"
                  data-testid={`cart-item-${item.product_id}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Image */}
                    <Link to={`/product/${item.product_id}`} className="flex-shrink-0">
                      <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden group-hover:shadow-lg transition-shadow">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${item.product_id}`} className="hover:text-teal-600 transition-colors">
                        <h3 className="font-semibold text-slate-800 line-clamp-2 mb-1">{item.name}</h3>
                      </Link>
                      <p className="text-xs font-mono text-slate-500">{item.article}</p>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <p className="font-bold text-xl text-teal-600">{formatPrice(item.price * item.quantity)} <span className="text-sm text-slate-400">₽</span></p>
                      <p className="text-xs text-slate-400">{formatPrice(item.price)} × {item.quantity}</p>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200/50">
                    {/* Quantity */}
                    <div className="flex items-center bg-white/50 rounded-xl overflow-hidden border border-slate-200">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="p-2.5 hover:bg-slate-100 transition-colors text-slate-500"
                      >
                        <Minus className="w-4 h-4" />
                      </motion.button>
                      <span className="px-4 font-bold text-slate-800 min-w-[40px] text-center">{item.quantity}</span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="p-2.5 hover:bg-slate-100 transition-colors text-slate-500"
                      >
                        <Plus className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Remove */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeFromCart(item.product_id)}
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
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
              <h2 className="text-lg font-bold text-slate-800 mb-4">Итого</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Товары ({cart.items.length})</span>
                  <span className="text-slate-800">{formatPrice(cartTotal)} ₽</span>
                </div>
                <div className="border-t border-slate-200/50 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-800">К оплате:</span>
                    <span className="text-2xl font-bold text-teal-600">{formatPrice(cartTotal)} <span className="text-sm text-slate-400">₽</span></span>
                  </div>
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold uppercase h-14 rounded-xl shadow-lg shadow-teal-500/30 transition-all duration-300"
                  data-testid="checkout-button"
                >
                  Оформить заказ
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>

              <p className="text-xs text-slate-400 text-center mt-4">
                Скидки за способ оплаты будут применены на следующем шаге
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
