import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Search, X, ShoppingCart, Package, Truck, Minus, Plus, ArrowRight, Heart, ChevronLeft, ChevronRight, Percent, Eye, Filter, MapPin, ArrowUpDown, Tag, Gift, Sparkles, Layers, Flame, LayoutGrid, Handshake } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import { useIndividualPrice } from '../context/IndividualPriceContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { FavoritesButton } from '../components/FavoritesButton';
import { RelatedProducts } from '../components/RelatedProducts';
import { PopularProducts } from '../components/PopularProducts';
import { motion } from 'framer-motion';
import { SearchDropdown } from '../components/SearchDropdown';
import { trackClick } from '../utils/tracker';
import DiscountRequestModal from '../components/DiscountRequestModal';
import ProductRequestModal from '../components/ProductRequestModal';
import { computeDiscount, computeNewBadge, formatDiscountBadge, formatUntilDate, getQuantityTiers, isProductAvailable, getPromoStock } from '../utils/productHelpers';
import { DeliveryBadge } from '../components/DeliveryBadge';
import { PromoCountdown } from '../components/PromoCountdown';
import DiscountPromoBanner from '../components/DiscountPromoBanner';
import NewProductsBanner from '../components/NewProductsBanner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Simple price display component
const PriceDisplay = ({ price, individualPrice, formatPrice, productId }) => {
  if (individualPrice != null) {
    return (
      <div className="flex flex-col items-end">
        <span className="text-[10px] line-through text-slate-400" data-testid={productId ? `old-price-${productId}` : undefined}>{formatPrice(price)} ₽</span>
        <span className="text-sm font-bold text-emerald-600" data-testid={productId ? `individual-price-${productId}` : undefined}>{formatPrice(individualPrice)} ₽</span>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded mt-0.5 whitespace-nowrap" data-testid={productId ? `individual-badge-${productId}` : undefined}>
          <Handshake className="w-2.5 h-2.5" /> Ваша цена
        </span>
      </div>
    );
  }
  return <span className="text-xl font-bold text-teal-600">{formatPrice(price)} ₽</span>;
};

