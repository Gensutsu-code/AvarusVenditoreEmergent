import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, Banknote, MessageSquare, CreditCard, Wallet, Loader2, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import CryptoPaymentModal from '../components/CryptoPaymentModal';

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
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentSettings, setPaymentSettings] = useState({ 
    card_discount: 0, crypto_discount: 0, cash_discount: 0,
    card_enabled: true, crypto_enabled: true, cash_enabled: true
  });
  const [cryptoWallets, setCryptoWallets] = useState({});
  const [selectedChain, setSelectedChain] = useState('bsc');
  const [txHash, setTxHash] = useState('');
  const [cryptoStep, setCryptoStep] = useState(null); // null | 'modal' | 'submitted'
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', address: '', phone: '', comment: '' });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsSections, setTermsSections] = useState([]);
  
  // Balance payment state
  const [userBalance, setUserBalance] = useState(0);
  const [payWithBalance, setPayWithBalance] = useState(false);
  const [prepaymentSettings, setPrepaymentSettings] = useState({ prepayment_enabled: true });

  // Check if payment method is enabled
  const isPaymentMethodEnabled = (method) => paymentSettings[`${method}_enabled`] !== false;

  useEffect(() => {
    if (user) {
      fetchLastShipping();
      fetchUserBalance();
    }
    axios.get(`${API}/payment-settings`).then(res => {
      setPaymentSettings(res.data);
      // Auto-select first enabled payment method
      if (res.data.cash_enabled !== false) {
        setPaymentMethod('cash');
      } else if (res.data.card_enabled !== false) {
        setPaymentMethod('card');
      } else if (res.data.crypto_enabled !== false) {
        setPaymentMethod('crypto');
      }
    }).catch(() => {});
    axios.get(`${API}/crypto-wallets`).then(res => setCryptoWallets(res.data)).catch(() => {});
    // Fetch terms of service
    axios.get(`${API}/terms`).then(res => setTermsSections(res.data.sections || [])).catch(() => {});
    // Fetch prepayment settings
    axios.get(`${API}/prepayment-settings`).then(res => setPrepaymentSettings(res.data)).catch(() => {});
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
  const getPaymentDiscount = (method) => paymentSettings[`${method}_discount`] || 0;
  const currentPaymentDiscount = payWithBalance ? 0 : getPaymentDiscount(paymentMethod);

  // Calculate subtotal (before payment discount)
  const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Apply payment discount only (not for balance payments)
  const finalTotal = currentPaymentDiscount > 0 
    ? Math.round(subtotal * (1 - currentPaymentDiscount / 100))
    : subtotal;

  // Check if user can pay with balance
  const canPayWithBalance = prepaymentSettings.prepayment_enabled && userBalance >= finalTotal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.address.trim() || !form.phone.trim()) { toast.error('Заполните все обязательные поля'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/orders`, { 
        ...form, 
        payment_method: payWithBalance ? 'balance' : paymentMethod,
        pay_with_balance: payWithBalance
      });
      const newOrderId = res.data.id;
      setOrderId(newOrderId);
      await fetchCart();
      
      if (payWithBalance) {
        // Balance payment - instant success
        setSuccess(true);
        toast.success('Заказ оплачен с баланса!');
        return;
      }

      if (paymentMethod === 'card') {
        // Redirect to YuKassa
        try {
          const payRes = await axios.post(`${API}/payments/yookassa/create`, {
            order_id: newOrderId, amount: finalTotal, return_url: `${SITE_URL}/orders`
          });
          if (payRes.data.confirmation_url) {
            window.location.href = payRes.data.confirmation_url;
            return;
          }
        } catch (err) {
          toast.error(err.response?.data?.detail || 'ЮKassa недоступна. Заказ создан, оплатите позже.');
        }
        setSuccess(true);
      } else if (paymentMethod === 'crypto') {
        // Open crypto payment modal
        setShowCryptoModal(true);
      } else {
        setSuccess(true);
        toast.success('Заказ оформлен!');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка оформления заказа');
    } finally {
      setLoading(false);
    }
  };

  const handleCryptoSuccess = (txHash) => {
    setTxHash(txHash);
    setShowCryptoModal(false);
    setSuccess(true);
    toast.success('Заказ оплачен криптовалютой!');
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); toast.success('Скопировано!'); };

  if (authLoading || cartLoading) return null;
  if (!user) { navigate('/login'); return null; }
  if (cart.items.length === 0 && !success && !showCryptoModal && !loading) { navigate('/cart'); return null; }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="checkout-success">
        <div className="text-center max-w-md px-4">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Заказ оформлен!</h1>
          <p className="text-zinc-500 mb-2">Номер заказа: <span className="font-mono font-semibold">{orderId?.slice(0, 8)}</span></p>
          <p className="text-zinc-500 mb-6">Мы свяжемся с вами для подтверждения.</p>
          <div className="flex gap-4 justify-center">
            <Link to="/account"><Button variant="outline">Мои заказы</Button></Link>
            <Link to="/catalog"><Button className="bg-orange-500 hover:bg-orange-600 text-white">Продолжить покупки</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen" data-testid="checkout-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link to="/cart" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Назад в корзину
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900">Оформление заказа</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="full_name" className="text-xs font-bold uppercase tracking-widest text-zinc-500">ФИО получателя *</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Иванов Иван Иванович" className="mt-2 h-12 bg-zinc-50" required data-testid="checkout-fullname" />
            </div>
            <div>
              <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Адрес доставки *</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Город, улица, дом, квартира" className="mt-2 h-12 bg-zinc-50" required data-testid="checkout-address" />
            </div>
            <div>
              <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-zinc-500">Телефон *</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+7 (___) ___-__-__" className="mt-2 h-12 bg-zinc-50" required data-testid="checkout-phone" />
            </div>
            <div>
              <Label htmlFor="comment" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Комментарий
              </Label>
              <Textarea id="comment" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Пожелания..." className="mt-2 bg-zinc-50 min-h-[60px]" data-testid="checkout-comment" />
            </div>

            {/* Payment method selection */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Способ оплаты</Label>
              <div className="space-y-2">
                {/* Balance payment option */}
                {prepaymentSettings.prepayment_enabled && userBalance > 0 && (
                  <button 
                    type="button" 
                    onClick={() => {
                      if (canPayWithBalance) {
                        setPayWithBalance(true);
                      } else {
                        toast.error(`Недостаточно средств. Баланс: ${formatPrice(userBalance)}₽`);
                      }
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                      payWithBalance 
                        ? 'border-purple-500 bg-purple-50' 
                        : canPayWithBalance
                          ? 'border-zinc-200 bg-white hover:border-purple-300'
                          : 'border-zinc-200 bg-zinc-50 opacity-70'
                    }`} 
                    data-testid="payment-method-balance"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      payWithBalance ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-600'
                    }`}>
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${payWithBalance ? 'text-purple-700' : 'text-zinc-800'}`}>
                        Оплата с баланса
                      </p>
                      <p className="text-xs text-zinc-500">
                        Баланс: <span className={canPayWithBalance ? 'text-green-600 font-semibold' : 'text-red-500'}>{formatPrice(userBalance)}₽</span>
                        {!canPayWithBalance && <span className="text-red-500"> (недостаточно)</span>}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      payWithBalance ? 'border-purple-500' : 'border-zinc-300'
                    }`}>
                      {payWithBalance && <div className="w-3 h-3 rounded-full bg-purple-500" />}
                    </div>
                  </button>
                )}
                
                {/* Regular payment methods */}
                {PAYMENT_METHODS.map(method => {
                  const discount = getPaymentDiscount(method.id);
                  const isEnabled = isPaymentMethodEnabled(method.id);
                  const isSelected = !payWithBalance && paymentMethod === method.id;
                  const Icon = method.icon;
                  return (
                    <button key={method.id} type="button" 
                      onClick={() => {
                        if (isEnabled) {
                          setPayWithBalance(false);
                          setPaymentMethod(method.id);
                        }
                      }}
                      disabled={!isEnabled}
                      className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                        !isEnabled 
                          ? 'border-zinc-200 bg-zinc-100 opacity-60 cursor-not-allowed' 
                          : isSelected 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`} data-testid={`payment-method-${method.id}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        !isEnabled 
                          ? 'bg-zinc-200 text-zinc-400'
                          : isSelected 
                            ? 'bg-orange-500 text-white' 
                            : 'bg-zinc-100 text-zinc-600'
                      }`}><Icon className="w-5 h-5" /></div>
                      <div className="flex-1">
                        <p className={`font-semibold ${!isEnabled ? 'text-zinc-400' : isSelected ? 'text-orange-700' : 'text-zinc-800'}`}>
                          {method.label}
                        </p>
                        <p className={`text-xs ${!isEnabled ? 'text-red-400 font-medium' : 'text-zinc-500'}`}>
                          {!isEnabled ? 'Временно недоступно' : method.desc}
                        </p>
                      </div>
                      {isEnabled && discount > 0 && (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">-{discount}%</span>
                      )}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        !isEnabled ? 'border-zinc-300' : isSelected ? 'border-orange-500' : 'border-zinc-300'
                      }`}>
                        {isSelected && isEnabled && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Terms agreement checkbox */}
            <div className="flex items-start gap-3 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
              <input 
                type="checkbox" 
                id="terms-agreement"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-zinc-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                data-testid="terms-checkbox"
              />
              <label htmlFor="terms-agreement" className="text-sm text-zinc-600 cursor-pointer">
                Я ознакомился и согласен с{' '}
                <button 
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-orange-600 hover:text-orange-700 underline font-medium"
                  data-testid="terms-link"
                >
                  правилами предоставления услуг
                </button>
              </label>
            </div>

            <Button type="submit" disabled={loading || !agreedToTerms}
              className={`w-full font-bold uppercase tracking-wide h-12 ${
                agreedToTerms 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
              }`} data-testid="place-order-btn">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? 'Оформление...' : paymentMethod === 'card' ? 'Оплатить картой' : paymentMethod === 'crypto' ? 'Перейти к оплате' : 'Подтвердить заказ'}
            </Button>
            {!agreedToTerms && (
              <p className="text-xs text-zinc-500 text-center">Для оформления заказа необходимо согласиться с правилами</p>
            )}
          </form>

          {/* Order summary */}
          <div className="border border-zinc-200 rounded-xl p-6 h-fit sticky top-20">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Ваш заказ</h2>
            <div className="space-y-3 mb-6">
              {cart.items.map(item => {
                return (
                <div key={item.product_id} className="flex gap-3 text-sm border-b border-zinc-100 pb-3">
                  <div className="flex-1">
                    {item.manufacturer && <p className="text-xs font-bold text-orange-600">{item.manufacturer}</p>}
                    <p className="text-zinc-900 font-medium">{item.name}</p>
                    <p className="text-zinc-500 text-xs">{item.quantity} шт. × {formatPrice(item.price)} ₽</p>
                  </div>
                  <span className="font-semibold whitespace-nowrap">{formatPrice(item.price * item.quantity)} ₽</span>
                </div>
                );
              })}
            </div>
            <div className="border-t border-zinc-200 pt-4 space-y-2">
              {currentPaymentDiscount > 0 && (
                <>
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Подытог:</span>
                    <span>{formatPrice(subtotal)} ₽</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Скидка за оплату ({currentPaymentDiscount}%):</span>
                    <span>-{formatPrice(subtotal - finalTotal)} ₽</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="font-semibold">Итого:</span>
                <span className="text-xl font-bold text-zinc-900" data-testid="checkout-total">{formatPrice(finalTotal)} ₽</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="terms-modal">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-zinc-900">Правила предоставления услуг</DialogTitle>
                <DialogDescription className="sr-only">Ознакомьтесь с правилами предоставления услуг магазина</DialogDescription>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-6 text-sm text-zinc-700">
            {termsSections.length > 0 ? (
              termsSections.map((section) => (
                <section key={section.id}>
                  <h3 className="font-bold text-zinc-900 mb-2">{section.title}</h3>
                  {section.content.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-2 whitespace-pre-line">{paragraph}</p>
                  ))}
                </section>
              ))
            ) : (
              <div className="text-center text-zinc-500 py-8">
                Загрузка правил...
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-200 flex gap-3">
            <Button 
              onClick={() => {
                setAgreedToTerms(true);
                setShowTermsModal(false);
              }}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              data-testid="accept-terms-btn"
            >
              Принять и согласиться
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowTermsModal(false)}
              className="flex-1"
              data-testid="close-terms-btn"
            >
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

      {/* Crypto Payment Modal */}
      <CryptoPaymentModal
        open={showCryptoModal}
        onClose={() => setShowCryptoModal(false)}
        orderId={orderId}
        amountRub={finalTotal}
        onSuccess={handleCryptoSuccess}
      />
    </>
  );
}
