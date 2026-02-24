import { Link } from 'react-router-dom';
import { ShoppingCart, Package } from 'lucide-react';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export const ProductCard = ({ product, index = 0 }) => {
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link 
        to={`/product/${product.id}`} 
        className="block group"
        data-testid={`product-card-${product.id}`}
      >
        <motion.div 
          className="glass-card overflow-hidden"
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ duration: 0.3 }}
        >
          {/* Image */}
          <div className="aspect-square bg-zinc-800/50 overflow-hidden relative">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <Package className="w-12 h-12" />
              </div>
            )}
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Quick add button */}
            <motion.div 
              className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                size="sm"
                onClick={handleAddToCart}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-glow"
                data-testid={`add-to-cart-${product.id}`}
              >
                <ShoppingCart className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
          
          {/* Content */}
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
              {product.article}
            </p>
            <h3 className="font-semibold text-zinc-100 mb-3 line-clamp-2 group-hover:text-orange-400 transition-colors duration-300">
              {product.name}
            </h3>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xl font-bold text-orange-400">
                {formatPrice(product.price)} <span className="text-sm text-zinc-500">₽</span>
              </span>
              {product.stock !== undefined && product.stock <= 5 && product.stock > 0 && (
                <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                  Осталось {product.stock}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};
