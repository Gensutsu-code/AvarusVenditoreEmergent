import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Trash2, ArrowLeft, ShoppingCart, Minus, Plus, Package, ArrowRight, TrendingUp, Truck, PartyPopper, Award } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { trackClick } from '../utils/tracker';
import { getCartUpsell } from '../utils/productHelpers';
import { OzonCertificateBar } from '../components/OzonCertificateBar';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Pre-generated confetti pieces (deterministic per session) for the free-delivery celebration
const CONFETTI = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: (Math.random() * 2 - 1) * 220,
  rise: 40 + Math.random() * 70,
  rot: (Math.random() * 2 - 1) * 360,
  delay: Math.random() * 0.18,
  color: ['#fb7185', '#34d399', '#fbbf24', '#2dd4bf', '#f472b6', '#a78bfa'][i % 6],
  left: 10 + Math.random() * 80,
}));

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [delivery, setDelivery] = useState({ min_free_delivery: 5000, delivery_price: 500, delivery_enabled: true });
  useEffect(() => {
    axios.get(`${API}/delivery-settings`).then(r => setDelivery(r.data)).catch(() => {});
  }, []);

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));

  const cartTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Bonus points preview for the current cart (debounced refetch on total change)
  const [bonusPreview, setBonusPreview] = useState({ total_points: 0, programs: [] });
  useEffect(() => {
    if (!cart.items.length) { setBonusPreview({ total_points: 0, programs: [] }); return; }
    const t = setTimeout(() => {
      axios.get(`${API}/bonus/cart-preview`).then(r => setBonusPreview(r.data)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [cartTotal, cart.items.length]);

  const handleClearCart = () => {
    if (window.confirm('Очистить корзину? Все товары будут удалены.')) {
      clearCart();
    }
  };

  // Free-delivery celebration: fire confetti when the threshold is first reached
  const freeDeliveryReached = delivery.delivery_enabled && delivery.min_free_delivery > 0 && cartTotal >= delivery.min_free_delivery;
  const [celebrate, setCelebrate] = useState(false);
  const prevReachedRef = useRef(false);
  useEffect(() => {
    if (freeDeliveryReached && !prevReachedRef.current) {
      prevReachedRef.current = true;
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2400);
      return () => clearTimeout(t);
    }
    if (!freeDeliveryReached) prevReachedRef.current = false;
  }, [freeDeliveryReached]);

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
          <button
            onClick={handleClearCart}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
            data-testid="clear-cart-btn"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Очистить корзину</span>
          </button>
        </motion.div>

        {/* Free-delivery progress bar */}
        {delivery.delivery_enabled && delivery.min_free_delivery > 0 && (() => {
          const remaining = Math.max(0, delivery.min_free_delivery - cartTotal);
          const reached = remaining <= 0;
          const pct = Math.min(100, (cartTotal / delivery.min_free_delivery) * 100);
          return (
            <motion.div
              className={`glass-card p-4 mb-6 relative ${reached ? 'ring-2 ring-emerald-300/70' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={reached
                ? { opacity: 1, y: 0, boxShadow: celebrate ? ['0 0 0 0 rgba(16,185,129,0)', '0 10px 40px -6px rgba(16,185,129,0.45)', '0 0 0 0 rgba(16,185,129,0)'] : '0 0 0 0 rgba(16,185,129,0)' }
                : { opacity: 1, y: 0 }}
              transition={celebrate ? { duration: 1.2, repeat: 1 } : { delay: 0.1 }}
              data-testid="free-delivery-bar"
            >
              {/* Confetti burst on reaching the threshold */}
              <AnimatePresence>
                {celebrate && (
                  <div className="absolute inset-x-0 -top-2 h-0 pointer-events-none z-20" aria-hidden>
                    {CONFETTI.map((c) => (
                      <motion.span
                        key={c.id}
                        className="absolute block rounded-[2px]"
                        style={{ left: `${c.left}%`, width: 8, height: 12, backgroundColor: c.color }}
                        initial={{ opacity: 0, y: 0, x: 0, rotate: 0, scale: 1 }}
                        animate={{ opacity: [0, 1, 1, 0], y: [-4, -c.rise, 30], x: c.x, rotate: c.rot, scale: [1, 1, 0.6] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.8, delay: c.delay, ease: 'easeOut' }}
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  {reached ? (
                    <>
                      <motion.span
                        animate={celebrate ? { rotate: [0, -15, 15, -10, 0], scale: [1, 1.25, 1] } : {}}
                        transition={{ duration: 0.8 }}
                        className="text-emerald-500 flex"
                      >
                        <PartyPopper className="w-4 h-4" />
                      </motion.span>
                      <span data-testid="free-delivery-reached">Бесплатная доставка активирована!</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4 text-rose-500" />
                      <span>
                        До бесплатной доставки осталось{' '}
                        <span className="font-bold text-rose-600" data-testid="free-delivery-remaining">{formatPrice(remaining)} ₽</span>
                      </span>
                    </>
                  )}
                </span>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {formatPrice(cartTotal)} / {formatPrice(delivery.min_free_delivery)} ₽
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${reached ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-rose-400 to-pink-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          );
        })()}

        {/* Ozon certificate progress (+500₽ per 10 000₽) */}
        <OzonCertificateBar total={cartTotal} />

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
                      {item.individual_price != null ? (
                        <>
                          <p className="font-bold text-xl text-emerald-600">{formatPrice(item.price * item.quantity)} <span className="text-sm text-slate-400">₽</span></p>
                          <p className="text-[10px] line-through text-slate-400">{formatPrice(item.original_price)} ₽ × {item.quantity}</p>
                          {item.promo_active ? (
                            <>
                              <p className="text-[10px] text-slate-400">{formatPrice(item.base_price_before_promo)} × {item.quantity}</p>
                              <p className="text-xs text-rose-500 font-semibold">−{formatPrice(item.promo_amount)} ₽ {item.promo_label && `(${item.promo_label})`}</p>
                              <p className="text-xs text-emerald-600">{formatPrice(item.price)} × {item.quantity}</p>
                            </>
                          ) : (
                            <p className="text-xs text-emerald-600">{formatPrice(item.individual_price)} × {item.quantity}</p>
                          )}
                        </>
                      ) : item.promo_active ? (
                        <>
                          <p className="font-bold text-xl text-rose-600">{formatPrice(item.price * item.quantity)} <span className="text-sm text-rose-400">₽</span></p>
                          <p className="text-[10px] line-through text-slate-400">{formatPrice(item.original_price)} ₽ × {item.quantity}</p>
                          <p className="text-xs text-rose-500 font-semibold">−{formatPrice(item.promo_amount)} ₽ {item.promo_label && `(${item.promo_label})`}</p>
                          <p className="text-xs text-rose-600">{formatPrice(item.price)} × {item.quantity}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-xl text-teal-600">{formatPrice(item.price * item.quantity)} <span className="text-sm text-slate-400">₽</span></p>
                          <p className="text-xs text-slate-400">{formatPrice(item.price)} × {item.quantity}</p>
                        </>
                      )}
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
                        data-testid={`decrease-qty-${item.product_id}`}
                      >
                        <Minus className="w-4 h-4" />
                      </motion.button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          updateQuantity(item.product_id, val);
                        }}
                        className="w-14 text-center font-bold text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        data-testid={`qty-input-${item.product_id}`}
                      />
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="p-2.5 hover:bg-slate-100 transition-colors text-slate-500"
                        data-testid={`increase-qty-${item.product_id}`}
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

                  {/* Upsell hint: add more to unlock the next quantity discount */}
                  {(() => {
                    const up = getCartUpsell(item);
                    if (!up) return null;
                    return (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 flex items-center justify-between gap-3 flex-wrap rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 px-3 py-2"
                        data-testid={`upsell-hint-${item.product_id}`}
                      >
                        <p className="text-xs text-slate-700 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-rose-500 flex-shrink-0" />
                          Добавьте ещё <span className="font-bold text-rose-600">{up.need} шт.</span> и получите скидку{' '}
                          <span className="font-bold text-rose-600">
                            {up.type === 'percent' ? `−${up.percent}%` : `−${formatPrice(up.value)} ₽`}
                          </span>
                          <span className="text-slate-500"> ({up.unitPrice.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ₽/шт)</span>
                        </p>
                        <button
                          onClick={() => updateQuantity(item.product_id, up.minQty)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline underline-offset-2 whitespace-nowrap"
                          data-testid={`upsell-apply-${item.product_id}`}
                        >
                          Добавить {up.need} шт.
                        </button>
                      </motion.div>
                    );
                  })()}
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
                {bonusPreview.total_points > 0 && (
                  <div className="flex justify-between text-sm" data-testid="cart-bonus-preview">
                    <span className="text-amber-600 flex items-center gap-1.5">
                      <Award className="w-4 h-4" /> Бонусы за заказ
                    </span>
                    <span className="font-semibold text-amber-600">+{formatPrice(bonusPreview.total_points)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200/50 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-800">К оплате:</span>
                    <span className="text-2xl font-bold text-teal-600">{formatPrice(cartTotal)} <span className="text-sm text-slate-400">₽</span></span>
                  </div>
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => { trackClick('checkout_from_cart', '/cart'); navigate('/checkout'); }}
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
