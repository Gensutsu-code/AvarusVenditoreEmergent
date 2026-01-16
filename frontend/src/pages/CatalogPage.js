import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');

  const searchQuery = searchParams.get('search');

  useEffect(() => {
    if (searchQuery) {
      fetchProducts();
    } else {
      setProducts([]);
    }
  }, [searchQuery]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await axios.get(`${API}/products?${params.toString()}`);
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ search: searchInput.trim() });
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchParams({});
    setProducts([]);
  };

  return (
    <div className="min-h-screen" data-testid="catalog-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-6">
            Поиск запчастей
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

          {/* Active search */}
          {searchQuery && (
            <div className="flex items-center gap-2 mt-4">
              <span className="inline-flex items-center gap-2 bg-zinc-100 px-3 py-2 text-sm">
                Результаты по запросу: "{searchQuery}"
                <button onClick={clearSearch} className="hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        {!searchQuery ? (
          <div className="text-center py-16" data-testid="search-prompt">
            <Search className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 text-lg">
              Введите название или артикул запчасти для поиска
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-zinc-500" data-testid="loading">
            Загрузка...
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12" data-testid="no-products">
            <p className="text-zinc-500 mb-4">По запросу "{searchQuery}" ничего не найдено</p>
            <Button onClick={clearSearch} variant="outline">
              Очистить поиск
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-500 mb-4">
              Найдено: {products.length} {products.length === 1 ? 'товар' : products.length < 5 ? 'товара' : 'товаров'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-zinc-200" data-testid="products-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
