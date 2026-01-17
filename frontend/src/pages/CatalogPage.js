import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Search, X, ShoppingCart, Package, Truck, Minus, Plus, ArrowRight, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { FavoritesButton } from '../components/FavoritesButton';
import { RelatedProducts } from '../components/RelatedProducts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
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
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (categoryId) params.append('category_id', categoryId);
      
      const res = await axios.get(`${API}/products?${params.toString()}`);
      setProducts(res.data);
      // Initialize quantities
      const q = {};
      res.data.forEach(p => q[p.id] = 1);
      setQuantities(q);
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-6">
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
                className="pr-10 h-12 bg-zinc-50 border-zinc-200 text-base"
                data-testid="catalog-search-input"
              />
              {searchInput && (
                <button 
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <Button 
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase h-12 px-6"
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
                <span className="inline-flex items-center gap-2 bg-zinc-100 px-3 py-2 text-sm">
                  Поиск: "{searchQuery}"
                  <button onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete('search');
                    setSearchParams(params);
                    setSearchInput('');
                  }} className="hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )}
              {categoryId && currentCategory && (
                <span className="inline-flex items-center gap-2 bg-zinc-100 px-3 py-2 text-sm">
                  {currentCategory.name}
                  <button onClick={clearFilters} className="hover:text-red-500">
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
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Категории</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => selectCategory(category.id)}
                  className="group border border-zinc-200 bg-white hover:border-zinc-400 transition-colors p-4 text-left"
                  data-testid={`category-${category.id}`}
                >
                  {category.image_url && (
                    <div className="aspect-video bg-zinc-100 mb-3 overflow-hidden">
                      <img 
                        src={category.image_url} 
                        alt={category.name}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                      />
                    </div>
                  )}
                  <h3 className="font-medium text-zinc-900 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                    {category.name}
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {!searchQuery && !categoryId ? (
          <div className="text-center py-16" data-testid="search-prompt">
            <Search className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 text-lg">
              Введите название или артикул, либо выберите категорию
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-zinc-500" data-testid="loading">
            Загрузка...
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12" data-testid="no-products">
            <p className="text-zinc-500 mb-4">Товары не найдены</p>
            <Button onClick={clearFilters} variant="outline">
              Сбросить фильтры
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-500 mb-4">
              Найдено: {products.length} {products.length === 1 ? 'товар' : products.length < 5 ? 'товара' : 'товаров'}
            </p>
            
            {/* Products List */}
            <div className="space-y-3" data-testid="products-list">
              {products.map((product) => (
                <div 
                  key={product.id}
                  className="border border-zinc-200 bg-white hover:border-zinc-300 transition-colors"
                  data-testid={`product-card-${product.id}`}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Image - clickable */}
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="w-24 h-24 flex-shrink-0 bg-zinc-100 overflow-hidden hover:opacity-80 transition-opacity"
                      data-testid={`product-image-${product.id}`}
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
                    </button>

                    {/* Info - clickable */}
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-xs font-mono text-zinc-400 mb-1">{product.article}</p>
                      <h3 className="font-semibold text-zinc-900 hover:text-orange-500 transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                    </button>

                    {/* Stock */}
                    <div className="hidden sm:block text-center min-w-[80px]">
                      <p className={`text-sm font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {product.stock > 0 ? `${product.stock} шт.` : 'Нет'}
                      </p>
                      <p className="text-xs text-zinc-400">в наличии</p>
                    </div>

                    {/* Delivery */}
                    <div className="hidden md:flex items-center gap-2 text-zinc-500 min-w-[100px]">
                      <Truck className="w-4 h-4" />
                      <span className="text-sm">{getDeliveryText(product.delivery_days || 3)}</span>
                    </div>

                    {/* Price */}
                    <div className="text-right min-w-[100px]">
                      <span className="price-tag text-lg text-zinc-900">
                        {formatPrice(product.price)} ₽
                      </span>
                    </div>

                    {/* Quantity + Cart */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-zinc-200">
                        <button 
                          onClick={() => updateQuantity(product.id, -1)}
                          className="p-2 hover:bg-zinc-100"
                          data-testid={`qty-minus-${product.id}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3 min-w-[40px] text-center text-sm font-semibold">
                          {quantities[product.id] || 1}
                        </span>
                        <button 
                          onClick={() => updateQuantity(product.id, 1)}
                          className="p-2 hover:bg-zinc-100"
                          data-testid={`qty-plus-${product.id}`}
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
                    </div>
                  </div>

                  {/* Mobile info */}
                  <div className="sm:hidden flex items-center justify-between px-4 pb-4 text-sm">
                    <span className={product.stock > 0 ? 'text-green-600' : 'text-red-500'}>
                      {product.stock > 0 ? `В наличии: ${product.stock} шт.` : 'Нет в наличии'}
                    </span>
                    <span className="text-zinc-500 flex items-center gap-1">
                      <Truck className="w-4 h-4" />
                      {getDeliveryText(product.delivery_days || 3)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Product Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl" data-testid="product-modal">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">{selectedProduct.name}</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Large Image */}
                <div className="aspect-square bg-zinc-100 overflow-hidden">
                  {selectedProduct.image_url ? (
                    <img 
                      src={selectedProduct.image_url} 
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <Package className="w-16 h-16" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <p className="text-sm font-mono text-zinc-400">
                    Артикул: {selectedProduct.article}
                  </p>

                  {selectedProduct.description && (
                    <p className="text-zinc-600">
                      {selectedProduct.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Наличие:</span>
                      <span className={selectedProduct.stock > 0 ? 'text-green-600 font-semibold' : 'text-red-500'}>
                        {selectedProduct.stock > 0 ? `${selectedProduct.stock} шт.` : 'Нет в наличии'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Доставка:</span>
                      <span className="flex items-center gap-1">
                        <Truck className="w-4 h-4" />
                        {getDeliveryText(selectedProduct.delivery_days || 3)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200 pt-4">
                    <span className="price-tag text-2xl text-zinc-900">
                      {formatPrice(selectedProduct.price)} ₽
                    </span>
                  </div>

                  {/* Quantity + Add to cart */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-zinc-200">
                      <button 
                        onClick={() => updateQuantity(selectedProduct.id, -1)}
                        className="p-3 hover:bg-zinc-100"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-4 min-w-[50px] text-center font-semibold">
                        {quantities[selectedProduct.id] || 1}
                      </span>
                      <button 
                        onClick={() => updateQuantity(selectedProduct.id, 1)}
                        className="p-3 hover:bg-zinc-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <Button
                      onClick={() => {
                        handleAddToCart(selectedProduct);
                        setSelectedProduct(null);
                      }}
                      disabled={selectedProduct.stock === 0}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase h-12"
                      data-testid="modal-add-to-cart"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      В корзину
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
