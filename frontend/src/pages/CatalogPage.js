import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Search, X, ShoppingCart, Package, Truck, Minus, Plus, ArrowRight, Heart, ChevronLeft, ChevronRight, Percent, Eye } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { FavoritesButton } from '../components/FavoritesButton';
import { RelatedProducts } from '../components/RelatedProducts';
import { PopularProducts } from '../components/PopularProducts';
import { motion } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Simple price display component
const PriceDisplay = ({ price, formatPrice }) => {
  return <span className="text-xl font-bold text-teal-600">{formatPrice(price)} ₽</span>;
};

// ProductCard component for reuse
const ProductCard = ({ 
  product, 
  quantities, 
  updateQuantity, 
  handleAddToCart,
  setSelectedProduct, 
  formatPrice, 
  getDeliveryText,
  isAlternative = false
}) => (
  <div 
    className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:border-teal-500/30 ${isAlternative ? 'border-teal-500/20' : ''}`}
    data-testid={`product-card-${product.id}`}
  >
    <div className="flex items-center gap-4 p-4">
      {/* Image - clickable */}
      <div className="relative group">
        <Link
          to={`/product/${product.id}`}
          className="w-24 h-24 flex-shrink-0 bg-slate-100 rounded-xl overflow-hidden block"
          data-testid={`product-image-${product.id}`}
        >
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Package className="w-8 h-8" />
            </div>
          )}
        </Link>
        {/* Quick View button */}
        <button
          onClick={() => setSelectedProduct(product)}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
          data-testid={`quick-view-${product.id}`}
        >
          <Eye className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Info - clickable */}
      <Link
        to={`/product/${product.id}`}
        className="flex-1 text-left min-w-0"
      >
        {product.manufacturer && (
          <p className="text-sm font-bold text-teal-600 mb-0.5">{product.manufacturer}</p>
        )}
        <p className="text-sm font-mono font-semibold text-slate-500 mb-1">Арт: {product.article}</p>
        <h3 className="font-semibold text-slate-800 hover:text-teal-600 transition-colors line-clamp-1">
          {product.name}
        </h3>
        {isAlternative && product.cross_articles && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
            Кросс: {product.cross_articles}
          </p>
        )}
      </Link>

      {/* Stock */}
      <div className="hidden sm:block text-center min-w-[80px]">
        <p className={`text-sm font-semibold ${product.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {product.stock > 0 ? `${product.stock} шт.` : 'Нет'}
        </p>
        <p className="text-xs text-slate-400">в наличии</p>
      </div>

      {/* Delivery */}
      <div className="hidden md:flex items-center gap-2 text-slate-500 min-w-[100px]">
        <Truck className="w-4 h-4" />
        <span className="text-sm">{getDeliveryText(product.delivery_days || 3)}</span>
      </div>

      {/* Price */}
      <div className="text-right min-w-[120px]">
        <PriceDisplay 
          price={product.price} 
          formatPrice={formatPrice} 
        />
      </div>

      {/* Quantity + Cart */}
      <div className="flex items-center gap-2">
        <FavoritesButton productId={product.id} size="sm" />
        
        <div className="flex items-center border border-slate-200 rounded-xl bg-white/50">
          <button 
            onClick={() => updateQuantity(product.id, -1)}
            className="p-2 hover:bg-slate-100 rounded-l-xl transition-colors"
            data-testid={`qty-minus-${product.id}`}
          >
            <Minus className="w-4 h-4 text-slate-600" />
          </button>
          <span className="px-3 min-w-[40px] text-center text-sm font-semibold text-slate-800">
            {quantities[product.id] || 1}
          </span>
          <button 
            onClick={() => updateQuantity(product.id, 1)}
            className="p-2 hover:bg-slate-100 rounded-r-xl transition-colors"
            data-testid={`qty-plus-${product.id}`}
          >
            <Plus className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <Button
          onClick={() => handleAddToCart(product)}
          disabled={product.stock === 0}
          className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl shadow-lg shadow-teal-500/30"
          data-testid={`add-to-cart-${product.id}`}
        >
          <ShoppingCart className="w-5 h-5" />
        </Button>
      </div>
    </div>

    {/* Mobile info */}
    <div className="sm:hidden flex items-center justify-between px-4 pb-4 text-sm">
      <span className={product.stock > 0 ? 'text-emerald-600' : 'text-red-500'}>
        {product.stock > 0 ? `В наличии: ${product.stock} шт.` : 'Нет в наличии'}
      </span>
      <span className="text-slate-500 flex items-center gap-1">
        <Truck className="w-4 h-4" />
        {getDeliveryText(product.delivery_days || 3)}
      </span>
    </div>
  </div>
);

// Product Modal Content with Image Slideshow
const ProductModalContent = ({ 
  product, 
  quantities, 
  updateQuantity, 
  handleAddToCart, 
  formatPrice, 
  getDeliveryText
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Combine main image with additional images
  const allImages = [];
  if (product.image_url) allImages.push(product.image_url);
  if (product.images) {
    product.images.forEach(img => {
      if (img !== product.image_url && !allImages.includes(img)) {
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
  
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-slate-800">{product.name}</DialogTitle>
      </DialogHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Image Gallery with Slideshow */}
        <div className="space-y-2">
          <div className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden group">
            {allImages.length > 0 ? (
              <>
                <img 
                  src={allImages[currentImageIndex]} 
                  alt={product.name}
                  className="w-full h-full object-cover transition-opacity"
                />
                
                {/* Navigation arrows */}
                {hasMultipleImages && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      data-testid="prev-image"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      data-testid="next-image"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    
                    {/* Image counter */}
                    <div className="absolute bottom-2 right-2 bg-white/80 text-slate-700 text-xs px-2 py-1 rounded-lg">
                      {currentImageIndex + 1} / {allImages.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Package className="w-16 h-16" />
              </div>
            )}
          </div>
          
          {/* Thumbnail strip */}
          {hasMultipleImages && (
            <div className="flex gap-2 overflow-x-auto py-1">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 border-2 rounded-lg overflow-hidden transition-colors ${
                    idx === currentImageIndex ? 'border-teal-500' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {/* Manufacturer and Article */}
          <div className="space-y-1">
            {product.manufacturer && (
              <p className="text-base font-bold text-teal-600">
                {product.manufacturer}
              </p>
            )}
            <p className="text-base font-mono font-semibold text-slate-600">
              Артикул: {product.article}
            </p>
          </div>

          {product.description && (
            <p className="text-slate-600">
              {product.description}
            </p>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Наличие:</span>
              <span className={product.stock > 0 ? 'text-emerald-600 font-semibold' : 'text-red-500'}>
                {product.stock > 0 ? `${product.stock} шт.` : 'Нет в наличии'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Доставка:</span>
              <span className="flex items-center gap-1 text-slate-600">
                <Truck className="w-4 h-4" />
                {getDeliveryText(product.delivery_days || 3)}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
            <PriceDisplay 
              price={product.price} 
              formatPrice={formatPrice} 
            />
            <FavoritesButton productId={product.id} />
          </div>

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white/50 rounded-xl overflow-hidden border border-slate-200">
              <button 
                onClick={() => updateQuantity(product.id, -1)}
                className="p-3 hover:bg-slate-100 transition-colors text-slate-600"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 min-w-[50px] text-center font-semibold text-slate-800">
                {quantities[product.id] || 1}
              </span>
              <button 
                onClick={() => updateQuantity(product.id, 1)}
                className="p-3 hover:bg-slate-100 transition-colors text-slate-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <Button
              onClick={() => handleAddToCart(product)}
              disabled={product.stock === 0}
              className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold uppercase h-12 rounded-xl shadow-lg shadow-teal-500/30 transition-all duration-300"
              data-testid="modal-add-to-cart"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              В корзину
            </Button>
          </div>

          {/* Related Products */}
          <RelatedProducts 
            productId={product.id} 
            onSelectProduct={(p) => {
              // This won't work in the same way, but will at least not crash
              window.location.href = `/catalog?search=${p.article}`;
            }}
          />
        </div>
      </div>
    </>
  );
};

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantities, setQuantities] = useState({});
  
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const searchQuery = searchParams.get('search');
  const categoryId = searchParams.get('category');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (searchQuery || categoryId) {
      fetchProducts();
    } else {
      setProducts([]);
      setAlternatives([]);
    }
  }, [searchQuery, categoryId]);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/categories`);
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // If searching by text, use the advanced search endpoint
      if (searchQuery && !categoryId) {
        const res = await axios.get(`${API}/products/search-with-alternatives?search=${encodeURIComponent(searchQuery)}`);
        setProducts(res.data.exact || []);
        setAlternatives(res.data.alternatives || []);
        // Initialize quantities for all products
        const q = {};
        [...(res.data.exact || []), ...(res.data.alternatives || [])].forEach(p => q[p.id] = 1);
        setQuantities(q);
      } else {
        // Regular search for category browsing
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (categoryId) params.append('category_id', categoryId);
        
        const res = await axios.get(`${API}/products?${params.toString()}`);
        setProducts(res.data);
        setAlternatives([]);
        // Initialize quantities
        const q = {};
        res.data.forEach(p => q[p.id] = 1);
        setQuantities(q);
      }
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const params = new URLSearchParams();
      params.set('search', searchInput.trim());
      setSearchParams(params);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({});
    setProducts([]);
    setAlternatives([]);
  };

  const selectCategory = (catId) => {
    const params = new URLSearchParams();
    params.set('category', catId);
    setSearchParams(params);
  };

  const handleAddToCart = async (product) => {
    if (!user) {
      toast.error('Войдите для добавления в корзину');
      navigate('/login');
      return;
    }

    const qty = quantities[product.id] || 1;
    const success = await addToCart(product.id, qty);
    if (success) {
      toast.success(`${product.name} добавлен в корзину (${qty} шт.)`);
    } else {
      toast.error('Ошибка добавления');
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

  const getDeliveryText = (days) => {
    if (days === 1) return '1 день';
    if (days < 5) return `${days} дня`;
    return `${days} дней`;
  };

  const currentCategory = categories.find(c => c.id === categoryId);

  return (
    <div className="min-h-screen" data-testid="catalog-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase mb-6 text-slate-800">
            {currentCategory ? currentCategory.name : 'Поиск запчастей'}
          </h1>
          
          {/* Search form */}
          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Введите название или артикул..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pr-10 h-12 rounded-xl bg-white/70 border-cyan-200/50 text-slate-800 placeholder:text-slate-400 focus:border-teal-400"
                data-testid="catalog-search-input"
              />
              {searchInput && (
                <button 
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <Button 
              type="submit"
              className="font-bold uppercase h-12 px-6 rounded-xl shadow-lg transition-all duration-300 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-teal-500/30 text-white"
              data-testid="catalog-search-btn"
            >
              <Search className="w-5 h-5 mr-2" />
              Найти
            </Button>
          </form>

          {/* Active filters */}
          {(searchQuery || categoryId) && (
            <div className="flex items-center gap-2 mt-4">
              {searchQuery && (
                <span className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm bg-white/60 border border-cyan-200/50 text-slate-600">
                  Поиск: &quot;{searchQuery}&quot;
                  <button onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete('search');
                    setSearchParams(params);
                    setSearchInput('');
                  }} className="hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )}
              {categoryId && currentCategory && (
                <span className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm bg-white/60 border border-cyan-200/50 text-slate-600">
                  {currentCategory.name}
                  <button onClick={clearFilters} className="hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Categories - show when no search/category selected */}
        {!searchQuery && !categoryId && categories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-slate-800">Категории</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {categories.map((category) => (
                <motion.button
                  key={category.id}
                  onClick={() => selectCategory(category.id)}
                  className="group glass-card transition-all duration-300 p-3 text-left hover:border-teal-400/50"
                  data-testid={`category-${category.id}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {category.image_url && (
                    <div className="aspect-square mb-2 overflow-hidden rounded-lg bg-slate-100">
                      <img 
                        src={category.image_url} 
                        alt={category.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <h3 className="font-medium text-sm transition-colors flex items-center justify-between text-slate-800 group-hover:text-teal-600">
                    {category.name}
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {!searchQuery && !categoryId ? (
          <div data-testid="search-prompt">
            <div className="text-center py-8 mb-8">
              <Search className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500">
                Введите название или артикул, либо выберите категорию
              </p>
            </div>
            
            {/* Popular Products */}
            <PopularProducts />
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-slate-500" data-testid="loading">
            <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-4 border-teal-500/30 border-t-teal-500"></div>
            Загрузка...
          </div>
        ) : products.length === 0 && alternatives.length === 0 ? (
          <div className="text-center py-12" data-testid="no-products">
            <p className="mb-4 text-slate-500">Товары не найдены</p>
            <Button onClick={clearFilters} variant="outline" className="rounded-xl border-slate-300 text-slate-600 hover:bg-slate-100">
              Сбросить фильтры
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Exact matches section */}
            {products.length > 0 && (
              <div>
                {alternatives.length > 0 && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Точное совпадение ({products.length})
                    </h2>
                  </div>
                )}
                {!alternatives.length && (
                  <p className="text-sm text-slate-500 mb-4">
                    Найдено: {products.length} {products.length === 1 ? 'товар' : products.length < 5 ? 'товара' : 'товаров'}
                  </p>
                )}
                
                {/* Products List */}
                <div className="space-y-3" data-testid="products-list">
                  {products.map((product) => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      quantities={quantities}
                      updateQuantity={updateQuantity}
                      handleAddToCart={handleAddToCart}
                      setSelectedProduct={setSelectedProduct}
                      formatPrice={formatPrice}
                      getDeliveryText={getDeliveryText}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Alternatives section */}
            {alternatives.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-6 bg-teal-500"></div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Возможные замены ({alternatives.length})
                  </h2>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  Товары, у которых артикул &quot;{searchQuery}&quot; указан в кросс-номерах
                </p>
                
                {/* Alternatives List */}
                <div className="space-y-3" data-testid="alternatives-list">
                  {alternatives.map((product) => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      quantities={quantities}
                      updateQuantity={updateQuantity}
                      handleAddToCart={handleAddToCart}
                      setSelectedProduct={setSelectedProduct}
                      formatPrice={formatPrice}
                      getDeliveryText={getDeliveryText}
                      isAlternative={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl" data-testid="product-modal">
          {selectedProduct && (
            <ProductModalContent 
              product={selectedProduct}
              quantities={quantities}
              updateQuantity={updateQuantity}
              handleAddToCart={handleAddToCart}
              formatPrice={formatPrice}
              getDeliveryText={getDeliveryText}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
