import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle } from 'lucide-react';
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [form, setForm] = useState({
    address: '',
    phone: user?.phone || '',
    comment: ''
  });

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.address.trim() || !form.phone.trim()) {
      toast.error('Заполните обязательные поля');
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
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Заказ оформлен!</h1>
          <p className="text-zinc-500 mb-2">
            Номер заказа: <span className="font-mono font-semibold">{orderId?.slice(0, 8)}</span>
          </p>
          <p className="text-zinc-500 mb-6">
            Мы свяжемся с вами для подтверждения
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

            <div>
              <Label htmlFor="comment" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Комментарий
              </Label>
              <Textarea
                id="comment"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Дополнительная информация к заказу"
                className="mt-2 bg-zinc-50 min-h-[100px]"
                data-testid="checkout-comment"
              />
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
                <div key={item.product_id} className="flex justify-between text-sm">
                  <span className="text-zinc-600">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-mono font-semibold">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
