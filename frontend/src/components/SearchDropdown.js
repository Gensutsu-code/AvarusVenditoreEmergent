import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Package, X, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const SearchDropdown = ({ 
  placeholder = "Поиск по названию или артикулу...",
  compact = false,
  onSelect,
  className = ""
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const searchProducts = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API}/products/search`, {
        params: { q: searchQuery, limit: 8 }
      });
      setResults(res.data.products || []);
      setIsOpen(true);
    } catch (err) {
      console.error('Search failed', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchProducts(value);
    }, 300);
  };

  const handleSelectProduct = (product) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (onSelect) {
      onSelect(product);
    } else {
      navigate(`/product/${product.id}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.length >= 2) {
      setIsOpen(false);
      navigate(`/catalog?search=${encodeURIComponent(query)}`);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={`${compact ? 'pl-9 pr-8 h-9 text-sm' : 'pl-11 pr-10 h-12'} rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-200 bg-white/80 backdrop-blur-sm`}
          data-testid="search-input"
        />
        {loading && (
          <Loader2 className={`absolute right-3 top-1/2 -translate-y-1/2 text-teal-500 animate-spin ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
        )}
        {!loading && query && (
          <button
            onClick={clearSearch}
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors ${compact ? 'w-4 h-4' : 'w-5 h-5'}`}
          >
            <X className="w-full h-full" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden ${compact ? 'max-h-80' : 'max-h-96'}`}
            data-testid="search-dropdown"
          >
            <div className="p-2 border-b border-slate-100">
              <p className="text-xs text-slate-500 px-2">
                Найдено: {results.length} {results.length === 1 ? 'товар' : results.length < 5 ? 'товара' : 'товаров'}
              </p>
            </div>
            <div className="overflow-y-auto max-h-72">
              {results.map((product, index) => (
                <motion.button
                  key={product.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleSelectProduct(product)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-teal-50 transition-colors text-left border-b border-slate-100 last:border-0"
                  data-testid={`search-result-${product.id}`}
                >
                  {/* Product Image */}
                  <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  
                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {product.manufacturer && (
                        <span className="text-xs font-bold text-teal-600">{product.manufacturer}</span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">Арт: {product.article}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                  </div>

                  {/* Price & Stock */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-teal-600">{formatPrice(product.price)} ₽</p>
                    <p className={`text-xs ${product.stock > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {product.stock > 0 ? `${product.stock} шт.` : 'Нет в наличии'}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
            
            {/* View all results */}
            <div className="p-2 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate(`/catalog?search=${encodeURIComponent(query)}`);
                }}
                className="w-full py-2 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
              >
                Показать все результаты →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No results message */}
      <AnimatePresence>
        {isOpen && query.length >= 2 && results.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl z-50 p-6 text-center"
          >
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Ничего не найдено</p>
            <p className="text-slate-400 text-xs mt-1">Попробуйте изменить запрос</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
