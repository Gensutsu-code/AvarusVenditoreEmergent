import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Heart, Package, ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FavoritesPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchFavorites();
  }, [user, navigate]);

  const fetchFavorites = async () => {
    try {
      const res = await axios.get(`${API}/favorites`);
      setFavorites(res.data.items || []);
      // Initialize quantities
      const q = {};
      (res.data.items || []).forEach(p => q[p.id] = 1);
      setQuantities(q);
    } catch (err) {
      console.error('Failed to fetch favorites', err);
    } finally {
      setLoading(false);
    }
  };

  const removeFromFavorites = async (productId) => {
    try {
      await axios.delete(`${API}/favorites/${productId}`);
      setFavorites(favorites.filter(f => f.id !== productId));
      toast.success('Удалено из избранного');
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const handleAddToCart = async (product) => {
    const qty = quantities[product.id] || 1;
    const success = await addToCart(product.id, qty);
    if (success) {
      toast.success(`${product.name} добавлен в корзину (${qty} шт.)`);
    }
  };

  const updateQuantity = (productId, delta) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta)
    }));
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen" data-testid="favorites-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Heart className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900">
            Избранное
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-500">Загрузка...</div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16 border border-zinc-200 bg-white" data-testid="no-favorites">
            <Heart className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 text-lg mb-4">У вас пока нет избранных товаров</p>
            <Link to="/catalog">
              <Button className="bg-orange-500 hover:bg-orange-600">
                Перейти в каталог
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-500 mb-4">
              В избранном: {favorites.length} {favorites.length === 1 ? 'товар' : favorites.length < 5 ? 'товара' : 'товаров'}
            </p>

            <div className="space-y-3" data-testid="favorites-list">
              {favorites.map((product) => (
                <div
                  key={product.id}
                  className="border border-zinc-200 bg-white hover:border-zinc-300 transition-colors"
                  data-testid={`favorite-card-${product.id}`}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Image */}
                    <Link
                      to={`/catalog?search=${encodeURIComponent(product.article)}`}
                      className="w-20 h-20 flex-shrink-0 bg-zinc-100 overflow-hidden hover:opacity-80 transition-opacity"
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300">
                          <Package className="w-8 h-8" />
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <Link
                      to={`/catalog?search=${encodeURIComponent(product.article)}`}
                      className="flex-1 min-w-0"
                    >
                      {product.manufacturer && (
                        <p className="text-sm font-bold text-orange-600 mb-0.5">{product.manufacturer}</p>
                      )}
                      <p className="text-sm font-mono font-semibold text-zinc-600 mb-1">Арт: {product.article}</p>
                      <h3 className="font-semibold text-zinc-900 hover:text-orange-500 transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                    </Link>

                    {/* Stock */}
                    <div className="hidden sm:block text-center min-w-[80px]">
                      <p className={`text-sm font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {product.stock > 0 ? `${product.stock} шт.` : 'Нет'}
                      </p>
                      <p className="text-xs text-zinc-400">в наличии</p>
                    </div>

                    {/* Price */}
                    <div className="text-right min-w-[100px]">
                      <span className="price-tag text-lg text-zinc-900">
                        {formatPrice(product.price)} ₽
                      </span>
                    </div>

                    {/* Quantity + Actions */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-zinc-200">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="p-2 hover:bg-zinc-100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3 min-w-[40px] text-center text-sm font-semibold">
                          {quantities[product.id] || 1}
                        </span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          className="p-2 hover:bg-zinc-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <Button
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock === 0}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        data-testid={`add-to-cart-${product.id}`}
                      >
                        <ShoppingCart className="w-5 h-5" />
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={() => removeFromFavorites(product.id)}
                        className="text-zinc-400 hover:text-red-500"
                        data-testid={`remove-favorite-${product.id}`}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
