import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const FavoritesButton = ({ productId, className = '', size = 'default' }) => {
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

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleFavorite}
      disabled={loading}
      className={`${className} ${isFavorite ? 'text-red-500 hover:text-red-600' : 'text-zinc-400 hover:text-red-500'}`}
      data-testid={`favorite-btn-${productId}`}
    >
      <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
    </Button>
  );
};