// ProductCard component for reuse
const ProductCard = ({ 
  product, 
  quantities, 
  setQuantities, 
  updateQuantity, 
  handleAddToCart,
  setSelectedProduct, 
  formatPrice, 
  getDeliveryText,
  onRequestDiscount,
  individualPrice,
  user,
  isAlternative = false
}) => {
  const discount = computeDiscount(product);
  const isNewProduct = computeNewBadge(product);
  const untilFormatted = formatUntilDate(discount?.until);
  const quantityTiers = getQuantityTiers(product);
  const minTierQty = quantityTiers.length ? quantityTiers[0].minQty : null;
  const oos = !isProductAvailable(product);
  return (
  <div 
    className={`relative bg-white rounded-xl border transition-all duration-300 hover:shadow-lg hover:border-teal-300/60 min-h-[110px] ${isAlternative ? 'border-teal-200/50 bg-teal-50/20' : 'border-slate-200/80'} ${oos ? 'group/oos' : ''}`}
    data-testid={`product-card-${product.id}`}
  >
    {/* Discount ribbon — attached to outer right edge of card, unfurls on hover */}
    {discount && (
      <div className="absolute left-full top-3 z-30 group/disc" data-testid={`badge-discount-${product.id}`}>
        <div
          className="relative h-7 bg-gradient-to-r from-rose-500 to-pink-600 shadow-md shadow-rose-500/40 flex items-center pl-2 pr-4 cursor-help"
          style={{ clipPath: 'polygon(0 0, 100% 0, 88% 50%, 100% 100%, 0 100%)' }}
        >
          {/* "Скидка" word — collapsed by default, slides in on hover */}
          <span className="overflow-hidden transition-all duration-500 ease-out max-w-0 group-hover/disc:max-w-[80px] flex-shrink-0">
            <span className="text-white text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap mr-1.5 inline-block">Скидка</span>
          </span>
          <Tag className="w-3 h-3 text-white" />
          <span className="text-white text-[12px] font-extrabold whitespace-nowrap ml-1">{formatDiscountBadge(discount)}</span>
        </div>
        {/* Tooltip */}
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
    {/* New ribbon — same shape, green, positioned below discount (or at top if no discount) */}
    {isNewProduct && (
      <div className={`absolute left-full z-30 group/new ${discount ? 'top-12' : 'top-3'}`} data-testid={`badge-new-${product.id}`}>
        <div
          className="relative h-7 bg-gradient-to-r from-emerald-500 to-green-500 shadow-md shadow-emerald-500/40 flex items-center pl-2 pr-4 cursor-default"
          style={{ clipPath: 'polygon(0 0, 100% 0, 88% 50%, 100% 100%, 0 100%)' }}
        >
          <span className="overflow-hidden transition-all duration-500 ease-out max-w-0 group-hover/new:max-w-[100px] flex-shrink-0">
            <span className="text-white text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap mr-1.5 inline-block">Новинка</span>
          </span>
          <Sparkles className="w-3 h-3 text-white" />
        </div>
      </div>
    )}
    <div className="rounded-xl overflow-hidden">
    {oos && (
      <div
        className="absolute top-2 right-2 z-20 pointer-events-none"
        data-testid={`out-of-stock-overlay-${product.id}`}
      >
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm transition-all duration-300 group-hover/oos:border-rose-200 group-hover/oos:bg-rose-50/90">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-400" />
          </span>
          <span className="text-[11px] font-semibold text-slate-600 group-hover/oos:text-rose-600 transition-colors">
            <span className="group-hover/oos:hidden">Нет в наличии</span>
            <span className="hidden group-hover/oos:inline">Товар закончился</span>
          </span>
        </div>
      </div>
    )}
    <div className={`flex min-h-[110px] transition-opacity duration-300 ${oos ? 'opacity-75 group-hover/oos:opacity-60' : ''}`}>
      {/* Image */}
      <div className="relative group flex-shrink-0 p-2 flex items-stretch">
        <Link
          to={`/product/${product.id}`}
          className="w-[84px] bg-slate-50 block overflow-hidden rounded-lg border-2 border-teal-400 shadow-sm"
          data-testid={`product-image-${product.id}`}
        >
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Package className="w-5 h-5" />
            </div>
          )}
        </Link>
        <button
          onClick={() => setSelectedProduct(product)}
          className="absolute inset-0 m-2 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
          data-testid={`quick-view-${product.id}`}
        >
          <Eye className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-2 pr-3 flex flex-col">
        {/* Top: name - fills available space */}
        <div className="flex-1 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50/50 mb-1.5 min-w-0">
          <h3 className="font-semibold text-[13px] leading-tight text-slate-800 hover:text-teal-600 transition-colors line-clamp-2 overflow-hidden">
            <Link to={`/product/${product.id}`}>{product.name}</Link>
          </h3>
        </div>
        
        {/* Bottom: badges - unified style, all 22px height, rounded-full */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {product.manufacturer && (
            <span className="inline-flex items-center h-[22px] text-[11px] font-extrabold uppercase tracking-wide text-white bg-gradient-to-r from-teal-500 to-cyan-500 px-2.5 rounded-full shadow-sm shadow-teal-500/30 whitespace-nowrap">
              {product.manufacturer}
            </span>
          )}
          <span className="inline-flex items-center h-[22px] text-[11px] font-mono font-extrabold text-white bg-gradient-to-r from-pink-500 to-rose-500 px-2.5 rounded-full shadow-sm shadow-pink-500/30 whitespace-nowrap">
            {product.article}
          </span>
          {product.stock_regions?.length > 0 && (
            <span className="inline-flex items-center h-[22px] text-[11px] font-semibold px-2.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 whitespace-nowrap">
              <MapPin className="w-3 h-3 mr-0.5" />{product.stock_regions.join(', ')}
            </span>
          )}
          {product.bonus_eligible !== false && (
            <span className="inline-flex items-center h-[22px] gap-1 text-[11px] font-semibold px-2.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap" data-testid={`badge-bonus-${product.id}`}>
              <Gift className="w-3 h-3" />Бонусы
            </span>
          )}
          {product.is_original && (
            <span className="inline-flex items-center h-[22px] text-[11px] font-semibold px-2.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap" data-testid={`badge-original-${product.id}`}>
              Оригинал
            </span>
          )}
          {product.has_guarantee && (
            <span className="inline-flex items-center h-[22px] text-[11px] font-semibold px-2.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap" data-testid={`badge-guarantee-${product.id}`}>
              Гарантия
            </span>
          )}
          {product.is_markdown && (
            <span className="inline-flex items-center h-[22px] gap-1 text-[11px] font-semibold px-2.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300 whitespace-nowrap" title={product.markdown_comment || 'Уценённый товар'} data-testid={`badge-markdown-${product.id}`}>
              <Tag className="w-3 h-3" />Уценка
            </span>
          )}
          <DeliveryBadge stockRegions={product.stock_regions} productId={product.id} />
          {minTierQty != null && (
            <span className="inline-flex items-center h-[22px] text-[11px] font-semibold px-2.5 rounded-full border whitespace-nowrap bg-rose-50 text-rose-600 border-rose-200" data-testid={`tier-badge-${product.id}`}>
              <Layers className="w-3 h-3 mr-0.5" />Опт. скидка от {minTierQty} шт.
            </span>
          )}
          {discount && discount.until && (
            <span className="inline-flex items-center h-[22px] text-[11px] font-semibold px-2.5 rounded-full border whitespace-nowrap bg-rose-50 text-rose-600 border-rose-200" data-testid={`card-countdown-${product.id}`}>
              <PromoCountdown until={discount.until} variant="inline" />
            </span>
          )}
          {(() => {
            const ps = getPromoStock(product);
            if (discount && ps && ps.remaining > 0) {
              return (
                <span className="inline-flex items-center h-[22px] text-[11px] font-semibold px-2.5 rounded-full border whitespace-nowrap bg-rose-100 text-rose-700 border-rose-300" data-testid={`card-promo-stock-${product.id}`}>
                  Осталось {ps.remaining} шт.
                </span>
              );
            }
            return null;
          })()}
          {isAlternative && product.cross_articles && (
            <span className="text-[11px] text-slate-400" style={{display:'none'}}>Кросс: {product.cross_articles}</span>
          )}
        </div>
      </div>

      {/* Right: price + actions — centered vertically in bordered box */}
      <div className="flex-shrink-0 flex items-stretch p-2">
        <div className="flex items-center gap-2 px-3 border-2 border-slate-300 rounded-xl bg-slate-50/80">
          {individualPrice != null ? (
            <div className="flex flex-col items-center" data-testid={`individual-price-block-${product.id}`}>
              <span className="text-xs font-semibold line-through text-slate-500 decoration-rose-400 decoration-2" data-testid={`old-price-${product.id}`}>{formatPrice(product.price)} ₽</span>
              <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg" data-testid={`individual-price-${product.id}`}>{formatPrice(individualPrice)} ₽</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-1 whitespace-nowrap" data-testid={`individual-badge-${product.id}`}>
                <Handshake className="w-2.5 h-2.5" /> Ваша цена по договорённости
              </span>
            </div>
          ) : discount ? (
            <div className="flex flex-col items-center" data-testid={`price-with-discount-${product.id}`}>
              <span className="text-xs font-semibold line-through text-slate-500 decoration-rose-400 decoration-2">{formatPrice(product.price)} ₽</span>
              <p className="text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-pink-500 px-2.5 py-0.5 rounded-lg whitespace-nowrap shadow-sm">{formatPrice(discount.finalPrice)} ₽</p>
            </div>
          ) : (
            <p className="text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-pink-500 px-2.5 py-1 rounded-lg whitespace-nowrap shadow-sm">{formatPrice(product.price)} ₽</p>
          )}
          {user && !individualPrice && (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestDiscount && onRequestDiscount(product); }}
              className="text-rose-400 hover:text-rose-600 transition-colors p-1"
              title="Запросить скидку"
              data-testid={`request-discount-${product.id}`}
            >
              <Percent className="w-3.5 h-3.5" />
            </button>
          )}
          <FavoritesButton productId={product.id} size="sm" />
          <div className="flex items-center border border-slate-200 rounded-lg bg-white">
            <button onClick={() => updateQuantity(product.id, -1)} className="p-1.5 hover:bg-slate-50 rounded-l-lg" data-testid={`qty-minus-${product.id}`}>
              <Minus className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <input 
              type="number" 
              value={quantities[product.id] || 1}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setQuantities(prev => ({ ...prev, [product.id]: Math.max(1, val) }));
              }}
              className="w-10 text-center text-xs font-bold text-slate-700 border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min="1"
              data-testid={`qty-input-${product.id}`}
            />
            <button onClick={() => updateQuantity(product.id, 1)} className="p-1.5 hover:bg-slate-50 rounded-r-lg" data-testid={`qty-plus-${product.id}`}>
              <Plus className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
          <Button
            onClick={() => handleAddToCart(product)}
            disabled={!isProductAvailable(product)}
            className="h-8 px-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-lg shadow-md shadow-teal-500/20 text-xs"
            data-testid={`add-to-cart-${product.id}`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
    </div>
  </div>
  );
};

