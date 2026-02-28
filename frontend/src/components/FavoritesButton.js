import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { trackClick } from '../utils/tracker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const FavoritesButton = ({ productId, className = '', size = 'default', showText = false }) => {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && productId) {
      checkFavorite();
    }
  }, [user, productId]);

  const checkFavorite = async () => {
    try {
      const res = await axios.get(`${API}/favorites/check/${productId}`);
      setIsFavorite(res.data.is_favorite);
    } catch (err) {
      console.error('Failed to check favorite', err);
    }
  };

  const toggleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error('Войдите для добавления в избранное');
      return;
    }

    setLoading(true);
    trackClick(isFavorite ? 'remove_favorite' : 'add_favorite');
    try {
      if (isFavorite) {
        await axios.delete(`${API}/favorites/${productId}`);
        setIsFavorite(false);
        toast.success('Удалено из избранного');
      } else {
        await axios.post(`${API}/favorites/add`, { product_id: productId });
        setIsFavorite(true);
        toast.success('Добавлено в избранное');
      }
    } catch (err) {
      toast.error('Ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  // Large variant with text
  if (size === 'lg' && showText) {
    return (
      <motion.button
        onClick={toggleFavorite}
        disabled={loading}
        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 flex-1 ${
          isFavorite 
            ? 'bg-red-50 border border-red-200 text-red-500' 
            : 'bg-white/50 border border-slate-200 text-slate-600 hover:bg-white/80 hover:text-red-500'
        } ${className}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        data-testid={`favorite-btn-${productId}`}
      >
        <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
        {isFavorite ? 'В избранном' : 'В избранное'}
      </motion.button>
    );
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleFavorite}
      disabled={loading}
      className={`${className} ${isFavorite ? 'text-red-500 hover:text-red-600' : 'text-slate-400 hover:text-red-500'}`}
      data-testid={`favorite-btn-${productId}`}
    >
      <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
      {showText && <span className="ml-2">{isFavorite ? 'В избранном' : 'В избранное'}</span>}
    </Button>
  );
};
