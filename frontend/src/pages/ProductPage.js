import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, ShoppingCart, Truck, ArrowLeft, Minus, Plus, 
  Heart, Share2, ChevronLeft, ChevronRight, Check, AlertCircle,
  Tag, Layers, MapPin
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { FavoritesButton } from '../components/FavoritesButton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { trackClick } from '../utils/tracker';
import DiscountRequestModal from '../components/DiscountRequestModal';
import ProductRequestModal from '../components/ProductRequestModal';
import { computeDiscount, formatDiscountBadge, formatUntilDate } from '../utils/productHelpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useAuth();
  
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [individualPrice, setIndividualPrice] = useState(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProduct();
      fetchRelatedProducts();
    }
  }, [id]);

  // Fetch individual price for this product
  useEffect(() => {
    if (user && id) {
      axios.get(`${API}/individual-prices/my`).then(r => {
        const ip = r.data.find(p => p.product_id === id);
        setIndividualPrice(ip ? ip.price : null);
      }).catch(() => {});
    }
  }, [user, id]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/products/${id}`);
      setProduct(res.data);
    } catch (err) {
      console.error('Failed to fetch product', err);
      toast.error('Товар не найден');
      navigate('/catalog');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedProducts = async () => {
    try {
      const res = await axios.get(`${API}/products/${id}/related?limit=4`);
      setRelatedProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch related products', err);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Войдите для добавления в корзину');
      navigate('/login');
      return;
    }

    trackClick('add_to_cart', '/product');
    setAddingToCart(true);
    const success = await addToCart(product.id, quantity);
    if (success) {
      toast.success(`${product.name} добавлен в корзину (${quantity} шт.)`);
    } else {
      toast.error('Ошибка добавления');
    }
    setAddingToCart(false);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `${product.name} - ${formatPrice(product.price)} ₽`,
          url: url
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Ссылка скопирована');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  const getDeliveryText = (days) => {
    if (!days || days === 0) return 'Сегодня';
    if (days === 1) return '1 день';
    if (days < 5) return `${days} дня`;
    return `${days} дней`;
  };

  const allImages = [];
  if (product?.image_url) allImages.push(product.image_url);
  if (product?.images) {
    product.images.forEach(img => {
      if (img && img !== product.image_url && !allImages.includes(img)) {
        allImages.push(img);
      }
    });
  }
  
  const hasMultipleImages = allImages.length > 1;
  
  const nextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % allImages.length);
  };
  
  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + allImages.length) % allImages.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen" data-testid="product-loading">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-slate-200 rounded mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-slate-200 rounded-2xl"></div>
              <div className="space-y-4">
                <div className="h-6 w-32 bg-slate-200 rounded"></div>
                <div className="h-10 w-full bg-slate-200 rounded"></div>
                <div className="h-24 w-full bg-slate-200 rounded"></div>
                <div className="h-16 w-full bg-slate-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600">Товар не найден</p>
          <Link to="/catalog">
            <Button className="mt-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl">Перейти в каталог</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" data-testid="product-page">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-20 right-20 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-cyan-400/20 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link 
            to="/catalog" 
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 transition-colors"
            data-testid="back-to-catalog"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться в каталог
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="glass-card overflow-hidden relative group">
              <div className="aspect-square relative">
                {allImages.length > 0 ? (
                  <AnimatePresence mode="wait">
                    <motion.img 
                      key={currentImageIndex}
                      src={allImages[currentImageIndex]} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </AnimatePresence>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                    <Package className="w-24 h-24" />
                  </div>
                )}
                
                {hasMultipleImages && (
                  <>
                    <motion.button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white/80 hover:bg-white text-slate-800 shadow-lg"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      data-testid="prev-image"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </motion.button>
                    <motion.button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white/80 hover:bg-white text-slate-800 shadow-lg"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      data-testid="next-image"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </motion.button>
                    
                    <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-lg text-sm font-medium bg-white/80 text-slate-700">
                      {currentImageIndex + 1} / {allImages.length}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {hasMultipleImages && (
              <div className="flex gap-3 overflow-x-auto py-2">
                {allImages.map((img, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                      idx === currentImageIndex 
                        ? 'border-teal-500 shadow-lg shadow-teal-500/20'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Product Details */}
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* Header */}
            <div>
              {product.manufacturer && (
                <motion.p 
                  className="text-sm font-bold uppercase tracking-wider mb-2 text-teal-600"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {product.manufacturer}
                </motion.p>
              )}
              <motion.h1 
                className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-slate-800"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {product.name}
              </motion.h1>
              <motion.div 
                className="flex items-center gap-4 flex-wrap"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  <Tag className="w-4 h-4" />
                  {product.article}
                </span>
                {product.cross_articles && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-500 border border-slate-200">
                    <Layers className="w-4 h-4" />
                    Кросс: {product.cross_articles.split(',').slice(0, 2).join(', ')}{product.cross_articles.split(',').length > 2 && '...'}
                  </span>
                )}
              </motion.div>
            </div>

            {/* Price Card */}
            <motion.div 
              className="glass-card p-6 relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-transparent" />
              
              <div className="relative flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider mb-1 text-slate-500">Цена</p>
                  {individualPrice != null ? (
                    <div>
                      <p className="text-sm line-through text-slate-400 mb-0.5">{formatPrice(product.price)} ₽</p>
                      <p className="text-4xl font-bold text-emerald-600" data-testid="product-price">
                        {formatPrice(individualPrice)} <span className="text-lg text-slate-400">₽</span>
                      </p>
                      <p className="text-xs text-emerald-600 font-semibold mt-1">Ваша индивидуальная цена</p>
                    </div>
                  ) : (() => {
                    const discount = computeDiscount(product);
                    if (discount) {
                      const until = formatUntilDate(discount.until);
                      return (
                        <div>
                          <p className="text-sm line-through text-slate-400 mb-0.5">{formatPrice(product.price)} ₽</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-4xl font-bold text-rose-600" data-testid="product-price">
                              {formatPrice(discount.finalPrice)} <span className="text-lg text-rose-400">₽</span>
                            </p>
                            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-extrabold px-3 py-1 rounded-lg shadow shadow-rose-500/30">
                              {formatDiscountBadge(discount)}
                            </span>
                          </div>
                          {discount.label && (
                            <p className="text-sm font-semibold text-rose-600 mt-1">{discount.label}</p>
                          )}
                          {discount.description && (
                            <p className="text-xs text-slate-500 mt-1">{discount.description}</p>
                          )}
                          {until && (
                            <p className="text-[11px] text-slate-400 mt-1">Акция до {until}</p>
                          )}
                        </div>
                      );
                    }
                    return (
                      <p className="text-4xl font-bold text-teal-600" data-testid="product-price">
                        {formatPrice(product.price)} <span className="text-lg text-slate-400">₽</span>
                      </p>
                    );
                  })()}
                </div>
                
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                  product.stock > 0 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  {product.stock > 0 ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span className="font-semibold">В наличии</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-semibold">Нет в наличии</span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Features */}
            <motion.div 
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="glass-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-teal-500/10">
                  <Truck className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Доставка</p>
                  <p className="font-semibold text-slate-700">{getDeliveryText(product.delivery_days)}</p>
                </div>
              </div>
              
              {product.warehouse && (
                <div className="glass-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Склад</p>
                    <p className="font-semibold text-slate-700">{product.warehouse}</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Description */}
            {product.description && (
              <motion.div 
                className="glass-card p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-slate-400">
                  Описание
                </h3>
                <p className="leading-relaxed text-slate-600">
                  {product.description}
                </p>
              </motion.div>
            )}

            {/* Actions */}
            <motion.div 
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {/* Quantity + Add to cart */}
              <div className="flex items-center gap-4">
                <div className="flex items-center rounded-xl overflow-hidden border bg-white/70 border-slate-200">
                  <motion.button 
                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    className="p-4 transition-colors hover:bg-slate-100 text-slate-600"
                    whileTap={{ scale: 0.9 }}
                    data-testid="qty-minus"
                  >
                    <Minus className="w-5 h-5" />
                  </motion.button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setQuantity(Math.max(1, val));
                    }}
                    className="w-16 text-center font-bold text-lg text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    data-testid="qty-value"
                  />
                  <motion.button 
                    onClick={() => setQuantity(prev => prev + 1)}
                    className="p-4 transition-colors hover:bg-slate-100 text-slate-600"
                    whileTap={{ scale: 0.9 }}
                    data-testid="qty-plus"
                  >
                    <Plus className="w-5 h-5" />
                  </motion.button>
                </div>

                <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {product.stock > 0 ? (
                    <Button
                      onClick={handleAddToCart}
                      disabled={addingToCart}
                      className="w-full h-14 font-bold uppercase tracking-wide text-base rounded-xl shadow-lg transition-all duration-300 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-teal-500/30 text-white"
                      data-testid="add-to-cart"
                    >
                      {addingToCart ? (
                        <motion.div 
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                      ) : (
                        <>
                          <ShoppingCart className="w-5 h-5 mr-2" />
                          В корзину
                        </>
                      )}
                    </Button>
                  ) : user ? (
                    <Button
                      onClick={() => setRequestOpen(true)}
                      className="w-full h-14 font-bold uppercase tracking-wide text-base rounded-xl shadow-lg transition-all duration-300 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                      data-testid="request-out-of-stock-btn"
                    >
                      <Package className="w-5 h-5 mr-2" />
                      Запросить товар
                    </Button>
                  ) : (
                    <Button
                      disabled
                      className="w-full h-14 font-bold uppercase tracking-wide text-base rounded-xl opacity-50"
                      data-testid="add-to-cart"
                    >
                      Нет в наличии
                    </Button>
                  )}
                </motion.div>
              </div>

              {/* Secondary actions */}
              <div className="flex gap-3">
                <FavoritesButton productId={product.id} size="lg" className="flex-1" showText />
                
                {user && !individualPrice && (
                  <motion.button
                    onClick={() => setDiscountOpen(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 text-rose-600 hover:from-rose-100 hover:to-pink-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    data-testid="request-discount-btn"
                  >
                    <Tag className="w-5 h-5" />
                    Запросить скидку
                  </motion.button>
                )}
                
                <motion.button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 bg-white/50 border border-slate-200 text-slate-600 hover:bg-white/80"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid="share-button"
                >
                  <Share2 className="w-5 h-5" />
                  Поделиться
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <motion.section 
            className="mt-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mb-6 text-slate-800">
              С этим товаром покупают
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((related, index) => (
                <motion.div
                  key={related.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Link 
                    to={`/product/${related.id}`}
                    className="block group"
                    data-testid={`related-product-${related.id}`}
                  >
                    <motion.div 
                      className="glass-card overflow-hidden hover:border-teal-400/50"
                      whileHover={{ scale: 1.02, y: -4 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="aspect-square overflow-hidden relative bg-slate-100">
                        {related.image_url ? (
                          <img 
                            src={related.image_url} 
                            alt={related.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Package className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      
                      <div className="p-4">
                        {related.manufacturer && (
                          <p className="text-xs font-bold uppercase tracking-wider mb-1 text-teal-600">
                            {related.manufacturer}
                          </p>
                        )}
                        <p className="text-xs font-mono mb-1 text-slate-500">
                          {related.article}
                        </p>
                        <h3 className="font-semibold mb-2 line-clamp-2 transition-colors duration-300 text-slate-800 group-hover:text-teal-600">
                          {related.name}
                        </h3>
                        <p className="text-lg font-bold text-teal-600">
                          {formatPrice(related.price)} <span className="text-sm text-slate-400">₽</span>
                        </p>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </div>

      {/* Discount Request Modal */}
      <DiscountRequestModal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        product={product}
      />

      {/* Product Request Modal (out of stock) */}
      <ProductRequestModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        product={product}
      />
    </div>
  );
}
