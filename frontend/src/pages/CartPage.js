import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Trash2, ArrowLeft, ShoppingCart, Minus, Plus, Package, TrendingUp, Truck, PartyPopper, Award, Banknote, CreditCard, Wallet, Sparkles, Clock, Loader2, FileText, ShoppingBag, MessageSquare, Tag } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useIndividualPrice } from '../context/IndividualPriceContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { trackClick } from '../utils/tracker';
import { getCartUpsell } from '../utils/productHelpers';
import { OzonCertificateBar } from '../components/OzonCertificateBar';
import CryptoPaymentModal from '../components/CryptoPaymentModal';
import { DeliveryBadge } from '../components/DeliveryBadge';
import { useRegion } from '../context/RegionContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CONFETTI = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: (Math.random() * 2 - 1) * 220,
  rise: 40 + Math.random() * 70,
  rot: (Math.random() * 2 - 1) * 360,
  delay: Math.random() * 0.18,
  color: ['#fb7185', '#34d399', '#fbbf24', '#2dd4bf', '#f472b6', '#a78bfa'][i % 6],
  left: 10 + Math.random() * 80,
}));

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Наличные', desc: 'Оплата при получении', icon: Banknote },
  { id: 'card', label: 'Банковская карта', desc: 'Перевод по реквизитам, чек + подтверждение', icon: CreditCard },
  { id: 'crypto', label: 'Криптовалюта', desc: 'USDT/USDC через MetaMask', icon: Wallet },
];
const METHOD_NAME = { balance: 'Баланс', card: 'Карта', cash: 'Наличные' };

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart, fetchCart, loading: cartLoading } = useCart();
  const { user, loading: authLoading } = useAuth();
  const { refresh: refreshIndividualPrices } = useIndividualPrice();
  const navigate = useNavigate();

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));

  // Settings
  const [delivery, setDelivery] = useState({ min_free_delivery: 5000, delivery_price: 500, delivery_enabled: true });
  const { computeDelivery, region: clientRegion } = useRegion();
  const [paymentSettings, setPaymentSettings] = useState({
    card_adjustment: 0, crypto_adjustment: 0, cash_adjustment: 0, balance_adjustment: 0,
    card_enabled: true, crypto_enabled: true, cash_enabled: true, balance_enabled: true,
    deferred_payment_enabled: false, deferred_payment_hours: 24,
  });
  const [prepaymentSettings, setPrepaymentSettings] = useState({ prepayment_enabled: true });
  const [termsSections, setTermsSections] = useState([]);
  const [userBalance, setUserBalance] = useState(0);
  const [creditInfo, setCreditInfo] = useState(null);
  const [bonusPreview, setBonusPreview] = useState({ total_points: 0, programs: [] });

  // Checkout state
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [payWithBalance, setPayWithBalance] = useState(false);
  const [payWithDeferral, setPayWithDeferral] = useState(false);
  const [payLater, setPayLater] = useState(false);
  const [mixedMode, setMixedMode] = useState(false);
  const [quote, setQuote] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mixedMethods, setMixedMethods] = useState([]); // up to 2 of: balance, card, cash
  const [mix1Amount, setMix1Amount] = useState('');
  const [form, setForm] = useState({ full_name: '', address: '', phone: '', comment: '' });
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [cryptoPaymentAmount, setCryptoPaymentAmount] = useState(0);
  const [orderId, setOrderId] = useState(null);
  const [cdReq, setCdReq] = useState(null);
  const [cdModalOpen, setCdModalOpen] = useState(false);
  const [cdPercent, setCdPercent] = useState('');
  const [cdBusy, setCdBusy] = useState(false);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promoInfo, setPromoInfo] = useState(null); // { discount, message, code }
  const [promoChecking, setPromoChecking] = useState(false);
  const [payDeliveryWithPoints, setPayDeliveryWithPoints] = useState(false);
  const [rewardChoice, setRewardChoice] = useState('points'); // 'points' | 'ozon'

  const cartTotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  useEffect(() => {
    axios.get(`${API}/delivery-settings`).then(r => setDelivery(r.data)).catch(() => {});
    axios.get(`${API}/payment-settings`).then(r => {
      setPaymentSettings(r.data);
      if (r.data.cash_enabled !== false) setPaymentMethod('cash');
      else if (r.data.card_enabled !== false) setPaymentMethod('card');
      else if (r.data.crypto_enabled !== false) setPaymentMethod('crypto');
    }).catch(() => {});
    axios.get(`${API}/prepayment-settings`).then(r => setPrepaymentSettings(r.data)).catch(() => {});
    axios.get(`${API}/terms`).then(r => setTermsSections(r.data.sections || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API}/user/balance`).then(r => setUserBalance(r.data.balance || 0)).catch(() => {});
    axios.get(`${API}/credit/my`).then(r => setCreditInfo(r.data)).catch(() => {});
    axios.get(`${API}/user/last-shipping`).then(r => setForm({ full_name: r.data.full_name || '', address: r.data.address || '', phone: r.data.phone || '', comment: '' })).catch(() => {});
    axios.get(`${API}/cart-discount-requests/my`).then(r => setCdReq((r.data || []).find(x => x.status === 'pending' || x.status === 'approved') || null)).catch(() => {});
    axios.get(`${API}/bonus/my-points`).then(r => setBonusPoints(r.data.total_points || 0)).catch(() => {});
  }, [user]);

  // ----- Totals -----
  const getAdj = (m) => paymentSettings[`${m}_adjustment`] ?? 0;
  const singleAdj = mixedMode ? 0 : (payWithDeferral ? 0 : (payWithBalance ? (paymentSettings.balance_adjustment ?? 0) : getAdj(paymentMethod)));

  const a1 = Math.max(0, Math.min(Number(mix1Amount) || 0, cartTotal));
  const a2 = Math.round((cartTotal - a1) * 100) / 100;
  const mixM1 = mixedMethods[0];
  const mixM2 = mixedMethods[1];
  const mixReady = mixedMode && mixedMethods.length === 2;
  const mixCharged1 = mixReady ? Math.round(a1 * (1 + getAdj(mixM1) / 100)) : 0;
  const mixCharged2 = mixReady ? Math.round(a2 * (1 + getAdj(mixM2) / 100)) : 0;

  // Server quote: goods total for the chosen payment method with every item clamped to its minimum price
  const quoteMethod = mixedMode ? 'none' : (payWithDeferral ? 'deferral' : (payWithBalance ? 'balance' : paymentMethod));
  const cartSig = cart.items.map(i => `${i.product_id}:${i.quantity}:${i.price}`).join('|');
  useEffect(() => {
    if (!user || !cartSig) { setQuote(null); return undefined; }
    let alive = true;
    axios.get(`${API}/cart/quote?payment_method=${quoteMethod}`).then(r => { if (alive) setQuote(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [user, quoteMethod, cartSig]);
  const quoteReady = !!quote && quote.payment_method === quoteMethod;
  const sumFloors = quote?.sum_floors || 0;

  const mixRaw = mixCharged1 + mixCharged2;
  const goodsTotal = mixReady
    ? Math.max(mixRaw, Math.round(sumFloors))
    : (mixedMode ? cartTotal : (quoteReady ? Math.round(quote.goods_total) : (singleAdj !== 0 ? Math.round(cartTotal * (1 + singleAdj / 100)) : cartTotal)));

  // Promo code (single-method only) — applied before individual discount, floor-guarded server-side
  const localPromoDiscount = (!mixedMode && promoInfo) ? Math.min(promoInfo.discount || 0, goodsTotal) : 0;
  const goodsAfterPromo = Math.max(0, goodsTotal - localPromoDiscount);

  // Individual account-wide discount — any payment method, never below the sum of minimum prices
  const individualDiscountPct = (!mixedMode || mixReady) ? (Number(user?.individual_discount) || 0) : 0;
  const localIndividualDiscountAmount = individualDiscountPct > 0
    ? Math.min(Math.round(goodsAfterPromo * individualDiscountPct / 100), Math.max(0, Math.floor(goodsAfterPromo - sumFloors)))
    : 0;
  const localGoodsAfterIndividual = Math.max(0, goodsAfterPromo - localIndividualDiscountAmount);

  // Server preview: the exact totals the order will be created with
  const previewBody = mixedMode
    ? (mixReady && a1 > 0 && a1 < cartTotal ? { payment_parts: [{ method: mixM1, amount: a1 }, { method: mixM2, amount: a2 }] } : null)
    : { payment_method: quoteMethod, pay_with_balance: payWithBalance, promo_code: promoInfo?.code || null };
  const previewSig = previewBody ? `${cartSig}#${JSON.stringify(previewBody)}` : '';
  useEffect(() => {
    if (!user || !cartSig || !previewSig) { setPreview(null); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      axios.post(`${API}/cart/preview`, JSON.parse(previewSig.slice(previewSig.indexOf('#') + 1)))
        .then(r => { if (alive) setPreview({ ...r.data, sig: previewSig }); })
        .catch(() => { if (alive) setPreview(null); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, previewSig]);
  const pv = preview && preview.sig === previewSig ? preview : null;
  const goodsAfterIndividual = pv ? pv.goods_total : localGoodsAfterIndividual;
  const mixK = mixRaw > 0 ? goodsAfterIndividual / mixRaw : 1;

  const toggleMixedMethod = (m) => {
    if (!['balance', 'card', 'cash'].includes(m)) { toast.error('В смешанной оплате доступны: баланс, карта, наличные'); return; }
    setMixedMethods((prev) => {
      if (prev.includes(m)) return prev.filter((x) => x !== m);
      if (prev.length >= 2) { toast.error('Можно выбрать только 2 способа'); return prev; }
      return [...prev, m];
    });
  };

  const promoDiscount = pv ? pv.promo_code_amount : localPromoDiscount;
  const individualDiscountAmount = pv ? pv.individual_discount_amount : localIndividualDiscountAmount;
  const isFreeDelivery = pv ? !(pv.delivery_fee > 0) : (!delivery.delivery_enabled || goodsAfterIndividual >= delivery.min_free_delivery);
  // Individual delivery cost from the client card overrides the site-wide price (same as the server)
  const deliveryFee = pv ? pv.delivery_fee : (isFreeDelivery ? 0 : (cart.delivery_cost ?? delivery.delivery_price));

  // Pay delivery with bonus points (1 балл = 1 ₽)
  const canPayDeliveryWithPoints = !mixedMode && deliveryFee > 0 && bonusPoints >= Math.round(deliveryFee);
  const deliveryPaidWithPoints = payDeliveryWithPoints && canPayDeliveryWithPoints;
  const moneyDelivery = deliveryPaidWithPoints ? 0 : deliveryFee;
  const finalTotal = goodsAfterIndividual + moneyDelivery;

  // Whole order arrives when its slowest item arrives
  const orderEta = (() => {
    const days = cart.items.reduce((m, i) => Math.max(m, computeDelivery(i.stock_regions).days_max || 0), 0);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  })();

  // Cart-wide discount is already baked into item.price by backend; derive display amounts.
  const cartDiscountPct = cart.cart_discount?.admin_percent || 0;
  const cartDiscountAmount = cart.items.reduce((s, i) => s + (((i.price_before_cart_discount ?? i.price) - i.price) * i.quantity), 0);
  const subtotalBeforeCartDiscount = cartTotal + cartDiscountAmount;

  const submitCartDiscount = async () => {
    const p = Number(cdPercent);
    if (!p || p <= 0 || p > 90) { toast.error('Введите процент от 1 до 90'); return; }
    setCdBusy(true);
    try {
      await axios.post(`${API}/cart-discount-requests`, { requested_percent: p });
      toast.success('Запрос отправлен администратору');
      setCdModalOpen(false); setCdPercent('');
      const r = await axios.get(`${API}/cart-discount-requests/my`);
      setCdReq((r.data || []).find(x => x.status === 'pending' || x.status === 'approved') || null);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setCdBusy(false); }
  };

  const cancelCartDiscount = async () => {
    if (!cdReq) return;
    setCdBusy(true);
    try {
      await axios.delete(`${API}/cart-discount-requests/${cdReq.id}`);
      toast.success('Запрос отменён');
      setCdReq(null);
      await fetchCart();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setCdBusy(false); }
  };

  const applyPromo = async () => {
    const code = promoCode.trim();
    if (!code) { toast.error('Введите промокод'); return; }
    setPromoChecking(true);
    try {
      const r = await axios.post(`${API}/promo-codes/validate`, { code, goods_total: goodsTotal });
      if (r.data?.valid) {
        setPromoInfo({ discount: r.data.discount, message: r.data.message, code: r.data.code });
        toast.success(r.data.message);
      } else {
        setPromoInfo(null);
        toast.error(r.data?.message || 'Промокод недействителен');
      }
    } catch (e) { setPromoInfo(null); toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setPromoChecking(false); }
  };

  const clearPromo = () => { setPromoInfo(null); setPromoCode(''); };

  // Bonus points preview — based on actual goods total after payment-method adjustment
  useEffect(() => {
    if (!cart.items.length) { setBonusPreview({ total_points: 0, programs: [] }); return undefined; }
    const t = setTimeout(() => {
      axios.get(`${API}/bonus/cart-preview`, { params: { amount: goodsAfterIndividual } })
        .then(r => setBonusPreview(r.data)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [goodsAfterIndividual, cart.items.length]);

  // Reset reward choice to points if the Ozon-certificate option is no longer available (< 500 pts)
  useEffect(() => {
    if ((bonusPreview?.total_points || 0) < 500 && rewardChoice === 'ozon') {
      setRewardChoice('points');
    }
  }, [bonusPreview, rewardChoice]);

  // Keep promo valid as cart/payment changes; drop it in mixed mode
  useEffect(() => {
    if (!promoInfo) return;
    if (mixedMode) { setPromoInfo(null); return; }
    const code = promoInfo.code;
    const t = setTimeout(() => {
      axios.post(`${API}/promo-codes/validate`, { code, goods_total: goodsTotal })
        .then(r => {
          if (r.data?.valid) setPromoInfo({ discount: r.data.discount, message: r.data.message, code: r.data.code });
          else { setPromoInfo(null); toast.error(r.data?.message || 'Промокод больше не действует'); }
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goodsTotal, mixedMode]);

  const isMethodEnabled = (m) => paymentSettings[`${m}_enabled`] !== false;
  const canPayWithBalance = prepaymentSettings.prepayment_enabled && userBalance >= finalTotal;
  const creditApproved = creditInfo && creditInfo.status === 'approved';
  const creditAvailable = creditInfo ? (creditInfo.available || 0) : 0;
  const canPayWithDeferral = creditApproved && creditAvailable >= finalTotal;
  const deferredEnabled = paymentSettings.deferred_payment_enabled;
  const showPayLater = deferredEnabled && !mixedMode && !payWithBalance && !payWithDeferral && (paymentMethod === 'card' || paymentMethod === 'crypto');

  // ----- Free-delivery celebration -----
  const freeDeliveryReached = delivery.delivery_enabled && delivery.min_free_delivery > 0 && goodsAfterIndividual >= delivery.min_free_delivery;
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

  const handleClearCart = () => {
    if (window.confirm('Очистить корзину? Все товары будут удалены.')) clearCart();
  };

  // Expected bonus points for the current cart (fetched BEFORE the cart is cleared)
  const fetchExpectedPoints = async () => {
    try {
      const r = await axios.get(`${API}/bonus/cart-preview`);
      return Math.round(r.data?.total_points || 0);
    } catch {
      return 0;
    }
  };
  const emitPointsEarned = (pts) => {
    if (pts > 0) window.dispatchEvent(new CustomEvent('bonus-points-earned', { detail: { amount: pts } }));
  };

  const handleCryptoSuccess = async (txHash) => {
    setShowCryptoModal(false);
    try {
      const expectedPts = await fetchExpectedPoints();
      const res = await axios.post(`${API}/orders`, { ...form, payment_method: 'crypto', crypto_tx_hash: txHash, pay_delivery_with_points: deliveryPaidWithPoints, reward_choice: rewardChoice, promo_code: promoInfo?.code || undefined });
      setOrderId(res.data.id);
      await fetchCart();
      setCdReq(null);
      clearPromo();
      refreshIndividualPrices();
      if (rewardChoice === 'points') emitPointsEarned(expectedPts);
      toast.success('Заказ оплачен криптовалютой!');
      navigate('/orders');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Оплата прошла, но ошибка создания заказа. Свяжитесь с поддержкой.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.address.trim() || !form.phone.trim()) { toast.error('Заполните все обязательные поля'); return; }
    trackClick('place_order', '/cart');
    setLoading(true);
    try {
      const expectedPts = await fetchExpectedPoints();
      // MIXED payment: base amounts, backend applies per-part adjustment
      if (mixedMode) {
        if (mixedMethods.length !== 2) { toast.error('Выберите два способа оплаты'); setLoading(false); return; }
        if (!a1 || a1 <= 0 || a1 >= cartTotal) { toast.error(`Сумма первого способа: от 1 до ${formatPrice(cartTotal - 1)} ₽`); setLoading(false); return; }
        const res = await axios.post(`${API}/orders`, {
          ...form,
          payment_parts: [{ method: mixM1, amount: a1 }, { method: mixM2, amount: a2 }],
          reward_choice: rewardChoice,
        });
        setOrderId(res.data.id);
        await fetchCart();
        setCdReq(null);
        refreshIndividualPrices();
        if (rewardChoice === 'points') emitPointsEarned(expectedPts);
        if (mixM1 === 'card' || mixM2 === 'card') {
          toast.success('Заказ создан! Завершите оплату картой в «Мои заказы»');
        } else {
          toast.success('Заказ оформлен!');
        }
        navigate('/orders');
        return;
      }

      // Crypto with immediate payment (no pay-later): open modal first
      if (paymentMethod === 'crypto' && !payWithBalance && !payWithDeferral && !payLater) {
        setCryptoPaymentAmount(finalTotal);
        setShowCryptoModal(true);
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API}/orders`, {
        ...form,
        payment_method: payWithDeferral ? 'deferral' : (payWithBalance ? 'balance' : paymentMethod),
        pay_with_balance: payWithBalance,
        pay_later: showPayLater ? payLater : false,
        pay_delivery_with_points: deliveryPaidWithPoints,
        reward_choice: rewardChoice,
        promo_code: promoInfo?.code || undefined,
      });
      setOrderId(res.data.id);
      await fetchCart();
      setCdReq(null);
      clearPromo();
      refreshIndividualPrices();
      if (rewardChoice === 'points') emitPointsEarned(expectedPts);

      if (payWithDeferral) toast.success('Заказ оформлен в отсрочку!');
      else if (payWithBalance) toast.success('Заказ оплачен с баланса!');
      else if (paymentMethod === 'card') toast.success('Заказ создан! Реквизиты для оплаты в «Мои заказы»');
      else if (paymentMethod === 'crypto' && payLater) toast.success('Заказ создан! Оплатите криптовалютой в «Мои заказы»');
      else toast.success('Заказ оформлен!');
      navigate('/orders');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка оформления заказа');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || cartLoading) return null;

  if (!user) {
    return (
      <div className="min-h-screen relative" data-testid="cart-login-required">
        <div className="relative flex items-center justify-center min-h-screen">
          <motion.div className="text-center glass-card p-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <ShoppingCart className="w-20 h-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-6">Для просмотра корзины необходимо войти</p>
            <Link to="/login"><Button className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl">Войти</Button></Link>
          </motion.div>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen relative" data-testid="cart-empty">
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/catalog" className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Продолжить покупки
          </Link>
          <motion.div className="glass-card text-center py-16" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <ShoppingCart className="w-20 h-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-4">Корзина пуста</p>
            <Link to="/catalog"><Button className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl">Перейти в каталог</Button></Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen relative" data-testid="cart-page">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl" animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 8, repeat: Infinity }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/catalog" className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Продолжить покупки
        </Link>

        <motion.div className="flex items-center gap-4 mb-8" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">Корзина и оформление</h1>
            <p className="text-sm text-slate-500">{cart.items.length} товаров</p>
          </div>
          <button onClick={handleClearCart} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors" data-testid="clear-cart-btn">
            <Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Очистить</span>
          </button>
        </motion.div>

        {/* Free-delivery progress bar (based on adjusted goods total) */}
        {delivery.delivery_enabled && delivery.min_free_delivery > 0 && (() => {
          const remaining = Math.max(0, delivery.min_free_delivery - goodsAfterIndividual);
          const reached = remaining <= 0;
          const pct = Math.min(100, (goodsAfterIndividual / delivery.min_free_delivery) * 100);
          return (
            <motion.div className={`glass-card p-4 mb-6 relative ${reached ? 'ring-2 ring-emerald-300/70' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="free-delivery-bar">
              <AnimatePresence>
                {celebrate && (
                  <div className="absolute inset-x-0 -top-2 h-0 pointer-events-none z-20" aria-hidden>
                    {CONFETTI.map((c) => (
                      <motion.span key={c.id} className="absolute block rounded-[2px]" style={{ left: `${c.left}%`, width: 8, height: 12, backgroundColor: c.color }}
                        initial={{ opacity: 0, y: 0, x: 0, rotate: 0, scale: 1 }}
                        animate={{ opacity: [0, 1, 1, 0], y: [-4, -c.rise, 30], x: c.x, rotate: c.rot, scale: [1, 1, 0.6] }}
                        transition={{ duration: 1.8, delay: c.delay, ease: 'easeOut' }} />
                    ))}
                  </div>
                )}
              </AnimatePresence>
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  {reached ? (
                    <><PartyPopper className="w-4 h-4 text-emerald-500" /><span data-testid="free-delivery-reached">Бесплатная доставка активирована!</span></>
                  ) : (
                    <><Truck className="w-4 h-4 text-rose-500" /><span>До бесплатной доставки осталось <span className="font-bold text-rose-600" data-testid="free-delivery-remaining">{formatPrice(remaining)} ₽</span></span></>
                  )}
                </span>
                <span className="text-xs text-slate-400 whitespace-nowrap">{formatPrice(goodsAfterIndividual)} / {formatPrice(delivery.min_free_delivery)} ₽</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div className={`h-full rounded-full ${reached ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-rose-400 to-pink-500'}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
              </div>
            </motion.div>
          );
        })()}

        {/* Ozon certificate progress (based on adjusted goods total) */}
        <OzonCertificateBar total={goodsAfterIndividual} />

        {/* Reward choice: bonus points vs extra Ozon certificate */}
        {(bonusPreview?.total_points > 0) && (() => {
          const pts = bonusPreview.total_points || 0;
          const roundedPts = Math.floor(pts / 500) * 500;
          const certBonus = Math.floor(roundedPts / 2);
          const showOzon = pts >= 500;
          return (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4" data-testid="reward-choice">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Как начислить вознаграждение за заказ</p>
              <div className={`grid grid-cols-1 ${showOzon ? 'sm:grid-cols-2' : ''} gap-3`}>
                <button
                  type="button"
                  onClick={() => setRewardChoice('points')}
                  className={`text-left rounded-xl border-2 p-3 transition-all ${rewardChoice === 'points' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                  data-testid="reward-choice-points"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">Бонусные баллы</span>
                    {rewardChoice === 'points' && <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">✓</span>}
                  </div>
                  <p className="text-lg font-black text-emerald-600 mt-1 tabular-nums">+{formatPrice(pts)} <span className="text-xs font-medium text-slate-400">баллов</span></p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Начислим на бонусный счёт</p>
                </button>
                {showOzon && (
                  <button
                    type="button"
                    onClick={() => setRewardChoice('ozon')}
                    className={`text-left rounded-xl border-2 p-3 transition-all ${rewardChoice === 'ozon' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
                    data-testid="reward-choice-ozon"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">К Ozon-сертификату</span>
                      {rewardChoice === 'ozon' && <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center">✓</span>}
                    </div>
                    <p className="text-lg font-black text-indigo-600 mt-1 tabular-nums">+{formatPrice(certBonus)} <span className="text-xs font-medium text-slate-400">₽ к сертификату</span></p>
                    <p className="text-[11px] text-slate-400 mt-0.5">2 балла = 1 ₽, округление вниз до 500 баллов</p>
                  </button>
                )}
              </div>
              {!showOzon && (
                <p className="text-[11px] text-slate-400 mt-2">Вариант «К Ozon-сертификату» доступен от 500 баллов за заказ.</p>
              )}
            </div>
          );
        })()}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-2">
          {/* LEFT: Cart items + shipping + payment */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cart items */}
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {cart.items.map((item, index) => (
                  <motion.div key={item.product_id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 0.3, delay: index * 0.04 }} className="glass-card p-4 group" data-testid={`cart-item-${item.product_id}`}>
                    <div className="flex items-center gap-4">
                      <Link to={`/product/${item.product_id}`} className="flex-shrink-0">
                        <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden">
                          {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="w-8 h-8" /></div>}
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/product/${item.product_id}`} className="hover:text-teal-600 transition-colors">
                          <h3 className="font-semibold text-slate-800 line-clamp-2 mb-1">{item.name}</h3>
                        </Link>
                        <p className="text-xs font-mono text-slate-500">{item.article}</p>
                        <div className="mt-1.5"><DeliveryBadge stockRegions={item.stock_regions} productId={`cart-${item.product_id}`} /></div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-lg ${item.individual_price != null ? 'text-emerald-600' : item.promo_active ? 'text-rose-600' : item.cart_discount_percent > 0 ? 'text-teal-600' : 'text-teal-600'}`}>{formatPrice(item.price * item.quantity)} <span className="text-sm text-slate-400">₽</span></p>
                        {item.cart_discount_percent > 0 && item.price_before_cart_discount ? (
                          <p className="text-xs text-teal-600 font-semibold" data-testid={`item-cart-discount-${item.product_id}`}>
                            <span className="line-through text-slate-400 font-normal">{formatPrice(item.price_before_cart_discount)}</span> → {formatPrice(item.price)} × {item.quantity}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">{formatPrice(item.price)} × {item.quantity}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/50">
                      <div className="flex items-center bg-white/50 rounded-xl overflow-hidden border border-slate-200">
                        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="p-2 hover:bg-slate-100 text-slate-500" data-testid={`decrease-qty-${item.product_id}`}><Minus className="w-4 h-4" /></motion.button>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)} className="w-12 text-center font-bold text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" data-testid={`qty-input-${item.product_id}`} />
                        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="p-2 hover:bg-slate-100 text-slate-500" data-testid={`increase-qty-${item.product_id}`}><Plus className="w-4 h-4" /></motion.button>
                      </div>
                      <motion.button type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeFromCart(item.product_id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" data-testid={`remove-item-${item.product_id}`}><Trash2 className="w-5 h-5" /></motion.button>
                    </div>
                    {(() => {
                      const up = getCartUpsell(item);
                      if (!up) return null;
                      return (
                        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 px-3 py-2" data-testid={`upsell-hint-${item.product_id}`}>
                          <p className="text-xs text-slate-700 flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-rose-500 flex-shrink-0" />
                            Добавьте ещё <span className="font-bold text-rose-600">{up.need} шт.</span> → скидка <span className="font-bold text-rose-600">{up.type === 'percent' ? `−${up.percent}%` : `−${formatPrice(up.value)} ₽`}</span>
                          </p>
                          <button type="button" onClick={() => updateQuantity(item.product_id, up.minQty)} className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline underline-offset-2 whitespace-nowrap" data-testid={`upsell-apply-${item.product_id}`}>Добавить {up.need} шт.</button>
                        </div>
                      );
                    })()}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Shipping info */}
            <div className="glass-card p-6 space-y-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-teal-600 flex items-center gap-2"><ShoppingBag className="w-4 h-4" />Данные доставки</h2>
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">ФИО получателя *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Иванов Иван Иванович" className="h-12 rounded-xl" required data-testid="checkout-fullname" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Адрес доставки *</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Город, улица, дом, квартира" className="h-12 rounded-xl" required data-testid="checkout-address" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Телефон *</Label>
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7 (___) ___-__-__" className="h-12 rounded-xl" required data-testid="checkout-phone" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4" />Комментарий</Label>
                <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Пожелания к доставке..." className="min-h-[70px] rounded-xl" data-testid="checkout-comment" />
              </div>
            </div>

            {/* Payment method */}
            <div className="glass-card p-6">
              <Label className="text-sm font-bold uppercase tracking-widest text-teal-600 mb-4 block flex items-center gap-2"><CreditCard className="w-4 h-4" />Способ оплаты</Label>
              {mixedMode && (
                <p className="text-xs text-amber-600 mb-3 bg-amber-50 rounded-lg px-3 py-2" data-testid="mixed-hint">Смешанная оплата включена. Выберите <b>2 способа</b> (баланс, карта или наличные). Суммы укажите в блоке «Итого». Выбрано: {mixedMethods.length}/2</p>
              )}
              <div className="space-y-3">
                {prepaymentSettings.prepayment_enabled && userBalance > 0 && (
                  <button type="button" onClick={() => {
                      if (mixedMode) { toggleMixedMethod('balance'); return; }
                      if (canPayWithBalance) { setPayWithBalance(true); setPayWithDeferral(false); setPayLater(false); } else toast.error(`Недостаточно средств. Баланс: ${formatPrice(userBalance)}₽`);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${(mixedMode ? mixedMethods.includes('balance') : payWithBalance) ? 'bg-violet-50 border-violet-400' : 'bg-white border-slate-200 hover:border-slate-300'}`} data-testid="payment-method-balance">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${(mixedMode ? mixedMethods.includes('balance') : payWithBalance) ? 'bg-violet-100' : 'bg-slate-100'}`}><Sparkles className={`w-5 h-5 ${(mixedMode ? mixedMethods.includes('balance') : payWithBalance) ? 'text-violet-500' : 'text-slate-400'}`} /></div>
                    <div className="flex-1">
                      <p className={`font-semibold ${(mixedMode ? mixedMethods.includes('balance') : payWithBalance) ? 'text-violet-700' : 'text-slate-700'}`}>Оплата с баланса</p>
                      <p className="text-xs text-slate-500">Баланс: <span className="text-emerald-600 font-semibold">{formatPrice(userBalance)}₽</span></p>
                    </div>
                    {mixedMode && mixedMethods.includes('balance') && <span className="text-xs font-bold text-violet-600">№{mixedMethods.indexOf('balance') + 1}</span>}
                  </button>
                )}
                {PAYMENT_METHODS.map(method => {
                  const adjustment = getAdj(method.id);
                  const enabled = isMethodEnabled(method.id);
                  const mixable = ['balance', 'card', 'cash'].includes(method.id);
                  const selected = mixedMode ? mixedMethods.includes(method.id) : (!payWithBalance && !payWithDeferral && paymentMethod === method.id);
                  const Icon = method.icon;
                  const disabled = !enabled || (mixedMode && !mixable);
                  return (
                    <button key={method.id} type="button" disabled={disabled} onClick={() => {
                        if (mixedMode) { toggleMixedMethod(method.id); return; }
                        if (enabled) { setPayWithBalance(false); setPayWithDeferral(false); setPaymentMethod(method.id); setPayLater(false); }
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${disabled ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-70' : selected ? 'bg-teal-50 border-teal-400' : 'bg-white border-slate-200 hover:border-slate-300'}`} data-testid={`payment-method-${method.id}`}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${disabled ? 'bg-slate-200' : selected ? 'bg-teal-100' : 'bg-slate-100'}`}><Icon className={`w-5 h-5 ${disabled ? 'text-slate-400' : selected ? 'text-teal-600' : 'text-slate-500'}`} /></div>
                      <div className="flex-1">
                        <p className={`font-semibold ${disabled ? 'text-slate-400' : selected ? 'text-teal-700' : 'text-slate-700'}`}>{method.label}</p>
                        <p className={`text-xs ${!enabled ? 'text-rose-400 font-medium' : 'text-slate-500'}`}>{!enabled ? 'Временно недоступно' : (mixedMode && !mixable) ? 'Недоступно в смешанной оплате' : method.desc}</p>
                      </div>
                      {mixedMode && selected ? (
                        <span className="text-xs font-bold text-teal-600">№{mixedMethods.indexOf(method.id) + 1}</span>
                      ) : (!mixedMode && enabled && adjustment !== 0 && (
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${adjustment < 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{adjustment < 0 ? `-${Math.abs(adjustment)}%` : `+${adjustment}%`}</span>
                      ))}
                    </button>
                  );
                })}
                {creditApproved && !mixedMode && (
                  <button type="button" onClick={() => { if (canPayWithDeferral) { setPayWithDeferral(true); setPayWithBalance(false); setPayLater(false); } else toast.error(`Недостаточно лимита. Доступно: ${formatPrice(creditAvailable)}₽`); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${payWithDeferral ? 'bg-indigo-50 border-indigo-400' : canPayWithDeferral ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-100 border-slate-200 opacity-60'}`} data-testid="payment-method-deferral">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${payWithDeferral ? 'bg-indigo-100' : 'bg-slate-100'}`}><Clock className={`w-5 h-5 ${payWithDeferral ? 'text-indigo-500' : 'text-slate-400'}`} /></div>
                    <div className="flex-1">
                      <p className={`font-semibold ${payWithDeferral ? 'text-indigo-700' : 'text-slate-700'}`}>Отсрочка платежа</p>
                      <p className="text-xs text-slate-500">Доступно: <span className={canPayWithDeferral ? 'text-emerald-600 font-semibold' : 'text-rose-500'}>{formatPrice(creditAvailable)}₽</span> · до {creditInfo?.term_days || 30} дн.</p>
                    </div>
                  </button>
                )}
              </div>

              {/* Pay-later toggle for card/crypto */}
              {showPayLater && (
                <div onClick={() => setPayLater(v => !v)} className={`mt-3 w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${payLater ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'}`} data-testid="pay-later-toggle">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Clock className="w-4 h-4 text-indigo-500" />Оплатить позже (в течение {paymentSettings.deferred_payment_hours} ч)</span>
                  <span className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-300 ${payLater ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${payLater ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </span>
                </div>
              )}

              {/* Mixed payment toggle */}
              <div className="mt-4 border-t border-slate-100 pt-4" data-testid="mixed-payment-section">
                <div onClick={() => { const v = !mixedMode; setMixedMode(v); setMixedMethods([]); setMix1Amount(''); if (v) { setPayWithBalance(false); setPayWithDeferral(false); setPayLater(false); } }}
                  className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${mixedMode ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'}`} data-testid="mixed-payment-toggle">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Wallet className="w-4 h-4 text-amber-500" />Смешанная оплата (2 способа)</span>
                  <span className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-300 ${mixedMode ? 'bg-amber-500' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${mixedMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Order summary + submit */}
          <div className="lg:col-span-1">
            <div className="glass-card p-6 sticky top-24">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Итого</h2>
              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Товары ({cart.items.length})</span>
                  <span className="text-slate-800">{formatPrice(cartTotal)} ₽</span>
                </div>
                <div className="flex justify-between text-sm" data-testid="cart-delivery-eta">
                  <span className="text-slate-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5" />Весь заказ приедет</span>
                  <span className="text-slate-800 font-medium">до {orderEta}</span>
                </div>
                {!clientRegion && (
                  <p className="text-[11px] text-amber-600" data-testid="cart-region-hint">Выберите регион в шапке сайта, чтобы срок доставки был точным.</p>
                )}
                {mixedMode && (
                  <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200/80 p-4 space-y-3" data-testid="mixed-amounts-block">
                    {mixedMethods.length < 2 ? (
                      <div className="flex items-center gap-2 text-amber-700">
                        <Wallet className="w-4 h-4 flex-shrink-0" />
                        <p className="text-xs font-medium">Выберите 2 способа оплаты слева <span className="font-bold">({mixedMethods.length}/2)</span></p>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-slate-500 leading-relaxed">Распределите сумму товаров <b className="text-slate-700">{formatPrice(cartTotal)} ₽</b> между способами.</p>
                        {/* Editable part */}
                        <div className="rounded-xl bg-white border border-amber-100 p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                              {METHOD_NAME[mixM1]}
                              {getAdj(mixM1) !== 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${getAdj(mixM1) < 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{getAdj(mixM1) > 0 ? '+' : ''}{getAdj(mixM1)}%</span>}
                            </span>
                            <div className="relative w-28">
                              <Input type="number" min="1" inputMode="numeric" value={mix1Amount} onChange={(e) => setMix1Amount(e.target.value)} placeholder="0"
                                className="h-9 pr-7 rounded-lg text-right font-semibold border-slate-200 focus-visible:ring-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" data-testid="mix-amount-1" />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">₽</span>
                            </div>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>к оплате этим способом</span>
                            <span className="font-bold text-slate-600">{formatPrice(mixCharged1 * mixK)} ₽</span>
                          </div>
                        </div>
                        {/* Remainder part */}
                        <div className="rounded-xl bg-white/70 border border-amber-100 p-3">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                              {METHOD_NAME[mixM2]}
                              {getAdj(mixM2) !== 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${getAdj(mixM2) < 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{getAdj(mixM2) > 0 ? '+' : ''}{getAdj(mixM2)}%</span>}
                              <span className="text-[10px] text-slate-400 font-normal">остаток</span>
                            </span>
                            <div className="w-28 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-end pr-2.5 text-sm font-semibold text-slate-500" data-testid="mix-amount-2">{formatPrice(a2)}<span className="text-xs text-slate-400 ml-0.5">₽</span></div>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>к оплате этим способом</span>
                            <span className="font-bold text-slate-600">{formatPrice(mixCharged2 * mixK)} ₽</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {!mixedMode && singleAdj !== 0 && (
                  <div className={`flex justify-between text-sm font-medium ${singleAdj < 0 ? 'text-emerald-600' : 'text-rose-600'}`} data-testid="checkout-cart-discount-line">
                    <span>{singleAdj < 0 ? 'Скидка' : 'Наценка'} за оплату ({Math.abs(singleAdj)}%):</span>
                    <span>{singleAdj < 0 ? '-' : '+'}{formatPrice(Math.abs(goodsTotal - cartTotal))} ₽</span>
                  </div>
                )}
                {mixedMode && (goodsTotal - cartTotal) !== 0 && (
                  <div className={`flex justify-between text-sm font-medium ${goodsTotal - cartTotal < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <span>Наценка/скидка за оплату:</span>
                    <span>{goodsTotal - cartTotal < 0 ? '-' : '+'}{formatPrice(Math.abs(goodsTotal - cartTotal))} ₽</span>
                  </div>
                )}
                {cartDiscountPct > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Сумма без скидки на корзину:</span>
                      <span>{formatPrice(subtotalBeforeCartDiscount)} ₽</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium text-teal-600" data-testid="checkout-cart-wide-discount-line">
                      <span>Скидка на корзину ({cartDiscountPct}%):</span>
                      <span>−{formatPrice(cartDiscountAmount)} ₽</span>
                    </div>
                  </>
                )}
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-sm font-medium text-teal-600" data-testid="checkout-promo-discount-line">
                    <span>Промокод {promoInfo?.code}:</span>
                    <span>−{formatPrice(promoDiscount)} ₽</span>
                  </div>
                )}
                {individualDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm font-medium text-emerald-600" data-testid="checkout-individual-discount-line">
                    <span>Индивидуальная скидка ({individualDiscountPct}%):</span>
                    <span>−{formatPrice(individualDiscountAmount)} ₽</span>
                  </div>
                )}
                {delivery.delivery_enabled && (
                  <div className="flex justify-between text-sm" data-testid="delivery-fee-row">
                    <span className="text-slate-600">Доставка:</span>
                    {isFreeDelivery ? (
                      <span className="text-emerald-600 font-medium">Бесплатно</span>
                    ) : deliveryPaidWithPoints ? (
                      <span className="text-violet-600 font-medium" data-testid="delivery-paid-points">−{formatPrice(deliveryFee)} ₽ (баллами)</span>
                    ) : (
                      <span className="text-slate-700 font-medium">{formatPrice(deliveryFee)} ₽</span>
                    )}
                  </div>
                )}
                {canPayDeliveryWithPoints && (
                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-violet-50 border border-violet-200 cursor-pointer" data-testid="pay-delivery-points-toggle">
                    <span className="text-xs font-medium text-violet-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Оплатить доставку баллами ({formatPrice(Math.round(deliveryFee))} б.)
                    </span>
                    <input type="checkbox" checked={payDeliveryWithPoints} onChange={(e) => setPayDeliveryWithPoints(e.target.checked)} className="w-4 h-4 accent-violet-500 rounded" data-testid="pay-delivery-points-checkbox" />
                  </label>
                )}
                {canPayDeliveryWithPoints && (
                  <p className="text-[11px] text-slate-400" data-testid="bonus-points-balance">Доступно баллов: {formatPrice(bonusPoints)}</p>
                )}
                {bonusPreview.total_points > 0 && (
                  <div className="flex justify-between text-sm" data-testid="cart-bonus-preview">
                    <span className="text-amber-600 flex items-center gap-1.5"><Award className="w-4 h-4" />Бонусы за заказ</span>
                    <span className="font-semibold text-amber-600">+{formatPrice(bonusPreview.total_points)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200/50 pt-3 flex justify-between items-center">
                  <span className="font-semibold text-slate-800">К оплате:</span>
                  <span className="text-2xl font-bold text-teal-600" data-testid="checkout-total">{formatPrice(finalTotal)} <span className="text-sm text-slate-400">₽</span></span>
                </div>

                {/* Promo code */}
                {!mixedMode && (
                  <div className="pt-1" data-testid="promo-code-block">
                    {promoInfo ? (
                      <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-teal-50 border border-teal-200" data-testid="promo-code-applied">
                        <span className="text-sm font-semibold text-teal-700 flex items-center gap-1.5">
                          <Tag className="w-4 h-4" />Промокод {promoInfo.code} применён
                        </span>
                        <button type="button" onClick={clearPromo} className="text-xs font-medium text-rose-600 hover:underline" data-testid="promo-code-remove-btn">Убрать</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="Промокод" className="flex-1 h-10" data-testid="promo-code-field" maxLength={32} />
                        <Button type="button" onClick={applyPromo} disabled={promoChecking} variant="outline" className="h-10 border-teal-300 text-teal-700 hover:bg-teal-50" data-testid="promo-code-apply-btn">
                          {promoChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Применить'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Cart-wide discount request */}
                <div className="pt-1" data-testid="cart-discount-request-block">
                  {cdReq?.status === 'approved' ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-teal-50 border border-teal-200" data-testid="cart-discount-approved-badge">
                      <Tag className="w-4 h-4 text-teal-600" />
                      <span className="text-sm font-semibold text-teal-700">Скидка на корзину {cdReq.admin_percent}% применена</span>
                    </div>
                  ) : cdReq?.status === 'pending' ? (
                    <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200" data-testid="cart-discount-pending-badge">
                      <span className="text-sm text-amber-700">Запрос скидки {cdReq.requested_percent}% на рассмотрении</span>
                      <button type="button" onClick={cancelCartDiscount} disabled={cdBusy} className="text-xs font-medium text-rose-600 hover:underline" data-testid="cancel-cart-discount-btn">Отменить</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setCdModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-teal-300 text-teal-700 font-medium hover:bg-teal-50 transition-colors" data-testid="request-cart-discount-btn">
                      <Tag className="w-4 h-4" />Запросить скидку на корзину
                    </button>
                  )}
                </div>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3 mb-4">
                <button type="button" onClick={() => setAgreedToTerms(!agreedToTerms)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${agreedToTerms ? 'bg-teal-500 border-teal-500' : 'border-slate-300'}`} data-testid="terms-checkbox">
                  {agreedToTerms && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <label className="text-xs text-slate-600 cursor-pointer" onClick={() => setAgreedToTerms(!agreedToTerms)}>
                  Я согласен с <button type="button" onClick={(e) => { e.stopPropagation(); setShowTermsModal(true); }} className="text-teal-600 hover:text-teal-500 underline font-medium" data-testid="terms-link">правилами предоставления услуг</button>
                </label>
              </div>

              <Button type="submit" disabled={loading || !agreedToTerms || (mixedMode && mixedMethods.length !== 2)} className={`w-full font-bold uppercase tracking-wide h-14 rounded-2xl text-base transition-all duration-200 active:scale-[0.98] ${(agreedToTerms && !(mixedMode && mixedMethods.length !== 2)) ? 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`} data-testid="place-order-btn">
                {loading && <Loader2 className="w-5 h-5 animate-spin mr-2 inline" />}
                {loading ? 'Оформление...' : mixedMode ? 'Оформить заказ' : payWithDeferral ? 'Оформить в отсрочку' : payWithBalance ? 'Оплатить с баланса' : (paymentMethod === 'crypto' && !payLater) ? 'Перейти к оплате' : 'Оформить заказ'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Terms Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white rounded-2xl" data-testid="terms-modal">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
            <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center"><FileText className="w-5 h-5 text-teal-600" /></div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800">Правила предоставления услуг</DialogTitle>
              <DialogDescription className="sr-only">Правила предоставления услуг магазина</DialogDescription>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-4 space-y-6 text-sm text-slate-600">
            {termsSections.length > 0 ? termsSections.map((section) => (
              <section key={section.id}>
                <h3 className="font-bold text-slate-800 mb-2">{section.title}</h3>
                {section.content.split('\n\n').map((p, idx) => <p key={idx} className="mb-2 whitespace-pre-line">{p}</p>)}
              </section>
            )) : <div className="text-center text-slate-500 py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Загрузка...</div>}
          </div>
          <div className="pt-4 border-t border-slate-200">
            <button onClick={() => { setAgreedToTerms(true); setShowTermsModal(false); }} className="w-full h-12 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold rounded-xl" data-testid="accept-terms-btn">Принять и согласиться</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cart discount request modal */}
      <Dialog open={cdModalOpen} onOpenChange={setCdModalOpen}>
        <DialogContent className="max-w-sm bg-white rounded-2xl" data-testid="cart-discount-modal">
          <DialogTitle className="text-lg font-bold text-slate-800">Запрос скидки на корзину</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Укажите желаемый процент скидки на всю корзину. Администратор рассмотрит запрос и подтвердит свой вариант — скидка сразу применится к вашей корзине.
          </DialogDescription>
          <div className="mt-2">
            <Label className="text-xs font-semibold text-slate-500">Желаемая скидка, %</Label>
            <Input type="number" min="1" max="90" value={cdPercent} onChange={(e) => setCdPercent(e.target.value)} placeholder="например, 10" className="mt-1" data-testid="cart-discount-percent-input" />
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={submitCartDiscount} disabled={cdBusy} className="flex-1 bg-teal-500 hover:bg-teal-600 text-white" data-testid="cart-discount-submit-btn">
              {cdBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Отправить запрос
            </Button>
            <Button onClick={() => setCdModalOpen(false)} variant="outline">Отмена</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

    <CryptoPaymentModal open={showCryptoModal} onClose={() => setShowCryptoModal(false)} orderId={orderId} amountRub={cryptoPaymentAmount} onSuccess={handleCryptoSuccess} />
    </>
  );
}
