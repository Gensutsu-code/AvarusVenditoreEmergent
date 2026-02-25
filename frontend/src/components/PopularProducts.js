import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Package, ShoppingCart, ArrowRight, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

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
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-slate-200 mb-6 rounded-xl"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-square bg-slate-200 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="py-12" data-testid="popular-products">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-slate-800">
              Популярные товары
            </h2>
          </div>
          <Link 
            to="/catalog"
            className="text-teal-600 hover:text-teal-700 font-semibold text-sm flex items-center gap-1 transition-colors"
          >
            Все товары
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Link
                to={`/product/${product.id}`}
                className="group block"
                data-testid={`popular-product-${product.id}`}
              >
                <motion.div 
                  className="glass-card overflow-hidden hover:border-teal-400/50"
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Image */}
                  <div className="aspect-square bg-slate-100 overflow-hidden relative">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Package className="w-10 h-10" />
                      </div>
                    )}
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Quick add button */}
                    <motion.div
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Button
                        size="sm"
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={product.stock === 0}
                        className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 p-2 h-8 w-8 rounded-xl shadow-lg shadow-teal-500/30"
                        data-testid={`add-popular-${product.id}`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    {product.manufacturer && (
                      <p className="text-xs font-bold text-teal-600 mb-0.5">{product.manufacturer}</p>
                    )}
                    <p className="text-[10px] font-mono font-semibold text-slate-500 mb-1">Арт: {product.article}</p>
                    <h3 className="text-sm font-medium text-slate-800 line-clamp-2 mb-2 min-h-[40px] group-hover:text-teal-600 transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-teal-600">
                        {formatPrice(product.price)} <span className="text-xs text-slate-400">₽</span>
                      </span>
                    </div>
                    {product.stock === 0 && (
                      <p className="text-xs text-red-500 mt-1">Нет в наличии</p>
                    )}
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
