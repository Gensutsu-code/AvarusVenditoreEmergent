import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      toast.error('Войдите для добавления в корзину');
      navigate('/login');
      return;
    }

    const success = await addToCart(product.id);
    if (success) {
      toast.success('Добавлено в корзину');
    } else {
      toast.error('Ошибка добавления');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  return (
    <Link 
      to={`/product/${product.id}`} 
      className="block border border-zinc-200 bg-white hover:border-zinc-400 transition-colors"
      data-testid={`product-card-${product.id}`}
    >
      <div className="aspect-square bg-zinc-50 overflow-hidden">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-300">
            <ShoppingCart className="w-12 h-12" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
          {product.article}
        </p>
        <h3 className="font-semibold text-zinc-900 mb-2 line-clamp-2">
          {product.name}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="price-tag text-lg text-zinc-900">
            {formatPrice(product.price)} ₽
          </span>
          <Button 
            size="sm"
            onClick={handleAddToCart}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            data-testid={`add-to-cart-${product.id}`}
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
};