// Product Modal Content with Image Slideshow
const ProductModalContent = ({ 
  product, 
  quantities, 
  setQuantityDirect, 
  updateQuantity, 
  handleAddToCart, 
  formatPrice, 
  getDeliveryText
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Combine main image with additional images
  const allImages = [];
  if (product.image_url) allImages.push(product.image_url);
  if (product.images) {
    product.images.forEach(img => {
      if (img !== product.image_url && !allImages.includes(img)) {
        allImages.push(img);
      }
    });
  }
  
  const hasMultipleImages = allImages.length > 1;
  
  const nextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % allImages.length);
  };
  
  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + allImages.length) % allImages.length);
  };
  
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-slate-800">{product.name}</DialogTitle>
      </DialogHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Image Gallery with Slideshow */}
        <div className="space-y-2">
          <div className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden group">
            {allImages.length > 0 ? (
              <>
                <img 
                  src={allImages[currentImageIndex]} 
                  alt={product.name}
                  className="w-full h-full object-cover transition-opacity"
                />
                
                {/* Navigation arrows */}
                {hasMultipleImages && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      data-testid="prev-image"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      data-testid="next-image"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    
                    {/* Image counter */}
                    <div className="absolute bottom-2 right-2 bg-white/80 text-slate-700 text-xs px-2 py-1 rounded-lg">
                      {currentImageIndex + 1} / {allImages.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Package className="w-16 h-16" />
              </div>
            )}
          </div>
          
          {/* Thumbnail strip */}
          {hasMultipleImages && (
            <div className="flex gap-2 overflow-x-auto py-1">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 border-2 rounded-lg overflow-hidden transition-colors ${
                    idx === currentImageIndex ? 'border-teal-500' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {/* Manufacturer and Article */}
          <div className="space-y-1">
            {product.manufacturer && (
              <p className="text-base font-bold text-teal-600">
                {product.manufacturer}
              </p>
            )}
            <p className="text-base font-mono font-semibold text-slate-600">
              Артикул: {product.article}
            </p>
          </div>

          {product.description && (
            <p className="text-slate-600">
              {product.description}
            </p>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Наличие:</span>
              <span className={isProductAvailable(product) ? 'text-emerald-600 font-semibold' : 'text-red-500'}>
                {isProductAvailable(product) ? 'В наличии' : 'Нет в наличии'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Доставка:</span>
              <DeliveryBadge stockRegions={product.stock_regions} productId={`list-${product.id}`} />
            </div>
            {product.stock_regions?.length > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Склад:</span>
                <span className="text-blue-600 font-semibold">{product.stock_regions.join(', ')}</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
            <PriceDisplay 
              price={product.price} 
              formatPrice={formatPrice} 
            />
            <FavoritesButton productId={product.id} />
          </div>

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white/50 rounded-xl overflow-hidden border border-slate-200">
              <button 
                onClick={() => updateQuantity(product.id, -1)}
                className="p-3 hover:bg-slate-100 transition-colors text-slate-600"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min="1"
                value={quantities[product.id] || 1}
                onChange={(e) => setQuantityDirect(product.id, e.target.value)}
                className="w-12 text-center font-semibold text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button 
                onClick={() => updateQuantity(product.id, 1)}
                className="p-3 hover:bg-slate-100 transition-colors text-slate-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <Button
              onClick={() => handleAddToCart(product)}
              disabled={!isProductAvailable(product)}
              className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold uppercase h-12 rounded-xl shadow-lg shadow-teal-500/30 transition-all duration-300"
              data-testid="modal-add-to-cart"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              В корзину
            </Button>
          </div>

          {/* Related Products */}
          <RelatedProducts 
            productId={product.id} 
            onSelectProduct={(p) => {
              // This won't work in the same way, but will at least not crash
              window.location.href = `/catalog?search=${p.article}`;
            }}
          />
        </div>
      </div>
    </>
  );
};

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [alternatives, setAlternatives] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ manufacturer: '', warehouse: '', inStock: false, priceMin: '', priceMax: '', deliveryDays: '', hasPhoto: false, hasCross: false, sortBy: '' });
  const [filterOptions, setFilterOptions] = useState({ manufacturers: [], warehouses: [] });
  const { getIndividualPrice } = useIndividualPrice();
  const [discountProduct, setDiscountProduct] = useState(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const searchQuery = searchParams.get('search');
  const categoryId = searchParams.get('category');
  const virtualCategory = (categoryId && ['assortment', 'new', 'discounted'].includes(categoryId)) ? categoryId : null;
  const [columnsCount, setColumnsCount] = useState(4);
  const [isMobileView, setIsMobileView] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const effectiveColumns = isMobileView ? 2 : columnsCount;

  useEffect(() => {
    fetchCategories();
    fetchFilterOptions();
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
      const settings = await axios.get(`${API}/categories/display-settings`);
      setColumnsCount(settings.data?.columns_count || 4);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const res = await axios.get(`${API}/products/filters`);
      setFilterOptions(res.data);
    } catch (err) {
      console.error('Failed to fetch filter options', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Build filter params
      const filterParams = new URLSearchParams();
      if (filters.manufacturer) filterParams.append('manufacturer', filters.manufacturer);
      if (filters.warehouse) filterParams.append('warehouse', filters.warehouse);
      if (filters.inStock) filterParams.append('in_stock', 'true');
      if (filters.priceMin) filterParams.append('price_min', filters.priceMin);
      if (filters.priceMax) filterParams.append('price_max', filters.priceMax);
      const fStr = filterParams.toString();

      // If searching by text, use the advanced search endpoint
      if (searchQuery && !categoryId) {
        const res = await axios.get(`${API}/products/search-with-alternatives?search=${encodeURIComponent(searchQuery)}`);
        let exact = res.data.exact || [];
        let alts = res.data.alternatives || [];
        
        // Apply client-side filters to search results
        const applyFilter = (list) => list.filter(p => {
          if (filters.manufacturer && p.manufacturer !== filters.manufacturer) return false;
          if (filters.warehouse && p.warehouse !== filters.warehouse) return false;
          if (filters.inStock && !isProductAvailable(p)) return false;
          if (filters.priceMin && p.price < Number(filters.priceMin)) return false;
          if (filters.priceMax && p.price > Number(filters.priceMax)) return false;
          if (filters.deliveryDays && (p.delivery_days || 3) > Number(filters.deliveryDays)) return false;
          if (filters.hasPhoto && !p.image_url) return false;
          if (filters.hasCross && !p.cross_articles) return false;
          return true;
        });
        exact = applyFilter(exact);
        alts = applyFilter(alts);

        // Apply sorting
        const sortFn = getSortFn(filters.sortBy);
        if (sortFn) { exact.sort(sortFn); alts.sort(sortFn); }
        
        setProducts(exact);
        setAlternatives(alts);
        const q = {};
        [...exact, ...alts].forEach(p => q[p.id] = 1);
        setQuantities(q);
      } else {
        // Regular search for category browsing — use server-side filters
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (virtualCategory) {
          params.append('virtual_category', virtualCategory);
        } else if (categoryId) {
          params.append('category_id', categoryId);
        }
        if (fStr) {
          filterParams.forEach((val, key) => params.append(key, val));
        }
        
        // Fetch ALL matching products in stable pages (avoids the old 100-item cap
        // and the "products shuffle/disappear" bug caused by unsorted, capped queries).
        const PAGE = 1000;
        let all = [];
        let skip = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const pageParams = new URLSearchParams(params.toString());
          pageParams.set('limit', String(PAGE));
          pageParams.set('skip', String(skip));
          const res = await axios.get(`${API}/products?${pageParams.toString()}`);
          const batch = Array.isArray(res.data) ? res.data : [];
          all = all.concat(batch);
          if (batch.length < PAGE) break;
          skip += PAGE;
        }
        setProducts(all);
        setAlternatives([]);
        const q = {};
        all.forEach(p => q[p.id] = 1);
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
    setFilters({ manufacturer: '', warehouse: '', inStock: false, priceMin: '', priceMax: '', deliveryDays: '', hasPhoto: false, hasCross: false, sortBy: '' });
  };

  const applyFilters = () => {
    fetchProducts();
  };

  const resetFilters = () => {
    setFilters({ manufacturer: '', warehouse: '', inStock: false, priceMin: '', priceMax: '', deliveryDays: '', hasPhoto: false, hasCross: false, sortBy: '' });
  };

  const hasActiveFilters = filters.manufacturer || filters.warehouse || filters.inStock || filters.priceMin || filters.priceMax || filters.deliveryDays || filters.hasPhoto || filters.hasCross || filters.sortBy;

  const getSortFn = (sortBy) => {
    switch (sortBy) {
      case 'price_asc': return (a, b) => a.price - b.price;
      case 'price_desc': return (a, b) => b.price - a.price;
      case 'delivery_asc': return (a, b) => (a.delivery_days || 3) - (b.delivery_days || 3);
      default: return null;
    }
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

    trackClick('add_to_cart', '/catalog');
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

  const setQuantityDirect = (productId, value) => {
    const val = parseInt(value) || 1;
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, val)
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
  const virtualCategoryLabels = { assortment: 'Ассортимент', new: 'Новинки', discounted: 'Скидки и Акции' };
  const currentCategoryName = virtualCategory ? virtualCategoryLabels[virtualCategory] : currentCategory?.name;

  const sortOptions = [
    { value: '', label: 'По умолчанию' },
    { value: 'delivery_asc', label: 'По скорости доставки', icon: Truck },
    { value: 'price_asc', label: 'Сначала дешёвые' },
    { value: 'price_desc', label: 'Сначала дорогие' },
  ];

  const handleSortChange = (val) => {
    setFilters(prev => ({ ...prev, sortBy: val }));
    // Re-sort will happen via useEffect below
  };

  // Re-sort on sortBy change (client-side)
  useEffect(() => {
    if (!filters.sortBy) return;
    const sortFn = getSortFn(filters.sortBy);
    if (sortFn) {
      setProducts(prev => [...prev].sort(sortFn));
      setAlternatives(prev => [...prev].sort(sortFn));
    }
  }, [filters.sortBy]);

  return (
    <div className="min-h-screen" data-testid="catalog-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          {currentCategory ? (
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase mb-6 text-slate-800">
              {currentCategory.name}
            </h1>
          ) : (
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                <Search className="w-6 h-6 text-teal-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-slate-800">
                Поиск и подбор запчастей
              </h1>
            </div>
          )}
          
          {/* Search form — full width to match banner width */}
          <div className="w-full">
            <SearchDropdown 
              placeholder="Введите название или артикул..."
              onSelect={(product) => navigate(`/product/${product.id}`)}
              showSearchButton
              variant="rose"
            />
          </div>

          {/* Active filters tags */}
          {(searchQuery || categoryId) && (
            <div className="flex items-center gap-2 mt-4">
              {searchQuery && (
                <span className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm bg-white/60 border border-cyan-200/50 text-slate-600">
                  Поиск: &quot;{searchQuery}&quot;
                  <button onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete('search');
                    setSearchParams(params);
                    setSearchInput('');
                  }} className="hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )}
              {categoryId && currentCategoryName && (
                <span className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm bg-white/60 border border-cyan-200/50 text-slate-600">
                  {currentCategoryName}
                  <button onClick={clearFilters} className="hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Persistent virtual category tabs — visible whenever a virtual category is active so user can switch in one click */}
          {virtualCategory && (
            <div className="flex items-center gap-2 mt-3 flex-wrap" data-testid="virtual-category-tabs">
              {[
                { id: 'assortment', label: 'Ассортимент', active: 'bg-teal-500 text-white border-teal-500' },
                { id: 'new', label: 'Новинки', active: 'bg-emerald-500 text-white border-emerald-500' },
                { id: 'discounted', label: 'Скидки и Акции', active: 'bg-rose-500 text-white border-rose-500' },
              ].map(tab => {
                const isActive = virtualCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => selectCategory(tab.id)}
                    data-testid={`tab-${tab.id}`}
                    className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      isActive ? tab.active + ' shadow-md' : 'bg-white/70 text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Two-column layout: Sidebar + Content */}
        <div className="flex gap-6">
          {/* Left sidebar — Filters (only after search) */}
          {(searchQuery || categoryId) && (
          <aside className="hidden md:block w-64 flex-shrink-0" data-testid="filters-sidebar">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-5 space-y-5 sticky top-24">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-teal-500" /> Фильтры
                </h3>
                {hasActiveFilters && (
                  <button
                    onClick={() => { resetFilters(); setTimeout(fetchProducts, 50); }}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    data-testid="reset-filters-btn"
                  >
                    Сбросить
                  </button>
                )}
              </div>

              {/* Manufacturer */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Производитель</label>
                <select
                  value={filters.manufacturer}
                  onChange={e => setFilters({ ...filters, manufacturer: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:border-teal-400 focus:ring-teal-200 focus:outline-none"
                  data-testid="filter-manufacturer"
                >
                  <option value="">Все</option>
                  {filterOptions.manufacturers.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Склад</label>
                <select
                  value={filters.warehouse}
                  onChange={e => setFilters({ ...filters, warehouse: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:border-teal-400 focus:ring-teal-200 focus:outline-none"
                  data-testid="filter-warehouse"
                >
                  <option value="">Все</option>
                  {filterOptions.warehouses.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              {/* Price range */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Цена, &#8381;</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={filters.priceMin}
                    onChange={e => setFilters({ ...filters, priceMin: e.target.value })}
                    placeholder="от"
                    className="h-9 rounded-lg border-slate-200 focus:border-teal-400 text-sm"
                    data-testid="filter-price-min"
                  />
                  <Input
                    type="number"
                    value={filters.priceMax}
                    onChange={e => setFilters({ ...filters, priceMax: e.target.value })}
                    placeholder="до"
                    className="h-9 rounded-lg border-slate-200 focus:border-teal-400 text-sm"
                    data-testid="filter-price-max"
                  />
                </div>
              </div>

              {/* In stock */}
              <label className="flex items-center gap-2.5 cursor-pointer" data-testid="filter-in-stock">
                <input
                  type="checkbox"
                  checked={filters.inStock}
                  onChange={e => setFilters({ ...filters, inStock: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-sm text-slate-700 font-medium">Только в наличии</span>
              </label>

              {/* Delivery days */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Срок доставки</label>
                <select
                  value={filters.deliveryDays}
                  onChange={e => setFilters({ ...filters, deliveryDays: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:border-teal-400 focus:ring-teal-200 focus:outline-none"
                  data-testid="filter-delivery"
                >
                  <option value="">Любой</option>
                  <option value="1">До 1 дня</option>
                  <option value="3">До 3 дней</option>
                  <option value="7">До 7 дней</option>
                  <option value="14">До 14 дней</option>
                </select>
              </div>

              {/* Has photo */}
              <label className="flex items-center gap-2.5 cursor-pointer" data-testid="filter-has-photo">
                <input
                  type="checkbox"
                  checked={filters.hasPhoto}
                  onChange={e => setFilters({ ...filters, hasPhoto: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-sm text-slate-700 font-medium">С фото</span>
              </label>

              {/* Has cross-articles */}
              <label className="flex items-center gap-2.5 cursor-pointer" data-testid="filter-has-cross">
                <input
                  type="checkbox"
                  checked={filters.hasCross}
                  onChange={e => setFilters({ ...filters, hasCross: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-400"
                />
                <span className="text-sm text-slate-700 font-medium">Есть замены</span>
              </label>

              {/* Sort */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Сортировка</label>
                <select
                  value={filters.sortBy}
                  onChange={e => setFilters({ ...filters, sortBy: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:border-teal-400 focus:ring-teal-200 focus:outline-none"
                  data-testid="filter-sort"
                >
                  <option value="">По умолчанию</option>
                  <option value="delivery_asc">По скорости доставки</option>
                  <option value="price_asc">Цена: по возрастанию</option>
                  <option value="price_desc">Цена: по убыванию</option>
                </select>
              </div>

              {/* Category filter */}
              {categories.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Категория</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => selectCategory(cat.id)}
                        className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                          categoryId === cat.id
                            ? 'bg-teal-50 text-teal-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply button */}
              <Button
                onClick={applyFilters}
                className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl h-10 text-sm font-semibold shadow-lg shadow-teal-500/20"
                data-testid="apply-filters-btn"
              >
                Применить
              </Button>
            </div>
          </aside>
          )}

          {/* Mobile filters toggle (only after search) */}
          {(searchQuery || categoryId) && (
          <div className="md:hidden mb-4 w-full">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                showFilters || hasActiveFilters
                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                  : 'bg-white/60 text-slate-600 border border-slate-200'
              }`}
              data-testid="filters-toggle-btn"
            >
              <Filter className="w-4 h-4" /> Фильтры
              {hasActiveFilters && (
                <span className="bg-teal-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {[filters.manufacturer, filters.warehouse, filters.inStock, filters.priceMin, filters.priceMax, filters.deliveryDays, filters.hasPhoto, filters.hasCross, filters.sortBy].filter(Boolean).length}
                </span>
              )}
            </button>
            {showFilters && (
              <div className="mt-3 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Производитель</label>
                  <select value={filters.manufacturer} onChange={e => setFilters({...filters, manufacturer: e.target.value})} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm" data-testid="filter-manufacturer-mobile"><option value="">Все</option>{filterOptions.manufacturers.map(m => <option key={m} value={m}>{m}</option>)}</select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Склад</label>
                  <select value={filters.warehouse} onChange={e => setFilters({...filters, warehouse: e.target.value})} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm" data-testid="filter-warehouse-mobile"><option value="">Все</option>{filterOptions.warehouses.map(w => <option key={w} value={w}>{w}</option>)}</select>
                </div>
                <div className="flex gap-2">
                  <Input type="number" value={filters.priceMin} onChange={e => setFilters({...filters, priceMin: e.target.value})} placeholder="Цена от" className="h-9 rounded-lg text-sm" />
                  <Input type="number" value={filters.priceMax} onChange={e => setFilters({...filters, priceMax: e.target.value})} placeholder="Цена до" className="h-9 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Срок доставки</label>
                  <select value={filters.deliveryDays} onChange={e => setFilters({...filters, deliveryDays: e.target.value})} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"><option value="">Любой</option><option value="1">До 1 дня</option><option value="3">До 3 дней</option><option value="7">До 7 дней</option><option value="14">До 14 дней</option></select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">Сортировка</label>
                  <select value={filters.sortBy} onChange={e => setFilters({...filters, sortBy: e.target.value})} className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"><option value="">По умолчанию</option><option value="delivery_asc">По скорости доставки</option><option value="price_asc">Цена ↑</option><option value="price_desc">Цена ↓</option></select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filters.inStock} onChange={e => setFilters({...filters, inStock: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-teal-500" /><span className="text-sm text-slate-700">Только в наличии</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filters.hasPhoto} onChange={e => setFilters({...filters, hasPhoto: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-teal-500" /><span className="text-sm text-slate-700">С фото</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filters.hasCross} onChange={e => setFilters({...filters, hasCross: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-teal-500" /><span className="text-sm text-slate-700">Есть замены</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={filters.inStock} onChange={e => setFilters({...filters, inStock: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-teal-500" /><span className="text-sm text-slate-700">Только в наличии</span></label>
                <Button onClick={applyFilters} className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-9 text-sm">Применить</Button>
              </div>
            )}
          </div>
          )}

          {/* Right content — Products */}
          <div className="flex-1 min-w-0">
            {/* Content */}
            {!searchQuery && !categoryId ? (
              <>
                {/* Popular Products — теперь первыми */}
                <PopularProducts />

                {/* Banners + Categories — отображаются ПОД блоком "Популярные товары" */}
                <div className="mb-8 mt-4">
                  {/* Promo banner — auto-appears when there are active discounts */}
                  <DiscountPromoBanner onOpenDiscounts={() => selectCategory('discounted')} />
                  {/* New products banner — auto-appears when there are products with is_new */}
                  <NewProductsBanner onOpenNew={() => selectCategory('new')} />

                  <div className="flex items-center gap-3 mb-4 mt-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-teal-600" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase text-slate-800">
                      Категории
                    </h2>
                  </div>
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))` }}
                  >
                    {/* Virtual categories: Ассортимент, Новинки, Скидки */}
                    <motion.button
                      onClick={() => selectCategory('assortment')}
                      className="group glass-card transition-all duration-300 p-3 text-left hover:border-teal-400/50 bg-gradient-to-br from-slate-50 to-teal-50/30"
                      data-testid="category-assortment"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="aspect-square mb-2 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center">
                        <Layers className="w-12 h-12 text-white" />
                      </div>
                      <h3 className="font-medium text-sm transition-colors flex items-center justify-between text-slate-800 group-hover:text-teal-600">
                        Ассортимент
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                    </motion.button>

                    <motion.button
                      onClick={() => selectCategory('new')}
                      className="group glass-card transition-all duration-300 p-3 text-left hover:border-emerald-400/50 bg-gradient-to-br from-emerald-50 to-green-50/40"
                      data-testid="category-new"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="aspect-square mb-2 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-white" />
                      </div>
                      <h3 className="font-medium text-sm transition-colors flex items-center justify-between text-slate-800 group-hover:text-emerald-600">
                        Новинки
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                    </motion.button>

                    <motion.button
                      onClick={() => selectCategory('discounted')}
                      className="group glass-card transition-all duration-300 p-3 text-left hover:border-rose-400/50 bg-gradient-to-br from-rose-50 to-pink-50/40"
                      data-testid="category-discounted"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="aspect-square mb-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                        <Flame className="w-12 h-12 text-white" />
                      </div>
                      <h3 className="font-medium text-sm transition-colors flex items-center justify-between text-slate-800 group-hover:text-rose-600">
                        Скидки и Акции
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                    </motion.button>

                    {categories.map((category) => (
                      <motion.button
                        key={category.id}
                        onClick={() => selectCategory(category.id)}
                        className="group glass-card transition-all duration-300 p-3 text-left hover:border-teal-400/50"
                        data-testid={`category-${category.id}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {category.image_url && (
                          <div className="aspect-square mb-2 overflow-hidden rounded-lg bg-slate-100">
                            <img 
                              src={category.image_url} 
                              alt={category.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        <h3 className="font-medium text-sm transition-colors flex items-center justify-between text-slate-800 group-hover:text-teal-600">
                          {category.name}
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h3>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </>
            ) : loading ? (
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))` }} data-testid="loading">
                {Array.from({ length: effectiveColumns * 2 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                    <Skeleton className="w-full aspect-square rounded-xl mb-3" />
                    <Skeleton className="h-3 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-full mb-1.5" />
                    <Skeleton className="h-4 w-2/3 mb-3" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 && alternatives.length === 0 ? (
              <div className="text-center py-12" data-testid="no-products">
                <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="mb-2 text-slate-500">Товары не найдены</p>
                <div className="flex flex-col items-center gap-3 mt-4">
                  <Button onClick={clearFilters} variant="outline" className="rounded-xl border-slate-300 text-slate-600 hover:bg-slate-100">
                    Сбросить фильтры
                  </Button>
                  {user && (
                    <Button
                      onClick={() => setRequestModalOpen(true)}
                      className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600"
                      data-testid="request-product-not-found-btn"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Не нашли что искали? Закажите!
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Sort bar — above results */}
                <div className="flex items-center gap-2 flex-wrap" data-testid="sort-bar">
                  <ArrowUpDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {sortOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleSortChange(opt.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        filters.sortBy === opt.value
                          ? 'bg-teal-500 text-white shadow-md shadow-teal-500/25'
                          : 'bg-white/70 text-slate-600 border border-slate-200 hover:border-teal-300 hover:text-teal-600'
                      }`}
                      data-testid={`sort-${opt.value || 'default'}`}
                    >
                      {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Exact matches */}
                {products.length > 0 && (
                  <div>
                    {alternatives.length > 0 && (
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                        <h2 className="text-lg font-bold text-slate-800">
                          Точное совпадение ({products.length})
                        </h2>
                      </div>
                    )}
                    {!alternatives.length && (
                      <p className="text-sm text-slate-500 mb-4">
                        Найдено: {products.length} {products.length === 1 ? 'товар' : products.length < 5 ? 'товара' : 'товаров'}
                      </p>
                    )}
                    
                    <div className="space-y-3" data-testid="products-list">
                      {products.map((product) => (
                        <ProductCard 
                          key={product.id} 
                          product={product} 
                          quantities={quantities}
                          setQuantities={setQuantities}
                          updateQuantity={updateQuantity}
                          handleAddToCart={handleAddToCart}
                          setSelectedProduct={setSelectedProduct}
                          formatPrice={formatPrice}
                          getDeliveryText={getDeliveryText}
                          onRequestDiscount={setDiscountProduct}
                          individualPrice={getIndividualPrice(product.id)}
                          user={user}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Alternatives */}
                {alternatives.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1 h-6 bg-teal-500"></div>
                      <h2 className="text-lg font-bold text-slate-800">
                        Возможные замены ({alternatives.length})
                      </h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                      Возможные аналоги и замены
                    </p>
                    
                    <div className="space-y-3" data-testid="alternatives-list">
                      {alternatives.map((product) => (
                        <ProductCard 
                          key={product.id} 
                          product={product} 
                          quantities={quantities}
                          setQuantities={setQuantities}
                          updateQuantity={updateQuantity}
                          handleAddToCart={handleAddToCart}
                          setSelectedProduct={setSelectedProduct}
                          formatPrice={formatPrice}
                          getDeliveryText={getDeliveryText}
                          onRequestDiscount={setDiscountProduct}
                          individualPrice={getIndividualPrice(product.id)}
                          user={user}
                          isAlternative={true}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl" data-testid="product-modal">
          {selectedProduct && (
            <ProductModalContent 
              product={selectedProduct}
              quantities={quantities}
              setQuantityDirect={setQuantityDirect}
              updateQuantity={updateQuantity}
              handleAddToCart={handleAddToCart}
              formatPrice={formatPrice}
              getDeliveryText={getDeliveryText}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Discount Request Modal */}
      <DiscountRequestModal
        open={!!discountProduct}
        onClose={() => setDiscountProduct(null)}
        product={discountProduct}
      />

      {/* Product Request Modal (not found) */}
      <ProductRequestModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        initialArticle={searchQuery || ''}
      />
    </div>
  );
}
