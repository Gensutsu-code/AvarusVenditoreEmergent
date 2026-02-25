import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const HeaderPromoBanner = () => {
  const [banner, setBanner] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const { isDark } = useTheme();

  useEffect(() => {
    fetchBanner();
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

  if (!banner || !banner.enabled) {
    return null;
  }

  const bgColor = banner.bg_color || (isDark ? '#f97316' : '#10b981');

  return (
    <div className="flex items-center ml-4">
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ width: 0, opacity: 0, x: -20 }}
            animate={{ 
              width: 'auto', 
              opacity: 1, 
              x: 0,
              transition: {
                width: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
                opacity: { duration: 0.3, delay: 0.1 },
                x: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
              }
            }}
            exit={{ 
              width: 0, 
              opacity: 0, 
              x: -20,
              transition: {
                width: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
                opacity: { duration: 0.2 },
                x: { duration: 0.3 }
              }
            }}
            className="overflow-hidden"
          >
            <motion.div 
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-white text-sm font-medium whitespace-nowrap shadow-lg"
              style={{ 
                backgroundColor: bgColor,
                boxShadow: `0 4px 15px ${bgColor}40`
              }}
              data-testid="promo-banner"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2, delay: 0.2 }}
            >
              {/* Sparkle icon */}
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
              
              {/* Banner text - clickable if link exists */}
              {banner.link ? (
                <a 
                  href={banner.link}
                  className="tracking-wide"
                  onClick={(e) => e.stopPropagation()}
                >
                  {banner.text}
                </a>
              ) : (
                <span className="tracking-wide">{banner.text}</span>
              )}
              
              {/* Close button */}
              <motion.button 
                onClick={handleCollapse}
                className="ml-1 p-1 hover:bg-white/20 rounded-full transition-colors"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                data-testid="promo-banner-close"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{ 
              scale: 1, 
              opacity: 1, 
              rotate: 0,
              transition: {
                type: "spring",
                stiffness: 200,
                damping: 15
              }
            }}
            exit={{ 
              scale: 0, 
              opacity: 0,
              rotate: 180,
              transition: { duration: 0.2 }
            }}
            onClick={handleExpand}
            className="flex items-center justify-center w-9 h-9 rounded-full text-white shadow-lg hover:shadow-xl transition-shadow"
            style={{ 
              backgroundColor: bgColor,
              boxShadow: `0 4px 15px ${bgColor}40`
            }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
            data-testid="promo-banner-collapsed"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4" />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
