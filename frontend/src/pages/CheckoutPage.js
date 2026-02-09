import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, Banknote, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, cartTotal, fetchCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.full_name.trim() || !form.address.trim() || !form.phone.trim()) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/orders`, form);
      setOrderId(res.data.id);
      setSuccess(true);
      await fetchCart();
      toast.success('Заказ оформлен!');
    } catch (err) {
      toast.error('Ошибка оформления заказа');
    } finally {
      setLoading(false);
    }
  };

  // Wait for auth loading before redirecting
  if (authLoading) {
    return null;
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  if (cart.items.length === 0 && !success) {
    navigate('/cart');
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="checkout-success">
        <div className="text-center max-w-md px-4">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Заказ оформлен!</h1>
          <p className="text-zinc-500 mb-2">
            Номер заказа: <span className="font-mono font-semibold">{orderId?.slice(0, 8)}</span>
          </p>
          <p className="text-zinc-500 mb-6">
            Мы свяжемся с вами для подтверждения. Оплата наличными при получении.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/account">
              <Button variant="outline">Мои заказы</Button>
            </Link>
            <Link to="/catalog">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                Продолжить покупки
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="checkout-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/cart" 
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад в корзину
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900">
            Оформление заказа
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="full_name" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                ФИО получателя *
              </Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Иванов Иван Иванович"
                className="mt-2 h-12 bg-zinc-50"
                required
                data-testid="checkout-fullname"
              />
            </div>

            <div>
              <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Адрес доставки *
              </Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Город, улица, дом, квартира"
                className="mt-2 h-12 bg-zinc-50"
                required
                data-testid="checkout-address"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Телефон *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+7 (___) ___-__-__"
                className="mt-2 h-12 bg-zinc-50"
                required
                data-testid="checkout-phone"
              />
            </div>

            {/* Payment info */}
            <div className="bg-zinc-50 border border-zinc-200 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Banknote className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-zinc-900">Способ оплаты</span>
              </div>
              <p className="text-zinc-600 text-sm">
                Оплата наличными при получении товара
              </p>
            </div>

            <Button 
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide h-12"
              data-testid="place-order-btn"
            >
              {loading ? 'Оформление...' : 'Подтвердить заказ'}
            </Button>
          </form>

          {/* Order summary */}
          <div className="border border-zinc-200 p-6 h-fit">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
              Ваш заказ
            </h2>

            <div className="space-y-4 mb-6">
              {cart.items.map((item) => (
                <div key={item.product_id} className="flex gap-3 text-sm border-b border-zinc-100 pb-3">
                  <div className="flex-1">
                    {item.manufacturer && (
                      <p className="text-xs font-bold text-orange-600">{item.manufacturer}</p>
                    )}
                    <p className="text-xs font-mono font-semibold text-zinc-500">Арт: {item.article}</p>
                    <p className="text-zinc-900 font-medium">{item.name}</p>
                    <p className="text-zinc-500 text-xs mt-1">{item.quantity} шт. × {formatPrice(item.price)} ₽</p>
                  </div>
                  <span className="font-mono font-semibold whitespace-nowrap">
                    {formatPrice(item.price * item.quantity)} ₽
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-zinc-900">Итого:</span>
                <span className="price-tag text-xl text-zinc-900" data-testid="checkout-total">
                  {formatPrice(cartTotal)} ₽
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Оплата наличными при получении
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
