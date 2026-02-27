import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Search, X, ShoppingCart, Package, Truck, Minus, Plus, ArrowRight, Heart, ChevronLeft, ChevronRight, Percent, Eye, Filter, MapPin } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { FavoritesButton } from '../components/FavoritesButton';
import { RelatedProducts } from '../components/RelatedProducts';
import { PopularProducts } from '../components/PopularProducts';
import { motion } from 'framer-motion';
import { SearchDropdown } from '../components/SearchDropdown';

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
    className={`bg-white rounded-xl border overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-teal-300/60 h-[100px] ${isAlternative ? 'border-teal-200/50 bg-teal-50/20' : 'border-slate-200/80'}`}
    data-testid={`product-card-${product.id}`}
  >
    <div className="flex h-full">
      {/* Image */}
      <div className="relative group flex-shrink-0 p-2 flex items-center">
        <Link
          to={`/product/${product.id}`}
          className="w-[70px] h-[70px] bg-slate-50 block overflow-hidden rounded-lg border-2 border-teal-400 shadow-sm"
          data-testid={`product-image-${product.id}`}
        >
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Package className="w-5 h-5" />
            </div>
          )}
        </Link>
        <button
          onClick={() => setSelectedProduct(product)}
          className="absolute inset-0 m-2 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
          data-testid={`quick-view-${product.id}`}
        >
          <Eye className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-2 pr-3 flex flex-col">
        {/* Top: name - fills available space */}
        <div className="flex-1 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50/50 mb-1.5">
          <h3 className="font-semibold text-[13px] leading-tight text-slate-800 hover:text-teal-600 transition-colors line-clamp-2 overflow-hidden">
            <Link to={`/product/${product.id}`}>{product.name}</Link>
          </h3>
        </div>
        
        {/* Bottom: badges - fixed to bottom */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {product.manufacturer && (
            <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">{product.manufacturer}</span>
          )}
          <span className="text-xs font-mono font-bold text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded">{product.article}</span>
          <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            product.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            {product.stock > 0 ? 'В наличии' : 'Нет в наличии'}
          </span>
          {product.warehouse && (
            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              <MapPin className="w-3 h-3 mr-0.5" />{product.warehouse}
            </span>
          )}
          <span className="inline-flex items-center text-[11px] text-slate-500 px-2 py-0.5 rounded-full bg-slate-50">
            <Truck className="w-3 h-3 mr-0.5" />{getDeliveryText(product.delivery_days || 3)}
          </span>
          {isAlternative && product.cross_articles && (
            <span className="text-[11px] text-slate-400">Кросс: {product.cross_articles}</span>
          )}
        </div>
      </div>

      {/* Right: price + actions — centered vertically in bordered box */}
      <div className="flex-shrink-0 flex items-stretch p-2">
        <div className="flex items-center gap-2 px-3 border-2 border-slate-300 rounded-xl bg-slate-50/80">
          <p className="text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-pink-500 px-2.5 py-1 rounded-lg whitespace-nowrap shadow-sm">{formatPrice(product.price)} ₽</p>
          <FavoritesButton productId={product.id} size="sm" />
          <div className="flex items-center border border-slate-200 rounded-lg bg-white">
            <button onClick={() => updateQuantity(product.id, -1)} className="p-1.5 hover:bg-slate-50 rounded-l-lg" data-testid={`qty-minus-${product.id}`}>
              <Minus className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <input 
              type="number" 
              value={quantities[product.id] || 1}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setQuantities(prev => ({ ...prev, [product.id]: Math.max(1, val) }));
              }}
              className="w-10 text-center text-xs font-bold text-slate-700 border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min="1"
              data-testid={`qty-input-${product.id}`}
            />
            <button onClick={() => updateQuantity(product.id, 1)} className="p-1.5 hover:bg-slate-50 rounded-r-lg" data-testid={`qty-plus-${product.id}`}>
              <Plus className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
          <Button
            onClick={() => handleAddToCart(product)}
            disabled={product.stock === 0}
            className="h-8 px-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-lg shadow-md shadow-teal-500/20 text-xs"
            data-testid={`add-to-cart-${product.id}`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
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
                {product.stock > 0 ? 'В наличии' : 'Нет в наличии'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Доставка:</span>
              <span className="flex items-center gap-1 text-slate-600">
                <Truck className="w-4 h-4" />
                {getDeliveryText(product.delivery_days || 3)}
              </span>
            </div>
            {product.warehouse && (
              <div className="flex justify-between">
                <span className="text-slate-500">Склад:</span>
                <span className="text-blue-600 font-semibold">{product.warehouse}</span>
              </div>
            )}
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
              <input
                type="number"
                min="1"
                value={quantities[product.id] || 1}
                onChange={(e) => setQuantityDirect(product.id, e.target.value)}
                className="w-12 text-center font-semibold text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
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
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ manufacturer: '', warehouse: '', inStock: false, priceMin: '', priceMax: '', deliveryDays: '', hasPhoto: false, hasCross: false, sortBy: '' });
  const [filterOptions, setFilterOptions] = useState({ manufacturers: [], warehouses: [] });
  
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const searchQuery = searchParams.get('search');
  const categoryId = searchParams.get('category');

  useEffect(() => {
    fetchCategories();
    fetchFilterOptions();
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

  const fetchFilterOptions = async () => {
    try {
      const res = await axios.get(`${API}/products/filters`);
      setFilterOptions(res.data);
    } catch (err) {
      console.error('Failed to fetch filter options', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Build filter params
      const filterParams = new URLSearchParams();
      if (filters.manufacturer) filterParams.append('manufacturer', filters.manufacturer);
      if (filters.warehouse) filterParams.append('warehouse', filters.warehouse);
      if (filters.inStock) filterParams.append('in_stock', 'true');
      if (filters.priceMin) filterParams.append('price_min', filters.priceMin);
      if (filters.priceMax) filterParams.append('price_max', filters.priceMax);
      const fStr = filterParams.toString();

      // If searching by text, use the advanced search endpoint
      if (searchQuery && !categoryId) {
        const res = await axios.get(`${API}/products/search-with-alternatives?search=${encodeURIComponent(searchQuery)}`);
        let exact = res.data.exact || [];
        let alts = res.data.alternatives || [];
        
        // Apply client-side filters to search results
        const applyFilter = (list) => list.filter(p => {
          if (filters.manufacturer && p.manufacturer !== filters.manufacturer) return false;
          if (filters.warehouse && p.warehouse !== filters.warehouse) return false;
          if (filters.inStock && p.stock <= 0) return false;
          if (filters.priceMin && p.price < Number(filters.priceMin)) return false;
          if (filters.priceMax && p.price > Number(filters.priceMax)) return false;
          if (filters.deliveryDays && (p.delivery_days || 3) > Number(filters.deliveryDays)) return false;
          if (filters.hasPhoto && !p.image_url) return false;
          if (filters.hasCross && !p.cross_articles) return false;
          return true;
        });
        exact = applyFilter(exact);
        alts = applyFilter(alts);

        // Apply sorting
        const sortFn = getSortFn(filters.sortBy);
        if (sortFn) { exact.sort(sortFn); alts.sort(sortFn); }
        
        setProducts(exact);
        setAlternatives(alts);
        const q = {};
        [...exact, ...alts].forEach(p => q[p.id] = 1);
        setQuantities(q);
      } else {
        // Regular search for category browsing — use server-side filters
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (categoryId) params.append('category_id', categoryId);
        if (fStr) {
          filterParams.forEach((val, key) => params.append(key, val));
        }
        
        const res = await axios.get(`${API}/products?${params.toString()}`);
        setProducts(res.data);
        setAlternatives([]);
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
    setFilters({ manufacturer: '', warehouse: '', inStock: false, priceMin: '', priceMax: '', deliveryDays: '', hasPhoto: false, hasCross: false, sortBy: '' });
  };

  const applyFilters = () => {
    fetchProducts();
  };

  const resetFilters = () => {
    setFilters({ manufacturer: '', warehouse: '', inStock: false, priceMin: '', priceMax: '', deliveryDays: '', hasPhoto: false, hasCross: false, sortBy: '' });
  };

  const hasActiveFilters = filters.manufacturer || filters.warehouse || filters.inStock || filters.priceMin || filters.priceMax || filters.deliveryDays || filters.hasPhoto || filters.hasCross || filters.sortBy;

  const getSortFn = (sortBy) => {
    switch (sortBy) {
      case 'price_asc': return (a, b) => a.price - b.price;
      case 'price_desc': return (a, b) => b.price - a.price;
      case 'name_asc': return (a, b) => a.name.localeCompare(b.name);
      case 'stock_desc': return (a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0);
      default: return null;
    }
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

  const setQuantityDirect = (productId, value) => {
    const val = parseInt(value) || 1;
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, val)
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
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase mb-6 text-slate-800">
            {currentCategory ? currentCategory.name : 'Поиск запчастей'}
          </h1>
          
          {/* Search form */}
          <div className="max-w-2xl">
            <SearchDropdown 
              placeholder="Введите название или артикул..."
              onSelect={(product) => navigate(`/product/${product.id}`)}
              showSearchButton
            />
          </div>

          {/* Active filters tags */}
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

        {/* Two-column layout: Sidebar + Content */}
        <div className="flex gap-6">
          {/* Left sidebar — Filters (only after search) */}
          {(searchQuery || categoryId) && (
          <aside className="hidden md:block w-64 flex-shrink-0" data-testid="filters-sidebar">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-5 space-y-5 sticky top-24">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-teal-500" /> Фильтры
                </h3>
                {hasActiveFilters && (
                  <button
                    onClick={() => { resetFilters(); setTimeout(fetchProducts, 50); }}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    data-testid="reset-filters-btn"
                  >
                    Сбросить
                  </button>
                )}
              </div>

              {/* Manufacturer */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Производитель</label>
                <select
                  value={filters.manufacturer}
                  onChange={e => setFilters({ ...filters, manufacturer: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:border-teal-400 focus:ring-teal-200 focus:outline-none"
                  data-testid="filter-manufacturer"
                >
                  <option value="">Все</option>
                  {filterOptions.manufacturers.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Склад</label>
                <select
                  value={filters.warehouse}
                  onChange={e => setFilters({ ...filters, warehouse: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:border-teal-400 focus:ring-teal-200 focus:outline-none"
                  data-testid="filter-warehouse"
                >
                  <option value="">Все</option>
                  {filterOptions.warehouses.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              {/* Price range */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Цена, &#8381;</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={filters.priceMin}
                    onChange={e => setFilters({ ...filters, priceMin: e.target.value })}
                    placeholder="от"
                    className="h-9 rounded-lg border-slate-200 focus:border-teal-400 text-sm"
                    data-testid="filter-price-min"
                  />
                  <Input
                    type="number"
                    value={filters.priceMax}
                    onChange={e => setFilters({ ...filters, priceMax: e.target.value })}
                    placeholder="до"
                    className="h-9 rounded-lg border-slate-200 focus:border-teal-400 text-sm"
                    data-testid="filter-price-max"
                  />
                </div>
              </div>

              {/* In stock */}
              <label className="flex items-center gap-2.5 cursor-pointer" data-testid="filter-in-stock">
                <input
                  type="checkbox"
                  checked={filters.inStock}
                  onChange={e => setFilters({ ...filters, inStock: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-sm text-slate-700 font-medium">Только в наличии</span>
              </label>

              {/* Delivery days */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Срок доставки</label>
                <select
                  value={filters.deliveryDays}
                  onChange={e => setFilters({ ...filters, deliveryDays: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:border-teal-400 focus:ring-teal-200 focus:outline-none"
                  data-testid="filter-delivery"
                >
                  <option value="">Любой</option>
                  <option value="1">До 1 дня</option>
                  <option value="3">До 3 дней</option>
                  <option value="7">До 7 дней</option>
                  <option value="14">До 14 дней</option>
                </select>
              </div>

              {/* Has photo */}
              <label className="flex items-center gap-2.5 cursor-pointer" data-testid="filter-has-photo">
                <input
                  type="checkbox"
                  checked={filters.hasPhoto}
                  onChange={e => setFilters({ ...filters, hasPhoto: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-sm text-slate-700 font-medium">С фото</span>
              </label>

              {/* Has cross-articles */}
              <label className="flex items-center gap-2.5 cursor-pointer" data-testid="filter-has-cross">
                <input
                  type="checkbox"
                  checked={filters.hasCross}
                  onChange={e => setFilters({ ...filters, hasCross: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-sm text-slate-700 font-medium">Есть замены</span>
              </label>

              {/* Sort */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Сортировка</label>
                <select
                  value={filters.sortBy}
                  onChange={e => setFilters({ ...filters, sortBy: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:border-teal-400 focus:ring-teal-200 focus:outline-none"
                  data-testid="filter-sort"
                >
                  <option value="">По умолчанию</option>
                  <option value="price_asc">Цена: по возрастанию</option>
                  <option value="price_desc">Цена: по убыванию</option>
                  <option value="name_asc">По названию</option>
                  <option value="stock_desc">По наличию</option>
                </select>
              </div>

              {/* Category filter */}
              {categories.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Категория</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => selectCategory(cat.id)}
                        className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                          categoryId === cat.id
                            ? 'bg-teal-50 text-teal-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply button */}
              <Button
                onClick={applyFilters}
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl h-10 text-sm font-semibold shadow-lg shadow-teal-500/20"
                data-testid="apply-filters-btn"
              >
                Применить
              </Button>
            </div>
          </aside>
          )}

          {/* Mobile filters toggle (only after search) */}
          {(searchQuery || categoryId) && (
          <div className="md:hidden mb-4 w-full">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                showFilters || hasActiveFilters
                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                  : 'bg-white/60 text-slate-600 border border-slate-200'
              }`}
              data-testid="filters-toggle-btn"
            >
              <Filter className="w-4 h-4" /> Фильтры
              {hasActiveFilters && (
                <span className="bg-teal-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {[filters.manufacturer, filters.warehouse, filters.inStock, filters.priceMin, filters.priceMax, filters.deliveryDays, filters.hasPhoto, filters.hasCross, filters.sortBy].filter(Boolean).length}
                </span>
              )}
            </button>
            {showFilters && (
              <div className="mt-3 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Производитель</label>
                  <select value={filters.manufacturer} onChange={e => setFilters({...filters, manufacturer: e.target.value})} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm" data-testid="filter-manufacturer-mobile"><option value="">Все</option>{filterOptions.manufacturers.map(m => <option key={m} value={m}>{m}</option>)}</select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Склад</label>
                  <select value={filters.warehouse} onChange={e => setFilters({...filters, warehouse: e.target.value})} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm" data-testid="filter-warehouse-mobile"><option value="">Все</option>{filterOptions.warehouses.map(w => <option key={w} value={w}>{w}</option>)}</select>
                </div>
                <div className="flex gap-2">
                  <Input type="number" value={filters.priceMin} onChange={e => setFilters({...filters, priceMin: e.target.value})} placeholder="Цена от" className="h-9 rounded-lg text-sm" />
                  <Input type="number" value={filters.priceMax} onChange={e => setFilters({...filters, priceMax: e.target.value})} placeholder="Цена до" className="h-9 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Срок доставки</label>
                  <select value={filters.deliveryDays} onChange={e => setFilters({...filters, deliveryDays: e.target.value})} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"><option value="">Любой</option><option value="1">До 1 дня</option><option value="3">До 3 дней</option><option value="7">До 7 дней</option><option value="14">До 14 дней</option></select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Сортировка</label>
                  <select value={filters.sortBy} onChange={e => setFilters({...filters, sortBy: e.target.value})} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"><option value="">По умолчанию</option><option value="price_asc">Цена ↑</option><option value="price_desc">Цена ↓</option><option value="name_asc">По названию</option><option value="stock_desc">По наличию</option></select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filters.inStock} onChange={e => setFilters({...filters, inStock: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-teal-500" /><span className="text-sm text-slate-700">Только в наличии</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filters.hasPhoto} onChange={e => setFilters({...filters, hasPhoto: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-teal-500" /><span className="text-sm text-slate-700">С фото</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filters.hasCross} onChange={e => setFilters({...filters, hasCross: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-teal-500" /><span className="text-sm text-slate-700">Есть замены</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filters.inStock} onChange={e => setFilters({...filters, inStock: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-teal-500" /><span className="text-sm text-slate-700">Только в наличии</span></label>
                <Button onClick={applyFilters} className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-9 text-sm">Применить</Button>
              </div>
            )}
          </div>
          )}

          {/* Right content — Products */}
          <div className="flex-1 min-w-0">
            {/* Categories - show when no search/category selected */}
            {!searchQuery && !categoryId && categories.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4 text-slate-800">Категории</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
                {/* Exact matches */}
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

                {/* Alternatives */}
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
        </div>
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
