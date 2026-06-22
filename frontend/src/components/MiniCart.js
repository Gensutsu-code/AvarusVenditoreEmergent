import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShoppingCart, Truck, Trash2, ArrowRight, Package, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));

export const MiniCart = () => {
  const { cart, cartCount, cartTotal, removeFromCart } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [delivery, setDelivery] = useState({ min_free_delivery: 5000, delivery_enabled: true });

  useEffect(() => {
    axios.get(`${API}/delivery-settings`).then((r) => setDelivery(r.data)).catch(() => {});
  }, []);

  const items = cart.items || [];
  const visibleItems = items.slice(0, 4);
  const extraCount = items.length - visibleItems.length;

  const showDeliveryBar = delivery.delivery_enabled && delivery.min_free_delivery > 0;
  const remaining = Math.max(0, delivery.min_free_delivery - cartTotal);
  const reached = remaining <= 0;
  const pct = showDeliveryBar ? Math.min(100, (cartTotal / delivery.min_free_delivery) * 100) : 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      data-testid="mini-cart"
    >
      <Link to="/cart" data-testid="cart-link">
        <motion.div
          className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer relative"
          initial="rest"
          whileHover="hover"
          whileTap={{ scale: 0.95 }}
          variants={{
            rest: { scale: 1, backgroundColor: 'rgba(249, 115, 22, 0)' },
            hover: { scale: 1.08, backgroundColor: 'rgba(249, 115, 22, 0.1)' },
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <motion.div
            variants={{ rest: { x: 0, color: '#475569' }, hover: { x: [0, -3, 3, -3, 0], color: '#f97316' } }}
            transition={{ duration: 0.4 }}
          >
            <ShoppingCart className="w-5 h-5" />
          </motion.div>
          <motion.span
            className="hidden lg:inline text-sm font-medium"
            variants={{ rest: { color: '#475569' }, hover: { color: '#f97316' } }}
          >
            Корзина
          </motion.span>
          {cartCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              variants={{ rest: { scale: 1 }, hover: { scale: 1.2 } }}
              className="absolute -top-1 -right-1 lg:relative lg:top-0 lg:right-0 lg:ml-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs w-5 h-5 flex items-center justify-center font-bold rounded-full shadow-lg"
            >
              {cartCount}
            </motion.span>
          )}
        </motion.div>
      </Link>

      <AnimatePresence>
        {open && cartCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full pt-2 w-80 z-50"
            data-testid="mini-cart-dropdown"
          >
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
              {/* Free delivery progress */}
              {showDeliveryBar && (
                <div className="px-4 pt-4 pb-3 border-b border-slate-100" data-testid="mini-cart-free-delivery">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      {reached ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Бесплатная доставка!</span>
                        </>
                      ) : (
                        <>
                          <Truck className="w-3.5 h-3.5 text-rose-500" />
                          <span>
                            До бесплатной осталось{' '}
                            <span className="font-bold text-rose-600">{formatPrice(remaining)} ₽</span>
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${reached ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-rose-400 to-pink-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {visibleItems.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    data-testid={`mini-cart-item-${item.product_id}`}
                  >
                    <Link to={`/product/${item.product_id}`} className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/product/${item.product_id}`}>
                        <p className="text-xs font-medium text-slate-800 truncate hover:text-teal-600 transition-colors">{item.name}</p>
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.quantity} × {formatPrice(item.price)} ₽
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold text-slate-800 whitespace-nowrap">{formatPrice(item.price * item.quantity)} ₽</span>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFromCart(item.product_id); }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        data-testid={`mini-cart-remove-${item.product_id}`}
                        aria-label="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {extraCount > 0 && (
                  <Link to="/cart" className="block px-4 py-2 text-xs text-center text-teal-600 hover:text-teal-700 font-medium">
                    и ещё {extraCount} {extraCount === 1 ? 'товар' : extraCount < 5 ? 'товара' : 'товаров'} →
                  </Link>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-500">Итого</span>
                  <span className="text-lg font-bold text-teal-600">{formatPrice(cartTotal)} ₽</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/cart')}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-colors"
                    data-testid="mini-cart-view"
                  >
                    В корзину
                  </button>
                  <button
                    onClick={() => navigate('/checkout')}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-teal-500/30 transition-all flex items-center justify-center gap-1"
                    data-testid="mini-cart-checkout"
                  >
                    Оформить <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
