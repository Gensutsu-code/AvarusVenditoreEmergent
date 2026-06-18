import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Package, ShoppingCart, ArrowRight, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VISIBLE = 6;

export const PopularProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rawIndex, setRawIndex] = useState(0);
  const [animated, setAnimated] = useState(true);
  const [viewportW, setViewportW] = useState(0);
  const viewportRef = useRef(null);
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    fetchPopular();
  }, []);

  const fetchPopular = async () => {
    try {
      const res = await axios.get(`${API}/products/popular?limit=10`);
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

  // Measure viewport width for pixel-accurate carousel translation
  useEffect(() => {
    const measure = () => {
      if (viewportRef.current) {
        setViewportW(viewportRef.current.clientWidth);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Infinite loop: when rawIndex crosses [0, N) bounds, after the animation completes,
  // instantly jump (no animation) to the equivalent position inside [0, N).
  const N = products.length;
  useEffect(() => {
    if (N === 0) return undefined;
    if (rawIndex >= N || rawIndex < 0) {
      const t = setTimeout(() => {
        setAnimated(false);
        setRawIndex((((rawIndex) % N) + N) % N);
      }, 450);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [rawIndex, N]);

  // Re-enable animation right after a silent jump
  useEffect(() => {
    if (!animated) {
      const t = setTimeout(() => setAnimated(true), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [animated]);

  const handlePrev = useCallback(() => {
    setAnimated(true);
    setRawIndex((r) => r - 1);
  }, []);
  const handleNext = useCallback(() => {
    setAnimated(true);
    setRawIndex((r) => r + 1);
  }, []);

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
            to="/catalog?category=assortment"
            className="text-teal-600 hover:text-teal-700 font-semibold text-2xl flex items-center gap-2 transition-colors"
            data-testid="all-products-link"
          >
            Все товары
            <ArrowRight className="w-7 h-7" />
          </Link>
        </motion.div>

        {/* Carousel: 10 products with 6 visible at once and infinite loop */}
        {(() => {
          const cardPx = viewportW > 0 ? viewportW / VISIBLE : 0;
          // Extended list: append first VISIBLE cards to end (for forward wrap continuity)
          // and prepend last VISIBLE cards to start (for backward wrap continuity)
          const head = products.slice(-VISIBLE);
          const tail = products.slice(0, VISIBLE);
          const extended = [...head, ...products, ...tail];
          // rawIndex 0..N-1 maps to "middle" segment. Add VISIBLE offset to skip the head.
          const translateX = -(rawIndex + VISIBLE) * cardPx;

          return (
            <div className="relative" data-testid="popular-carousel">
              <div ref={viewportRef} className="overflow-hidden py-3">
                <motion.div
                  className="flex"
                  animate={{ x: translateX }}
                  transition={animated ? { duration: 0.45, ease: [0.32, 0.72, 0, 1] } : { duration: 0 }}
                >
                  {extended.map((product, i) => (
                    <div
                      key={`${product.id}-${i}`}
                      className="flex-shrink-0 px-2"
                      style={{ width: cardPx ? `${cardPx}px` : `${100 / VISIBLE}%` }}
                    >
                      <Link
                        to={`/product/${product.id}`}
                        className="group block"
                        data-testid={`popular-product-${product.id}`}
                      >
                        <div className="glass-card overflow-hidden hover:border-teal-400/50 hover:-translate-y-1 transition-transform duration-300">
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
                            <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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
                        </div>
                      </Link>
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Arrows — show only if more products than visible */}
              {N > VISIBLE && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Предыдущие популярные"
                    data-testid="popular-prev"
                    className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white text-teal-600 flex items-center justify-center shadow-lg hover:bg-teal-50 hover:scale-105 transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Следующие популярные"
                    data-testid="popular-next"
                    className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white text-teal-600 flex items-center justify-center shadow-lg hover:bg-teal-50 hover:scale-105 transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
