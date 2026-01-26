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
        ) : products.length === 0 && alternatives.length === 0 ? (
          <div className="text-center py-12" data-testid="no-products">
            <p className="text-zinc-500 mb-4">Товары не найдены</p>
            <Button onClick={clearFilters} variant="outline">
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
                    <div className="w-1 h-6 bg-green-500"></div>
                    <h2 className="text-lg font-bold text-zinc-900">
                      Точное совпадение ({products.length})
                    </h2>
                  </div>
                )}
                {!alternatives.length && (
                  <p className="text-sm text-zinc-500 mb-4">
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
                  <div className="w-1 h-6 bg-orange-500"></div>
                  <h2 className="text-lg font-bold text-zinc-900">
                    Возможные замены ({alternatives.length})
                  </h2>
                </div>
                <p className="text-sm text-zinc-500 mb-4">
                  Товары, у которых артикул "{searchQuery}" указан в кросс-номерах
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
                  {/* Manufacturer and Article */}
                  <div className="space-y-1">
                    {selectedProduct.manufacturer && (
                      <p className="text-base font-bold text-orange-600">
                        {selectedProduct.manufacturer}
                      </p>
                    )}
                    <p className="text-base font-mono font-semibold text-zinc-700">
                      Артикул: {selectedProduct.article}
                    </p>
                  </div>

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

                  <div className="border-t border-zinc-200 pt-4 flex items-center justify-between">
                    <span className="price-tag text-2xl text-zinc-900">
                      {formatPrice(selectedProduct.price)} ₽
                    </span>
                    <FavoritesButton productId={selectedProduct.id} />
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

                  {/* Related Products */}
                  <RelatedProducts 
                    productId={selectedProduct.id} 
                    onSelectProduct={(product) => {
                      setSelectedProduct(product);
                      if (!quantities[product.id]) {
                        setQuantities(prev => ({ ...prev, [product.id]: 1 }));
                      }
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
