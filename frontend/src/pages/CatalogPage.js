import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/ui/button';
import { X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORY_NAMES = {
  engine: 'Двигатель и комплектующие',
  transmission: 'Трансмиссия',
  brakes: 'Тормозная система',
  electric: 'Электрика',
  suspension: 'Подвеска',
  body: 'Кузовные детали'
};

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentCategory = searchParams.get('category');
  const searchQuery = searchParams.get('search');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [currentCategory, searchQuery]);

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
      if (currentCategory) params.append('category', currentCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await axios.get(`${API}/products?${params.toString()}`);
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const setCategory = (categoryId) => {
    const params = new URLSearchParams(searchParams);
    if (categoryId) {
      params.set('category', categoryId);
    } else {
      params.delete('category');
    }
    setSearchParams(params);
  };

  return (
    <div className="min-h-screen" data-testid="catalog-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-4">
            {currentCategory ? CATEGORY_NAMES[currentCategory] : 'Каталог'}
          </h1>
          
          {/* Active filters */}
          {(currentCategory || searchQuery) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-zinc-100 px-3 py-1 text-sm">
                  Поиск: "{searchQuery}"
                  <button onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete('search');
                    setSearchParams(params);
                  }}>
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )}
              {currentCategory && (
                <span className="inline-flex items-center gap-1 bg-zinc-100 px-3 py-1 text-sm">
                  {CATEGORY_NAMES[currentCategory]}
                  <button onClick={() => setCategory(null)}>
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Сбросить всё
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-8">
          {/* Sidebar - Categories */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
              Категории
            </h2>
            <nav className="space-y-1">
              <button
                onClick={() => setCategory(null)}
                className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                  !currentCategory 
                    ? 'bg-zinc-900 text-white font-semibold' 
                    : 'hover:bg-zinc-100'
                }`}
                data-testid="category-all"
              >
                Все категории
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                    currentCategory === cat.id 
                      ? 'bg-zinc-900 text-white font-semibold' 
                      : 'hover:bg-zinc-100'
                  }`}
                  data-testid={`filter-category-${cat.id}`}
                >
                  {cat.name}
                </button>
              ))}
            </nav>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            {/* Mobile category filter */}
            <div className="lg:hidden mb-6 overflow-x-auto">
              <div className="flex gap-2 pb-2">
                <Button
                  variant={!currentCategory ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategory(null)}
                  className={!currentCategory ? 'bg-zinc-900' : ''}
                >
                  Все
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={currentCategory === cat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategory(cat.id)}
                    className={currentCategory === cat.id ? 'bg-zinc-900' : ''}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </div>

            {loading ? (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-zinc-200" data-testid="products-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
