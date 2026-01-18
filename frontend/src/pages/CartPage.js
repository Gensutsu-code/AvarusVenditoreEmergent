import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowLeft, ShoppingCart } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, cartTotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="cart-login-required">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Корзина</h1>
          <p className="text-zinc-500 mb-6">Войдите, чтобы увидеть корзину</p>
          <Link to="/login">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase">
              Войти
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="cart-empty">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Корзина пуста</h1>
          <p className="text-zinc-500 mb-6">Добавьте товары из каталога</p>
          <Link to="/catalog">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase">
              Перейти в каталог
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="cart-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/catalog" 
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Продолжить покупки
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900">
            Корзина
          </h1>
        </div>

        {/* Items */}
        <div className="border border-zinc-200 divide-y divide-zinc-200">
          {cart.items.map((item) => (
            <div 
              key={item.product_id} 
              className="p-4 flex gap-4"
              data-testid={`cart-item-${item.product_id}`}
            >
              {/* Image */}
              <div className="w-20 h-20 bg-zinc-100 flex-shrink-0">
                {item.image_url ? (
                  <img 
                    src={item.image_url} 
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {item.manufacturer && (
                  <p className="text-sm font-bold text-orange-600">{item.manufacturer}</p>
                )}
                <p className="text-sm font-mono font-semibold text-zinc-600">Арт: {item.article}</p>
                <Link 
                  to={`/product/${item.product_id}`}
                  className="font-semibold text-zinc-900 hover:text-orange-500 transition-colors line-clamp-1"
                >
                  {item.name}
                </Link>
                <p className="price-tag text-zinc-900 mt-1">
                  {formatPrice(item.price)} ₽
                </p>
              </div>

              {/* Quantity */}
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-zinc-200">
                  <button 
                    onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                    className="px-3 py-1 text-sm hover:bg-zinc-100"
                    data-testid={`decrease-${item.product_id}`}
                  >
                    −
                  </button>
                  <span className="px-3 py-1 min-w-[40px] text-center text-sm font-semibold">
                    {item.quantity}
                  </span>
                  <button 
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    className="px-3 py-1 text-sm hover:bg-zinc-100"
                    data-testid={`increase-${item.product_id}`}
                  >
                    +
                  </button>
                </div>

                <button 
                  onClick={() => removeFromCart(item.product_id)}
                  className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                  data-testid={`remove-${item.product_id}`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <span className="text-lg font-semibold text-zinc-900">Итого:</span>
            <span className="price-tag text-2xl text-zinc-900" data-testid="cart-total">
              {formatPrice(cartTotal)} ₽
            </span>
          </div>

          <Button 
            onClick={() => navigate('/checkout')}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide h-12"
            data-testid="checkout-btn"
          >
            Оформить заказ
          </Button>
        </div>
      </div>
    </div>
  );
}
