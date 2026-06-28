import { Link } from 'react-router-dom';
import { ShoppingCart, Package, ShieldCheck, BadgeCheck, Gift, Tag, Truck, Layers, Handshake } from 'lucide-react';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useIndividualPrice } from '../context/IndividualPriceContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { computeDiscount, formatDiscountBadge, formatUntilDate, getDeliveryBadge, getQuantityTiers } from '../utils/productHelpers';

export const ProductCard = ({ product, index = 0 }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { getIndividualPrice } = useIndividualPrice();
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

  const discount = computeDiscount(product);
  const deliveryBadge = getDeliveryBadge(product.delivery_days);
  const untilFormatted = formatUntilDate(discount?.until);
  const quantityTiers = getQuantityTiers(product);
  const minTierQty = quantityTiers.length ? quantityTiers[0].minQty : null;
  const individualPrice = getIndividualPrice(product.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link 
        to={`/product/${product.id}`} 
        className="block group relative"
        data-testid={`product-card-${product.id}`}
      >
        {/* Discount ribbon — attached to outer right edge, unfurls on hover */}
        {discount && (
          <div className="absolute left-full top-3 z-30 group/disc" data-testid={`badge-discount-${product.id}`}>
            <div
              className="relative h-7 bg-gradient-to-r from-rose-500 to-pink-600 shadow-md shadow-rose-500/40 flex items-center pl-2 pr-4 cursor-help"
              style={{ clipPath: 'polygon(0 0, 100% 0, 88% 50%, 100% 100%, 0 100%)' }}
            >
              <span className="overflow-hidden transition-all duration-500 ease-out max-w-0 group-hover/disc:max-w-[80px] flex-shrink-0">
                <span className="text-white text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap mr-1.5 inline-block">Скидка</span>
              </span>
              <Tag className="w-3 h-3 text-white" />
              <span className="text-white text-[12px] font-extrabold whitespace-nowrap ml-1">{formatDiscountBadge(discount)}</span>
            </div>
            <div className="absolute right-0 top-full mt-2 w-60 p-3 bg-white border border-rose-200 rounded-xl shadow-xl text-left opacity-0 invisible group-hover/disc:opacity-100 group-hover/disc:visible transition-all duration-200 z-40 pointer-events-none" data-testid={`discount-tooltip-${product.id}`}>
              {discount.label && (
                <p className="text-sm font-bold text-rose-600 mb-1">{discount.label}</p>
              )}
              <p className="text-xs text-slate-500">Скидка: <span className="font-semibold text-rose-500">{formatDiscountBadge(discount)}</span></p>
              {discount.description && (
                <p className="text-xs text-slate-600 mt-1">{discount.description}</p>
              )}
              {untilFormatted && (
                <p className="text-[10px] text-slate-400 mt-1">До {untilFormatted}</p>
              )}
            </div>
          </div>
        )}
        <motion.div 
          className={`glass-card overflow-hidden hover:border-teal-400/50 relative ${product.stock <= 0 ? 'group/oos' : ''}`}
          whileHover={{ scale: product.stock > 0 ? 1.02 : 1, y: product.stock > 0 ? -4 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {product.stock <= 0 && (
            <div
              className="absolute top-3 right-3 z-20 pointer-events-none"
              data-testid={`out-of-stock-overlay-${product.id}`}
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm transition-all duration-300 group-hover/oos:border-rose-200 group-hover/oos:bg-rose-50/90">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
                </span>
                <span className="text-xs font-semibold text-slate-600 group-hover/oos:text-rose-600 transition-colors">
                  <span className="group-hover/oos:hidden">Нет в наличии</span>
                  <span className="hidden group-hover/oos:inline">Товар закончился</span>
                </span>
              </div>
            </div>
          )}
          <div className={product.stock <= 0 ? 'opacity-75 group-hover/oos:opacity-60 transition-opacity duration-300' : ''}>
          {/* Image */}
          <div className="aspect-square bg-slate-100 overflow-hidden relative">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <Package className="w-12 h-12" />
              </div>
            )}
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Badges (top-left) */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {product.is_original && (
                <span className="inline-flex items-center gap-1 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow" data-testid={`badge-original-${product.id}`}>
                  <BadgeCheck className="w-3 h-3" /> Оригинал
                </span>
              )}
              {product.has_guarantee && (
                <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow" data-testid={`badge-guarantee-${product.id}`}>
                  <ShieldCheck className="w-3 h-3" /> Гарантия
                </span>
              )}
              {product.bonus_eligible !== false && (
                <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow" data-testid={`badge-bonus-${product.id}`}>
                  <Gift className="w-3 h-3" /> Бонусы
                </span>
              )}
            </div>

            {/* Discount badge moved to outer wrapper for "tag attached to corner" effect */}
            
            {/* Quick add button */}
            <motion.div 
              className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                size="sm"
                onClick={handleAddToCart}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl shadow-lg shadow-teal-500/30"
                data-testid={`add-to-cart-${product.id}`}
              >
                <ShoppingCart className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
          
          {/* Content */}
          <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
              {product.article}
            </p>
            <h3 className="font-semibold text-slate-800 mb-3 line-clamp-2 group-hover:text-teal-600 transition-colors duration-300">
              {product.name}
            </h3>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex flex-col">
                {individualPrice != null ? (
                  <>
                    <span className="text-xs text-slate-400 line-through" data-testid={`old-price-${product.id}`}>
                      {formatPrice(product.price)} ₽
                    </span>
                    <span className="text-xl font-bold text-emerald-600" data-testid={`individual-price-${product.id}`}>
                      {formatPrice(individualPrice)} <span className="text-sm text-emerald-400">₽</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md mt-1 w-fit" data-testid={`individual-badge-${product.id}`}>
                      <Handshake className="w-3 h-3" /> Ваша цена по договорённости
                    </span>
                  </>
                ) : discount ? (
                  <>
                    <span className="text-xs text-slate-400 line-through" data-testid={`old-price-${product.id}`}>
                      {formatPrice(product.price)} ₽
                    </span>
                    <span className="text-xl font-bold text-rose-600" data-testid={`new-price-${product.id}`}>
                      {formatPrice(discount.finalPrice)} <span className="text-sm text-rose-400">₽</span>
                    </span>
                  </>
                ) : (
                  <span className="text-xl font-bold text-teal-600">
                    {formatPrice(product.price)} <span className="text-sm text-slate-400">₽</span>
                  </span>
                )}
              </div>
              {product.stock !== undefined && product.stock <= 5 && product.stock > 0 && (
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-lg">
                  Осталось {product.stock}
                </span>
              )}
            </div>
            {/* Delivery badge */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${deliveryBadge.classes}`}
              data-testid={`delivery-badge-${product.id}`}
            >
              <Truck className="w-3 h-3" />
              {deliveryBadge.label}
            </span>
            {minTierQty != null && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-rose-50 text-rose-600 border-rose-200 ml-2"
                data-testid={`tier-badge-${product.id}`}
              >
                <Layers className="w-3 h-3" />
                Опт. скидка от {minTierQty} шт.
              </span>
            )}
          </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};
