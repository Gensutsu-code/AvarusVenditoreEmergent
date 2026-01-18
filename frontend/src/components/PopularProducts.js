import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Package, ShoppingCart, ArrowRight, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const PopularProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    fetchPopular();
  }, []);

  const fetchPopular = async () => {
    try {
      const res = await axios.get(`${API}/products/popular?limit=6`);
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch popular products', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error('Войдите для добавления в корзину');
      return;
    }

    const success = await addToCart(product.id, 1);
    if (success) {
      toast.success(`${product.name} добавлен в корзину`);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  if (loading) {
    return (
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-zinc-200 mb-6 rounded"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-zinc-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="py-12 bg-white" data-testid="popular-products">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-zinc-900">
              Популярные товары
            </h2>
          </div>
          <Link 
            to="/catalog"
            className="text-orange-500 hover:text-orange-600 font-semibold text-sm flex items-center gap-1"
          >
            Все товары
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {products.map((product) => (
            <Link
              key={product.id}
              to={`/catalog?search=${encodeURIComponent(product.article)}`}
              className="group border border-zinc-200 bg-white hover:border-zinc-400 transition-colors overflow-hidden"
              data-testid={`popular-product-${product.id}`}
            >
              {/* Image */}
              <div className="aspect-square bg-zinc-100 overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300">
                    <Package className="w-10 h-10" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                {product.manufacturer && (
                  <p className="text-xs font-bold text-orange-600 mb-0.5">{product.manufacturer}</p>
                )}
                <p className="text-[10px] font-mono font-semibold text-zinc-500 mb-1">Арт: {product.article}</p>
                <h3 className="text-sm font-medium text-zinc-900 line-clamp-2 mb-2 min-h-[40px] group-hover:text-orange-500 transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-900">
                    {formatPrice(product.price)} ₽
                  </span>
                  <Button
                    size="sm"
                    onClick={(e) => handleAddToCart(e, product)}
                    disabled={product.stock === 0}
                    className="bg-orange-500 hover:bg-orange-600 p-2 h-8 w-8"
                    data-testid={`add-popular-${product.id}`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </Button>
                </div>
                {product.stock === 0 && (
                  <p className="text-xs text-red-500 mt-1">Нет в наличии</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
