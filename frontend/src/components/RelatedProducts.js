import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, ShoppingCart } from 'lucide-react';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const RelatedProducts = ({ productId, onSelectProduct }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    if (productId) {
      fetchRelated();
    }
  }, [productId]);

  const fetchRelated = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/products/${productId}/related?limit=4`);
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch related products', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (e, product) => {
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
      <div className="mt-6 pt-6 border-t border-zinc-200">
        <p className="text-xs font-bold uppercase text-zinc-500 mb-3">С этим товаром покупают</p>
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-zinc-100 h-24 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <div className="mt-6 pt-6 border-t border-zinc-200" data-testid="related-products">
      <p className="text-xs font-bold uppercase text-zinc-500 mb-3">С этим товаром покупают</p>
      <div className="grid grid-cols-2 gap-2">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelectProduct && onSelectProduct(product)}
            className="text-left border border-zinc-200 hover:border-zinc-400 transition-colors p-2 group"
            data-testid={`related-product-${product.id}`}
          >
            <div className="flex gap-2">
              {/* Image */}
              <div className="w-12 h-12 flex-shrink-0 bg-zinc-100 overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300">
                    <Package className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-mono text-zinc-400">{product.article}</p>
                <h4 className="text-xs font-medium text-zinc-900 line-clamp-2 group-hover:text-orange-500 transition-colors">
                  {product.name}
                </h4>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold text-zinc-900">
                    {formatPrice(product.price)} ₽
                  </span>
                  <Button
                    size="sm"
                    onClick={(e) => handleAddToCart(e, product)}
                    disabled={product.stock === 0}
                    className="bg-orange-500 hover:bg-orange-600 p-1 h-6 w-6"
                    data-testid={`add-related-${product.id}`}
                  >
                    <ShoppingCart className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
