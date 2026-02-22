import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, Banknote, MessageSquare, CreditCard, Wallet, Copy, ExternalLink, Loader2, Clock, FileText, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SITE_URL = process.env.REACT_APP_BACKEND_URL;

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Наличные', desc: 'Оплата при получении', icon: Banknote, color: 'green' },
  { id: 'card', label: 'Банковская карта', desc: 'Онлайн оплата картой (ЮKassa)', icon: CreditCard, color: 'blue' },
  { id: 'crypto', label: 'Криптовалюта', desc: 'Оплата через MetaMask/кошелёк', icon: Wallet, color: 'amber' },
];

const CHAINS = [
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', chainId: '0x1', explorer: 'https://etherscan.io/tx/' },
  { id: 'bsc', name: 'BSC', symbol: 'BNB', chainId: '0x38', explorer: 'https://bscscan.com/tx/' },
  { id: 'base', name: 'Base', symbol: 'ETH', chainId: '0x2105', explorer: 'https://basescan.org/tx/' },
  { id: 'trc', name: 'TRON', symbol: 'TRX', chainId: null, explorer: 'https://tronscan.org/#/transaction/' },
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
  const [selectedChain, setSelectedChain] = useState('eth');
  const [txHash, setTxHash] = useState('');
  const [cryptoStep, setCryptoStep] = useState(null); // null | 'pay' | 'submitted'
  const [form, setForm] = useState({ full_name: '', address: '', phone: '', comment: '' });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Check if payment method is enabled
  const isPaymentMethodEnabled = (method) => paymentSettings[`${method}_enabled`] !== false;

  useEffect(() => {
    if (user) fetchLastShipping();
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
  }, [user]);

  const fetchLastShipping = async () => {
    try {
      const res = await axios.get(`${API}/user/last-shipping`);
      setForm({ full_name: res.data.full_name || '', address: res.data.address || '', phone: res.data.phone || '', comment: '' });
    } catch {}
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));
  const getPaymentDiscount = (method) => paymentSettings[`${method}_discount`] || 0;
  const currentPaymentDiscount = getPaymentDiscount(paymentMethod);

  // Calculate subtotal (before payment discount)
  const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Apply payment discount only
  const finalTotal = currentPaymentDiscount > 0 
    ? Math.round(subtotal * (1 - currentPaymentDiscount / 100))
    : subtotal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.address.trim() || !form.phone.trim()) { toast.error('Заполните все обязательные поля'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/orders`, { ...form, payment_method: paymentMethod });
      const newOrderId = res.data.id;
      setOrderId(newOrderId);
      await fetchCart();

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
        setCryptoStep('pay');
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

  const handleCryptoSubmit = async () => {
    if (!txHash.trim()) { toast.error('Введите хеш транзакции'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/payments/crypto/submit`, { order_id: orderId, chain: selectedChain, tx_hash: txHash.trim() });
      setCryptoStep('submitted');
      toast.success('Транзакция отправлена на проверку!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const connectMetaMask = async () => {
    if (!window.ethereum) { toast.error('MetaMask не установлен'); return; }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const chain = CHAINS.find(c => c.id === selectedChain);
      if (chain?.chainId) {
        try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chain.chainId }] }); } catch {}
      }
      const walletAddr = cryptoWallets[`${selectedChain}_address`];
      if (!walletAddr) { toast.error('Кошелёк для этой сети не настроен'); return; }
      
      // Use ethers to send transaction
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // For simplicity, send native token. Amount conversion would need an oracle in production.
      const tx = await signer.sendTransaction({ to: walletAddr, value: ethers.parseEther('0.001') }); // Placeholder amount
      setTxHash(tx.hash);
      toast.success(`Транзакция отправлена: ${tx.hash.slice(0, 10)}...`);
    } catch (err) {
      toast.error(err.message || 'Ошибка MetaMask');
    }
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); toast.success('Скопировано!'); };

  if (authLoading || cartLoading) return null;
  if (!user) { navigate('/login'); return null; }
  if (cart.items.length === 0 && !success && !cryptoStep && !loading) { navigate('/cart'); return null; }

  // Crypto payment step
  if (cryptoStep === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="crypto-submitted">
        <div className="text-center max-w-md px-4">
          <Clock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Ожидание подтверждения</h1>
          <p className="text-zinc-500 mb-4">Ваш крипто-платёж отправлен на проверку администратору.</p>
          <p className="text-sm text-zinc-400 font-mono mb-6">TX: {txHash.slice(0, 20)}...</p>
          <div className="flex gap-4 justify-center">
            <Link to="/orders"><Button variant="outline">Мои заказы</Button></Link>
            <Link to="/catalog"><Button className="bg-orange-500 hover:bg-orange-600 text-white">В каталог</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  if (cryptoStep === 'pay') {
    const walletAddr = cryptoWallets[`${selectedChain}_address`];
    const chain = CHAINS.find(c => c.id === selectedChain);
    return (
      <div className="min-h-screen" data-testid="crypto-payment-page">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Оплата криптовалютой</h1>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
            <p className="font-semibold text-amber-800 mb-2">Заказ #{orderId?.slice(0, 8)}</p>
            <p className="text-2xl font-bold text-zinc-900 mb-4">{formatPrice(finalTotal)} ₽</p>
            
            <Label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Выберите сеть</Label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {CHAINS.map(c => (
                <button key={c.id} onClick={() => setSelectedChain(c.id)}
                  className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-all ${selectedChain === c.id ? 'border-amber-500 bg-amber-100' : 'border-zinc-200 hover:border-zinc-300'}`}>
                  {c.name}<br /><span className="text-xs text-zinc-500">{c.symbol}</span>
                </button>
              ))}
            </div>

            {walletAddr ? (
              <div className="bg-white rounded-lg p-4 border border-amber-200 mb-4">
                <Label className="text-xs font-bold uppercase text-zinc-500">Адрес для оплаты ({chain?.name})</Label>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 text-sm font-mono bg-zinc-50 p-2 rounded break-all">{walletAddr}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(walletAddr)}><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
            ) : (
              <p className="text-red-600 text-sm mb-4">Кошелёк для сети {chain?.name} не настроен</p>
            )}

            {selectedChain !== 'trc' && window.ethereum && (
              <Button onClick={connectMetaMask} className="w-full bg-amber-500 hover:bg-amber-600 text-white mb-4" data-testid="connect-metamask-btn">
                <Wallet className="w-4 h-4 mr-2" /> Оплатить через MetaMask
              </Button>
            )}

            <div className="mt-4">
              <Label className="text-xs font-bold uppercase text-zinc-500">Хеш транзакции (TX Hash)</Label>
              <div className="flex gap-2 mt-2">
                <Input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x..." className="flex-1 font-mono" data-testid="tx-hash-input" />
              </div>
            </div>
          </div>

          <Button onClick={handleCryptoSubmit} disabled={loading || !txHash.trim()} className="w-full bg-green-500 hover:bg-green-600 text-white h-12 font-bold" data-testid="submit-crypto-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Подтвердить оплату
          </Button>
        </div>
      </div>
    );
  }

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
                {PAYMENT_METHODS.map(method => {
                  const discount = getPaymentDiscount(method.id);
                  const isEnabled = isPaymentMethodEnabled(method.id);
                  const isSelected = paymentMethod === method.id;
                  const Icon = method.icon;
                  return (
                    <button key={method.id} type="button" 
                      onClick={() => isEnabled && setPaymentMethod(method.id)}
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
              <h2 className="text-xl font-bold text-zinc-900">Правила предоставления услуг</h2>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-6 text-sm text-zinc-700">
            <section>
              <h3 className="font-bold text-zinc-900 mb-2">1. Общие положения</h3>
              <p className="mb-2">
                1.1. Настоящие Правила регулируют отношения между интернет-магазином AVOPT.STORE (далее — «Продавец») 
                и физическими или юридическими лицами (далее — «Покупатель»), оформляющими заказы на сайте.
              </p>
              <p className="mb-2">
                1.2. Оформляя заказ, Покупатель подтверждает своё согласие с настоящими Правилами и принимает на себя 
                указанные в них права и обязанности.
              </p>
              <p>
                1.3. Продавец оставляет за собой право вносить изменения в настоящие Правила без предварительного 
                уведомления Покупателя.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-zinc-900 mb-2">2. Оформление заказа</h3>
              <p className="mb-2">
                2.1. Заказ оформляется путём добавления товаров в корзину и заполнения формы оформления заказа 
                на сайте Продавца.
              </p>
              <p className="mb-2">
                2.2. Покупатель обязуется предоставить достоверную информацию о себе: ФИО, контактный телефон, 
                адрес доставки.
              </p>
              <p>
                2.3. После оформления заказа Покупателю направляется подтверждение на указанные контактные данные. 
                Заказ считается принятым после подтверждения менеджером.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-zinc-900 mb-2">3. Цены и оплата</h3>
              <p className="mb-2">
                3.1. Цены на товары указаны в российских рублях и включают НДС (при наличии).
              </p>
              <p className="mb-2">
                3.2. Продавец оставляет за собой право изменять цены на товары без предварительного уведомления. 
                Цена заказа фиксируется в момент его оформления.
              </p>
              <p className="mb-2">
                3.3. Оплата производится одним из способов: наличными при получении, банковской картой онлайн, 
                криптовалютой.
              </p>
              <p>
                3.4. При оплате определёнными способами может предоставляться скидка, указанная на странице оформления.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-zinc-900 mb-2">4. Доставка</h3>
              <p className="mb-2">
                4.1. Доставка осуществляется по адресу, указанному Покупателем при оформлении заказа.
              </p>
              <p className="mb-2">
                4.2. Сроки доставки указываются ориентировочно и могут варьироваться в зависимости от наличия 
                товара на складе и региона доставки.
              </p>
              <p>
                4.3. Стоимость доставки рассчитывается индивидуально и сообщается Покупателю при подтверждении заказа.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-zinc-900 mb-2">5. Возврат и обмен</h3>
              <p className="mb-2">
                5.1. Возврат товара надлежащего качества возможен в течение 14 дней с момента получения при 
                сохранении товарного вида и потребительских свойств.
              </p>
              <p className="mb-2">
                5.2. Возврат товара ненадлежащего качества осуществляется в соответствии с законодательством РФ 
                о защите прав потребителей.
              </p>
              <p>
                5.3. Для оформления возврата необходимо связаться с менеджером через чат поддержки на сайте.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-zinc-900 mb-2">6. Гарантии</h3>
              <p className="mb-2">
                6.1. На все товары распространяется гарантия производителя.
              </p>
              <p>
                6.2. Гарантийные обязательства не распространяются на повреждения, возникшие вследствие 
                неправильной эксплуатации, хранения или транспортировки товара Покупателем.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-zinc-900 mb-2">7. Конфиденциальность</h3>
              <p className="mb-2">
                7.1. Продавец обязуется не разглашать персональные данные Покупателя третьим лицам, за исключением 
                случаев, предусмотренных законодательством РФ.
              </p>
              <p>
                7.2. Персональные данные используются исключительно для обработки и доставки заказов, а также 
                для информирования о статусе заказа.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-zinc-900 mb-2">8. Контактная информация</h3>
              <p>
                По всем вопросам обращайтесь через чат поддержки на сайте или по электронной почте, 
                указанной в разделе «Контакты».
              </p>
            </section>
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
  );
}
