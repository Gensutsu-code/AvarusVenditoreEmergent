import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, Banknote, MessageSquare, CreditCard, Wallet, Loader2, FileText, Sparkles, ShoppingBag } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import CryptoPaymentModal from '../components/CryptoPaymentModal';
import { trackClick } from '../utils/tracker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SITE_URL = process.env.REACT_APP_BACKEND_URL;

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Наличные', desc: 'Оплата при получении', icon: Banknote, color: 'green' },
  { id: 'card', label: 'Банковская карта', desc: 'Онлайн оплата картой (ЮKassa)', icon: CreditCard, color: 'blue' },
  { id: 'crypto', label: 'Криптовалюта', desc: 'USDT/USDC через MetaMask', icon: Wallet, color: 'amber' },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, cartTotal, fetchCart, loading: cartLoading } = useCart();
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentSettings, setPaymentSettings] = useState({ 
    card_adjustment: 0, crypto_adjustment: -20, cash_adjustment: -15, balance_adjustment: 0,
    card_enabled: true, crypto_enabled: true, cash_enabled: true, balance_enabled: true
  });
  const [cryptoWallets, setCryptoWallets] = useState({});
  const [selectedChain, setSelectedChain] = useState('bsc');
  const [txHash, setTxHash] = useState('');
  const [cryptoStep, setCryptoStep] = useState(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [cryptoPaymentAmount, setCryptoPaymentAmount] = useState(0);
  const [form, setForm] = useState({ full_name: '', address: '', phone: '', comment: '' });
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsSections, setTermsSections] = useState([]);
  
  const [userBalance, setUserBalance] = useState(0);
  const [payWithBalance, setPayWithBalance] = useState(false);
  const [prepaymentSettings, setPrepaymentSettings] = useState({ prepayment_enabled: true });
  const [deliverySettings, setDeliverySettings] = useState({ min_free_delivery: 5000, delivery_price: 500, delivery_enabled: true });

  const isPaymentMethodEnabled = (method) => paymentSettings[`${method}_enabled`] !== false;

  useEffect(() => {
    if (user) {
      fetchLastShipping();
      fetchUserBalance();
    }
    axios.get(`${API}/payment-settings`).then(res => {
      setPaymentSettings(res.data);
      if (res.data.cash_enabled !== false) {
        setPaymentMethod('cash');
      } else if (res.data.card_enabled !== false) {
        setPaymentMethod('card');
      } else if (res.data.crypto_enabled !== false) {
        setPaymentMethod('crypto');
      }
    }).catch(() => {});
    axios.get(`${API}/crypto-wallets`).then(res => setCryptoWallets(res.data)).catch(() => {});
    axios.get(`${API}/terms`).then(res => setTermsSections(res.data.sections || [])).catch(() => {});
    axios.get(`${API}/prepayment-settings`).then(res => setPrepaymentSettings(res.data)).catch(() => {});
    axios.get(`${API}/delivery-settings`).then(res => setDeliverySettings(res.data)).catch(() => {});
  }, [user]);

  const fetchUserBalance = async () => {
    try {
      const res = await axios.get(`${API}/user/balance`);
      setUserBalance(res.data.balance || 0);
    } catch {}
  };

  const fetchLastShipping = async () => {
    try {
      const res = await axios.get(`${API}/user/last-shipping`);
      setForm({ full_name: res.data.full_name || '', address: res.data.address || '', phone: res.data.phone || '', comment: '' });
    } catch {}
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));
  const getPaymentAdjustment = (method) => paymentSettings[`${method}_adjustment`] ?? (method === 'cash' ? -15 : method === 'crypto' ? -20 : 0);
  const currentPaymentAdjustment = payWithBalance ? (paymentSettings.balance_adjustment ?? 0) : getPaymentAdjustment(paymentMethod);

  const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const adjustedSubtotal = currentPaymentAdjustment !== 0 
    ? Math.round(subtotal * (1 + currentPaymentAdjustment / 100))
    : subtotal;
  
  const isFreeDelivery = !deliverySettings.delivery_enabled || adjustedSubtotal >= deliverySettings.min_free_delivery;
  const deliveryFee = isFreeDelivery ? 0 : deliverySettings.delivery_price;
  const finalTotal = adjustedSubtotal + deliveryFee;

  const canPayWithBalance = prepaymentSettings.prepayment_enabled && userBalance >= finalTotal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.address.trim() || !form.phone.trim()) { toast.error('Заполните все обязательные поля'); return; }
    trackClick('place_order', '/checkout');
    setLoading(true);
    
    const orderAmount = finalTotal;
    
    try {
      // For crypto: show payment modal FIRST, order will be created after successful payment
      if (paymentMethod === 'crypto') {
        setCryptoPaymentAmount(orderAmount);
        setShowCryptoModal(true);
        setLoading(false);
        return;
      }

      // For other methods: create order immediately
      const res = await axios.post(`${API}/orders`, { 
        ...form, 
        payment_method: payWithBalance ? 'balance' : paymentMethod,
        pay_with_balance: payWithBalance
      });
      const newOrderId = res.data.id;
      setOrderId(newOrderId);
      
      if (payWithBalance) {
        await fetchCart();
        setSuccess(true);
        toast.success('Заказ оплачен с баланса!');
        window.__lastToastTime = Date.now();
        return;
      }

      if (paymentMethod === 'card') {
        await fetchCart();
        try {
          const payRes = await axios.post(`${API}/payments/yookassa/create`, {
            order_id: newOrderId, amount: orderAmount, return_url: `${SITE_URL}/orders`
          });
          if (payRes.data.confirmation_url) {
            window.location.href = payRes.data.confirmation_url;
            return;
          }
        } catch (err) {
          toast.error(err.response?.data?.detail || 'ЮKassa недоступна. Заказ создан, оплатите позже.');
        }
        setSuccess(true);
      } else {
        // cash
        await fetchCart();
        setSuccess(true);
        toast.success('Заказ оформлен!');
        window.__lastToastTime = Date.now();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка оформления заказа');
    } finally {
      setLoading(false);
    }
  };

  const handleCryptoSuccess = async (txHash) => {
    setTxHash(txHash);
    setShowCryptoModal(false);
    
    try {
      // Create order AFTER successful crypto payment
      const res = await axios.post(`${API}/orders`, { 
        ...form, 
        payment_method: 'crypto',
        crypto_tx_hash: txHash
      });
      setOrderId(res.data.id);
      await fetchCart();
      setSuccess(true);
      toast.success('Заказ оплачен криптовалютой!');
      window.__lastToastTime = Date.now();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Оплата прошла, но ошибка создания заказа. Свяжитесь с поддержкой.');
      setSuccess(true); // Still show success since payment went through
    }
  };

  const handleCryptoClose = () => {
    // No order was created, just close the modal
    setShowCryptoModal(false);
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); toast.success('Скопировано!'); };

  if (authLoading || cartLoading) return null;
  if (!user) { navigate('/login'); return null; }
  if (cart.items.length === 0 && !success && !showCryptoModal && !loading) { navigate('/cart'); return null; }

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-zinc-950' : ''}`} data-testid="checkout-success">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-teal-500/10 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </div>
        
        <motion.div 
          className="relative text-center max-w-md"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-3xl flex items-center justify-center mb-6 border border-teal-500/30"
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, 10, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <CheckCircle className="w-12 h-12 text-green-400" />
          </motion.div>
          <motion.h1 
            className={`text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Заказ оформлен!
          </motion.h1>
          <motion.p 
            className={`mb-2 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Номер заказа: <span className={`font-mono font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{orderId?.slice(0, 8)}</span>
          </motion.p>
          <motion.p 
            className={`mb-8 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Мы свяжемся с вами для подтверждения.
          </motion.p>
          <motion.div 
            className="flex gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Link to="/account">
              <motion.button 
                className={`px-6 py-3 rounded-xl border font-medium transition-all duration-300 ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800/50' : 'border-slate-300 text-slate-700 hover:bg-white/50'}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Мои заказы
              </motion.button>
            </Link>
            <Link to="/catalog">
              <motion.button 
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold transition-all duration-300 shadow-lg shadow-teal-500/20"
                whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(20, 184, 166, 0.4)' }}
                whileTap={{ scale: 0.98 }}
              >
                Продолжить покупки
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20" data-testid="checkout-page">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-20 right-20 w-96 h-96 rounded-full bg-teal-400/10 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to="/cart" className="inline-flex items-center gap-2 transition-colors mb-4 group text-slate-500 hover:text-teal-600">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
            Назад в корзину
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase">
            <span className="bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">
              Оформление заказа
            </span>
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <motion.form 
            onSubmit={handleSubmit} 
            className="space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* Shipping info */}
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm p-6 space-y-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-sm font-bold uppercase tracking-widest text-teal-600 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Данные доставки
              </h2>
              
              <div>
                <Label htmlFor="full_name" className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">ФИО получателя *</Label>
                <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Иванов Иван Иванович" className="h-12 rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-200 text-slate-800 placeholder:text-slate-400" required data-testid="checkout-fullname" />
              </div>
              <div>
                <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Адрес доставки *</Label>
                <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Город, улица, дом, квартира" className="h-12 rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-200 text-slate-800 placeholder:text-slate-400" required data-testid="checkout-address" />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Телефон *</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+7 (___) ___-__-__" className="h-12 rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-200 text-slate-800 placeholder:text-slate-400" required data-testid="checkout-phone" />
              </div>
              <div>
                <Label htmlFor="comment" className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4" /> Комментарий
                </Label>
                <Textarea id="comment" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  placeholder="Пожелания к доставке..." className="min-h-[80px] rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-200 text-slate-800 placeholder:text-slate-400" data-testid="checkout-comment" />
              </div>
            </motion.div>

            {/* Payment method selection */}
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Label className="text-sm font-bold uppercase tracking-widest text-teal-600 mb-4 block flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Способ оплаты
              </Label>
              <div className="space-y-3">
                {/* Balance payment option */}
                {prepaymentSettings.prepayment_enabled && userBalance > 0 && (
                  <motion.button 
                    type="button" 
                    onClick={() => {
                      if (canPayWithBalance) {
                        setPayWithBalance(true);
                      } else {
                        toast.error(`Недостаточно средств. Баланс: ${formatPrice(userBalance)}₽`);
                      }
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                      payWithBalance 
                        ? 'bg-violet-50 border-violet-400 shadow-sm shadow-violet-200' 
                        : canPayWithBalance
                          ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          : 'bg-slate-100 border-slate-200 opacity-60'
                    }`}
                    whileHover={canPayWithBalance ? { scale: 1.01 } : {}}
                    whileTap={canPayWithBalance ? { scale: 0.99 } : {}}
                    data-testid="payment-method-balance"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      payWithBalance ? 'bg-violet-100' : 'bg-slate-100'
                    }`}>
                      <Sparkles className={`w-6 h-6 ${payWithBalance ? 'text-violet-500' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${payWithBalance ? 'text-violet-700' : 'text-slate-700'}`}>
                        Оплата с баланса
                      </p>
                      <p className="text-xs text-slate-500">
                        Баланс: <span className={canPayWithBalance ? 'text-emerald-600 font-semibold' : 'text-rose-500'}>{formatPrice(userBalance)}₽</span>
                        {!canPayWithBalance && <span className="text-rose-500"> (недостаточно)</span>}
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      payWithBalance ? 'border-violet-500' : 'border-slate-300'
                    }`}>
                      {payWithBalance && <motion.div 
                        className="w-3 h-3 rounded-full bg-violet-500"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.2 }}
                      />}
                    </div>
                  </motion.button>
                )}
                
                {/* Regular payment methods */}
                {PAYMENT_METHODS.map(method => {
                  const adjustment = getPaymentAdjustment(method.id);
                  const isEnabled = isPaymentMethodEnabled(method.id);
                  const isSelected = !payWithBalance && paymentMethod === method.id;
                  const Icon = method.icon;
                  return (
                    <motion.button 
                      key={method.id} 
                      type="button" 
                      onClick={() => {
                        if (isEnabled) {
                          setPayWithBalance(false);
                          setPaymentMethod(method.id);
                        }
                      }}
                      disabled={!isEnabled}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                        !isEnabled 
                          ? 'bg-slate-100 border-slate-200 cursor-not-allowed' 
                          : isSelected 
                            ? 'bg-teal-50 border-teal-400 shadow-sm shadow-teal-200' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      whileHover={isEnabled ? { scale: 1.01 } : {}}
                      whileTap={isEnabled ? { scale: 0.99 } : {}}
                      data-testid={`payment-method-${method.id}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        !isEnabled 
                          ? 'bg-slate-200'
                          : isSelected 
                            ? 'bg-teal-100' 
                            : 'bg-slate-100'
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          !isEnabled ? 'text-slate-400' : isSelected ? 'text-teal-600' : 'text-slate-500'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold ${!isEnabled ? 'text-slate-400' : isSelected ? 'text-teal-700' : 'text-slate-700'}`}>
                          {method.label}
                        </p>
                        <p className={`text-xs ${!isEnabled ? 'text-rose-400 font-medium' : 'text-slate-500'}`}>
                          {!isEnabled ? 'Временно недоступно' : method.desc}
                        </p>
                      </div>
                      {isEnabled && adjustment !== 0 && (
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                          adjustment < 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                        }`}>
                          {adjustment < 0 ? `-${Math.abs(adjustment)}%` : `+${adjustment}%`}
                        </span>
                      )}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        !isEnabled ? 'border-slate-300' : isSelected ? 'border-teal-500' : 'border-slate-300'
                      }`}>
                        {isSelected && isEnabled && <motion.div 
                          className="w-3 h-3 rounded-full bg-teal-500"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2 }}
                        />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Terms agreement */}
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-start gap-4">
                <motion.button
                  type="button"
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 ${
                    agreedToTerms 
                      ? 'bg-teal-500 border-teal-500' 
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                  whileTap={{ scale: 0.9 }}
                  data-testid="terms-checkbox"
                >
                  <AnimatePresence>
                    {agreedToTerms && (
                      <motion.svg 
                        className="w-4 h-4 text-white" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </motion.button>
                <label className="text-sm text-slate-600 cursor-pointer" onClick={() => setAgreedToTerms(!agreedToTerms)}>
                  Я ознакомился и согласен с{' '}
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowTermsModal(true); }}
                    className="text-teal-600 hover:text-teal-500 underline font-medium transition-colors"
                    data-testid="terms-link"
                  >
                    правилами предоставления услуг
                  </button>
                </label>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: agreedToTerms ? 1.01 : 1 }}
              whileTap={{ scale: agreedToTerms ? 0.99 : 1 }}
            >
              <Button type="submit" disabled={loading || !agreedToTerms}
                className={`w-full font-bold uppercase tracking-wide h-14 rounded-xl text-lg transition-all duration-300 ${
                  agreedToTerms 
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/20' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`} data-testid="place-order-btn">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {loading ? 'Оформление...' : payWithBalance ? 'Оплатить с баланса' : paymentMethod === 'card' ? 'Оплатить картой' : paymentMethod === 'crypto' ? 'Перейти к оплате' : 'Подтвердить заказ'}
              </Button>
            </motion.div>
            {!agreedToTerms && (
              <motion.p 
                className="text-xs text-slate-500 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Для оформления заказа необходимо согласиться с правилами
              </motion.p>
            )}
          </motion.form>

          {/* Order summary */}
          <motion.div 
            className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm p-6 h-fit sticky top-24"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-sm font-bold uppercase tracking-widest text-teal-600 mb-5 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Ваш заказ
            </h2>
            <div className="space-y-4 mb-6">
              {cart.items.map((item, index) => (
                <motion.div 
                  key={item.product_id} 
                  className="flex gap-4 text-sm border-b border-slate-200 pb-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <div className="flex-1">
                    {item.manufacturer && <p className="text-xs font-bold text-teal-600 mb-1">{item.manufacturer}</p>}
                    <p className="text-slate-800 font-medium">{item.name}</p>
                    <p className="text-slate-500 text-xs mt-1">{item.quantity} шт. × {formatPrice(item.price)} ₽</p>
                  </div>
                  <span className="font-bold text-slate-800 whitespace-nowrap">{formatPrice(item.price * item.quantity)} ₽</span>
                </motion.div>
              ))}
            </div>
            <div className="border-t border-slate-200 pt-5 space-y-3">
              {currentPaymentAdjustment !== 0 && (
                <>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Подытог:</span>
                    <span>{formatPrice(subtotal)} ₽</span>
                  </div>
                  <div className={`flex justify-between text-sm font-medium ${currentPaymentAdjustment < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <span>{currentPaymentAdjustment < 0 ? 'Скидка' : 'Наценка'} ({Math.abs(currentPaymentAdjustment)}%):</span>
                    <span>{currentPaymentAdjustment < 0 ? '-' : '+'}{formatPrice(Math.abs(adjustedSubtotal - subtotal))} ₽</span>
                  </div>
                </>
              )}
              {deliverySettings.delivery_enabled && (
                <div className="flex justify-between text-sm" data-testid="delivery-fee-row">
                  <span className="text-slate-600">Доставка:</span>
                  {isFreeDelivery ? (
                    <span className="text-emerald-600 font-medium">Бесплатно</span>
                  ) : (
                    <span className="text-slate-700 font-medium">{formatPrice(deliveryFee)} ₽</span>
                  )}
                </div>
              )}
              {!isFreeDelivery && deliverySettings.delivery_enabled && (
                <p className="text-xs text-slate-400">
                  Бесплатная доставка от {formatPrice(deliverySettings.min_free_delivery)} ₽
                </p>
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold text-slate-700">Итого:</span>
                <motion.span 
                  className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent"
                  data-testid="checkout-total"
                  key={finalTotal}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {formatPrice(finalTotal)} ₽
                </motion.span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Terms Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl" data-testid="terms-modal">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center border border-teal-200">
                <FileText className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">Правила предоставления услуг</DialogTitle>
                <DialogDescription className="sr-only">Ознакомьтесь с правилами предоставления услуг магазина</DialogDescription>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-6 text-sm text-slate-600">
            {termsSections.length > 0 ? (
              termsSections.map((section) => (
                <section key={section.id}>
                  <h3 className="font-bold text-slate-800 mb-2">{section.title}</h3>
                  {section.content.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-2 whitespace-pre-line text-slate-600">{paragraph}</p>
                  ))}
                </section>
              ))
            ) : (
              <div className="text-center text-slate-500 py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Загрузка правил...
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 flex gap-3">
            <motion.button
              onClick={() => {
                setAgreedToTerms(true);
                setShowTermsModal(false);
              }}
              className="flex-1 h-12 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all duration-300"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              data-testid="accept-terms-btn"
            >
              Принять и согласиться
            </motion.button>
            <motion.button
              onClick={() => setShowTermsModal(false)}
              className="flex-1 h-12 border border-zinc-700 text-zinc-300 hover:bg-zinc-800/50 rounded-xl font-medium transition-all duration-300"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              data-testid="close-terms-btn"
            >
              Закрыть
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

    {/* Crypto Payment Modal */}
    <CryptoPaymentModal
      open={showCryptoModal}
      onClose={handleCryptoClose}
      orderId={orderId}
      amountRub={cryptoPaymentAmount}
      onSuccess={handleCryptoSuccess}
    />
    </>
  );
}
