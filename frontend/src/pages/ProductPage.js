import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ShoppingCart, ArrowLeft, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_NAMES = {
  engine: 'Двигатель и комплектующие',
  transmission: 'Трансмиссия',
  brakes: 'Тормозная система',
  electric: 'Электрика',
  suspension: 'Подвеска',
  body: 'Кузовные детали'
};

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await axios.get(`${API}/products/${id}`);
      setProduct(res.data);
    } catch (err) {
      console.error('Failed to fetch product', err);
      navigate('/catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Войдите для добавления в корзину');
      navigate('/login');
      return;
    }

    const success = await addToCart(product.id, quantity);
    if (success) {
      toast.success('Добавлено в корзину');
    } else {
      toast.error('Ошибка добавления');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading">
        <div className="text-zinc-500">Загрузка...</div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="min-h-screen" data-testid="product-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <Link 
            to="/catalog" 
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors"
            data-testid="back-to-catalog"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад в каталог
          </Link>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image */}
          <div className="aspect-square bg-zinc-100 border border-zinc-200">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-300">
                <Package className="w-24 h-24" />
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {/* Category */}
            <Link 
              to={`/catalog?category=${product.category}`}
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-orange-500 transition-colors"
            >
              {CATEGORY_NAMES[product.category]}
            </Link>

            {/* Article */}
            <p className="text-sm font-mono text-zinc-400 mt-2" data-testid="product-article">
              Артикул: {product.article}
            </p>

            {/* Name */}
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 mt-2" data-testid="product-name">
              {product.name}
            </h1>

            {/* Description */}
            {product.description && (
              <p className="text-zinc-600 mt-4" data-testid="product-description">
                {product.description}
              </p>
            )}

            {/* Stock */}
            <p className={`mt-4 text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {product.stock > 0 ? `В наличии: ${product.stock} шт.` : 'Нет в наличии'}
            </p>

            {/* Price */}
            <div className="mt-6 pt-6 border-t border-zinc-200">
              <span className="price-tag text-3xl text-zinc-900" data-testid="product-price">
                {formatPrice(product.price)} ₽
              </span>
            </div>

            {/* Add to cart */}
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center border border-zinc-200">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 text-lg font-bold hover:bg-zinc-100"
                  data-testid="quantity-decrease"
                >
                  −
                </button>
                <span className="px-4 py-2 min-w-[60px] text-center font-semibold" data-testid="quantity-value">
                  {quantity}
                </span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 text-lg font-bold hover:bg-zinc-100"
                  data-testid="quantity-increase"
                >
                  +
                </button>
              </div>

              <Button 
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide h-12"
                data-testid="add-to-cart-btn"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                В корзину
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
