import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Tag, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const HeaderPromoBanner = () => {
  const [banner, setBanner] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    fetchBanner();
    // Check if banner was previously collapsed
    const collapsed = sessionStorage.getItem('promo_banner_collapsed');
    if (collapsed === 'true') {
      setIsExpanded(false);
    }
  }, []);

  const fetchBanner = async () => {
    try {
      const res = await axios.get(`${API}/promo-banner`);
      setBanner(res.data);
    } catch (err) {
      console.error('Failed to fetch promo banner', err);
    }
  };

  const handleCollapse = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(false);
    sessionStorage.setItem('promo_banner_collapsed', 'true');
  };

  const handleExpand = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(true);
    sessionStorage.setItem('promo_banner_collapsed', 'false');
  };

  if (!banner || !banner.enabled || dismissed) {
    return null;
  }

  const bgColor = banner.bg_color || '#f97316';

  return (
    <div className="flex items-center">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div 
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-white text-sm font-medium whitespace-nowrap"
              style={{ backgroundColor: bgColor }}
              data-testid="promo-banner"
            >
              {/* Banner image on left */}
              {banner.image && banner.image_position === 'left' && (
                <img 
                  src={banner.image} 
                  alt="" 
                  className="h-5 w-auto object-contain"
                />
              )}
              
              {/* Banner text */}
              <span>{banner.text}</span>
              
              {/* Banner image on right */}
              {banner.image && banner.image_position === 'right' && (
                <img 
                  src={banner.image} 
                  alt="" 
                  className="h-5 w-auto object-contain"
                />
              )}
              
              {/* Close/Collapse button */}
              <motion.button 
                onClick={handleCollapse}
                className="ml-1 p-0.5 hover:bg-white/20 rounded-full transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                data-testid="promo-banner-close"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={handleExpand}
            className="flex items-center justify-center w-8 h-8 rounded-full text-white hover:scale-110 transition-transform"
            style={{ backgroundColor: bgColor }}
            whileHover={{ rotate: [0, -10, 10, 0] }}
            data-testid="promo-banner-collapsed"
          >
            <Tag className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
