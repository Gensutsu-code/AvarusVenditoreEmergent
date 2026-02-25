import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Heart, Package, ShoppingCart, Trash2, Minus, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchFavorites();
  }, [user, authLoading, navigate]);

  const fetchFavorites = async () => {
    try {
      const res = await axios.get(`${API}/favorites`);
      setFavorites(res.data.items || []);
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

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));

  if (!user) return null;

  return (
    <div className="min-h-screen relative" data-testid="favorites-page">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-20 right-20 w-96 h-96 rounded-full bg-pink-400/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-red-400/20 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          className="flex items-center gap-4 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link 
            to="/catalog"
            className="p-2 rounded-xl bg-white/50 backdrop-blur-sm border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center shadow-lg shadow-red-500/30">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
                Избранное
              </h1>
              <p className="text-sm text-slate-500">
                {favorites.length > 0 ? `${favorites.length} товаров` : 'Пока пусто'}
              </p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500">Загрузка...</p>
          </div>
        ) : favorites.length === 0 ? (
          <motion.div 
            className="text-center py-16 glass-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            data-testid="no-favorites"
          >
            <Heart className="w-20 h-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-6">У вас пока нет избранных товаров</p>
            <Link to="/catalog">
              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/30 rounded-xl">
                Перейти в каталог
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4" data-testid="favorites-list">
            <AnimatePresence>
              {favorites.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="glass-card overflow-hidden group"
                  data-testid={`favorite-card-${product.id}`}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Image */}
                    <Link
                      to={`/product/${product.id}`}
                      className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 group-hover:shadow-lg transition-shadow"
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package className="w-8 h-8" />
                        </div>
                      )}
                    </Link>

                    {/* Info */}
                    <Link
                      to={`/product/${product.id}`}
                      className="flex-1 min-w-0"
                    >
                      {product.manufacturer && (
                        <p className="text-sm font-bold text-teal-600 mb-0.5">{product.manufacturer}</p>
                      )}
                      <p className="text-xs font-mono font-semibold text-slate-500 mb-1">Арт: {product.article}</p>
                      <h3 className="font-semibold text-slate-800 hover:text-teal-600 transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                    </Link>

                    {/* Stock */}
                    <div className="hidden sm:block text-center min-w-[80px]">
                      <p className={`text-sm font-semibold ${product.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {product.stock > 0 ? `${product.stock} шт.` : 'Нет'}
                      </p>
                      <p className="text-xs text-slate-400">в наличии</p>
                    </div>

                    {/* Price */}
                    <div className="text-right min-w-[120px]">
                      <span className="text-xl font-bold text-teal-600">{formatPrice(product.price)}</span>
                      <span className="text-slate-400 ml-1">₽</span>
                    </div>

                    {/* Quantity + Actions */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 bg-white/50">
                        <motion.button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="p-2.5 hover:bg-slate-100 text-slate-500 transition-colors"
                          whileTap={{ scale: 0.9 }}
                        >
                          <Minus className="w-4 h-4" />
                        </motion.button>
                        <span className="px-3 min-w-[40px] text-center text-sm font-bold text-slate-800">
                          {quantities[product.id] || 1}
                        </span>
                        <motion.button
                          onClick={() => updateQuantity(product.id, 1)}
                          className="p-2.5 hover:bg-slate-100 text-slate-500 transition-colors"
                          whileTap={{ scale: 0.9 }}
                        >
                          <Plus className="w-4 h-4" />
                        </motion.button>
                      </div>

                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          onClick={() => handleAddToCart(product)}
                          disabled={product.stock === 0}
                          className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl shadow-lg shadow-teal-500/30"
                          data-testid={`add-to-cart-${product.id}`}
                        >
                          <ShoppingCart className="w-5 h-5" />
                        </Button>
                      </motion.div>

                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button
                          variant="ghost"
                          onClick={() => removeFromFavorites(product.id)}
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl"
                          data-testid={`remove-favorite-${product.id}`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
