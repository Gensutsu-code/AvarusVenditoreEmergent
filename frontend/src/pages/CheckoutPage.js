import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, Banknote, MessageSquare, CreditCard, Bitcoin, Wallet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Наличные', desc: 'Оплата при получении', icon: Banknote, color: 'green' },
  { id: 'card', label: 'Банковская карта', desc: 'Онлайн оплата картой', icon: CreditCard, color: 'blue' },
  { id: 'crypto', label: 'Криптовалюта', desc: 'Оплата криптовалютой', icon: Wallet, color: 'amber' },
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, cartTotal, fetchCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentSettings, setPaymentSettings] = useState({ card_discount: 0, crypto_discount: 0, cash_discount: 0 });
  const [form, setForm] = useState({
    full_name: '',
    address: '',
    phone: '',
    comment: ''
  });

  useEffect(() => {
    if (user) {
      fetchLastShipping();
    }
    axios.get(`${API}/payment-settings`).then(res => setPaymentSettings(res.data)).catch(() => {});
  }, [user]);

  const fetchLastShipping = async () => {
    try {
      const res = await axios.get(`${API}/user/last-shipping`);
      const data = res.data;
      setForm({
        full_name: data.full_name || '',
        address: data.address || '',
        phone: data.phone || '',
        comment: ''
      });
    } catch (err) {
      console.error('Failed to fetch last shipping', err);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));

  const getPaymentDiscount = (method) => {
    return paymentSettings[`${method}_discount`] || 0;
  };

  const currentPaymentDiscount = getPaymentDiscount(paymentMethod);
  const finalTotal = currentPaymentDiscount > 0 
    ? cartTotal * (1 - currentPaymentDiscount / 100) 
    : cartTotal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.full_name.trim() || !form.address.trim() || !form.phone.trim()) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/orders`, {
        ...form,
        payment_method: paymentMethod
      });
      setOrderId(res.data.id);
      setSuccess(true);
      await fetchCart();
      toast.success('Заказ оформлен!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка оформления заказа');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;
  if (!user) { navigate('/login'); return null; }
  if (cart.items.length === 0 && !success) { navigate('/cart'); return null; }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="checkout-success">
        <div className="text-center max-w-md px-4">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Заказ оформлен!</h1>
          <p className="text-zinc-500 mb-2">
            Номер заказа: <span className="font-mono font-semibold">{orderId?.slice(0, 8)}</span>
          </p>
          <p className="text-zinc-500 mb-6">Мы свяжемся с вами для подтверждения.</p>
          <div className="flex gap-4 justify-center">
            <Link to="/account"><Button variant="outline">Мои заказы</Button></Link>
            <Link to="/catalog">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">Продолжить покупки</Button>
            </Link>
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
                <MessageSquare className="w-4 h-4" /> Комментарий к заказу
              </Label>
              <Textarea id="comment" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Дополнительные пожелания..." className="mt-2 bg-zinc-50 min-h-[80px]" data-testid="checkout-comment" />
            </div>

            {/* Payment method selection */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Способ оплаты</Label>
              <div className="space-y-2">
                {PAYMENT_METHODS.map(method => {
                  const discount = getPaymentDiscount(method.id);
                  const isSelected = paymentMethod === method.id;
                  const Icon = method.icon;
                  return (
                    <button key={method.id} type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected 
                          ? `border-orange-500 bg-orange-50` 
                          : `border-zinc-200 bg-white hover:border-zinc-300`
                      }`}
                      data-testid={`payment-method-${method.id}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-orange-500 text-white' : `bg-${method.color}-50 text-${method.color}-600`
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold ${isSelected ? 'text-orange-700' : 'text-zinc-800'}`}>{method.label}</p>
                        <p className="text-xs text-zinc-500">{method.desc}</p>
                      </div>
                      {discount > 0 && (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                          -{discount}%
                        </span>
                      )}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-orange-500' : 'border-zinc-300'
                      }`}>
                        {isSelected && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide h-12"
              data-testid="place-order-btn">
              {loading ? 'Оформление...' : 'Подтвердить заказ'}
            </Button>
          </form>

          {/* Order summary */}
          <div className="border border-zinc-200 p-6 h-fit">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Ваш заказ</h2>
            <div className="space-y-4 mb-6">
              {cart.items.map((item) => (
                <div key={item.product_id} className="flex gap-3 text-sm border-b border-zinc-100 pb-3">
                  <div className="flex-1">
                    {item.manufacturer && <p className="text-xs font-bold text-orange-600">{item.manufacturer}</p>}
                    <p className="text-xs font-mono font-semibold text-zinc-500">Арт: {item.article}</p>
                    <p className="text-zinc-900 font-medium">{item.name}</p>
                    <p className="text-zinc-500 text-xs mt-1">{item.quantity} шт. × {formatPrice(item.price)} ₽</p>
                  </div>
                  <span className="font-mono font-semibold whitespace-nowrap">{formatPrice(item.price * item.quantity)} ₽</span>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-200 pt-4 space-y-2">
              <div className="flex justify-between items-center text-sm text-zinc-500">
                <span>Сумма товаров:</span>
                <span>{formatPrice(cartTotal)} ₽</span>
              </div>
              {currentPaymentDiscount > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600">
                  <span>Скидка за оплату ({PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}):</span>
                  <span>-{currentPaymentDiscount}%</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                <span className="font-semibold text-zinc-900">Итого:</span>
                <span className="price-tag text-xl text-zinc-900" data-testid="checkout-total">
                  {formatPrice(finalTotal)} ₽
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
