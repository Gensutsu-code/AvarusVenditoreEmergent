import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Floating version for below header
export const FloatingPromoBanner = () => {
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
    <>
      {/* Expanded banner - centered */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div 
            className="fixed top-20 left-0 right-0 z-40 flex justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div 
              className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-full text-white text-sm font-medium whitespace-nowrap shadow-xl pointer-events-auto"
              style={{ 
                backgroundColor: bgColor,
                boxShadow: `0 8px 25px ${bgColor}50`
              }}
              data-testid="promo-banner"
              initial={{ 
                scale: 0.3, 
                y: -10,
                x: 'calc(50vw - 50%)',
                opacity: 0,
                filter: 'blur(10px)'
              }}
              animate={{ 
                scale: 1, 
                y: 0,
                x: 0,
                opacity: 1,
                filter: 'blur(0px)',
                transition: {
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  mass: 0.8,
                  opacity: { duration: 0.25 },
                  filter: { duration: 0.3 }
                }
              }}
              exit={{ 
                scale: 0.2,
                y: -5,
                x: 'calc(50vw - 40px)',
                opacity: 0,
                filter: 'blur(8px)',
                transition: {
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                  opacity: { duration: 0.25, delay: 0.1 },
                  filter: { duration: 0.3 }
                }
              }}
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
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); sessionStorage.setItem('promo_banner_collapsed', 'true'); }}
                  target="_blank"
                  rel="noreferrer"
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
        )}
      </AnimatePresence>

      {/* Collapsed button - right corner */}
      <AnimatePresence mode="wait">
        {!isExpanded && (
          <motion.div
            className="fixed top-20 right-4 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.button
              className="flex items-center justify-center w-10 h-10 rounded-full text-white shadow-xl hover:shadow-2xl"
              style={{ 
                backgroundColor: bgColor,
                boxShadow: `0 8px 25px ${bgColor}50`
              }}
              initial={{ 
                scale: 0.2, 
                x: '-calc(50vw - 60px)',
                opacity: 0,
                filter: 'blur(8px)'
              }}
              animate={{ 
                scale: 1, 
                x: 0,
                opacity: 1,
                filter: 'blur(0px)',
                transition: {
                  type: "spring",
                  stiffness: 350,
                  damping: 22,
                  mass: 0.6,
                  delay: 0.15,
                  opacity: { duration: 0.3, delay: 0.1 },
                  filter: { duration: 0.35, delay: 0.1 }
                }
              }}
              exit={{ 
                scale: 0.3,
                x: '-calc(50vw - 60px)',
                opacity: 0,
                filter: 'blur(6px)',
                transition: {
                  type: "spring",
                  stiffness: 400,
                  damping: 28,
                  opacity: { duration: 0.2 },
                  filter: { duration: 0.25 }
                }
              }}
              onClick={handleExpand}
              whileHover={{ 
                scale: 1.12,
                transition: { type: "spring", stiffness: 400, damping: 15 }
              }}
              whileTap={{ scale: 0.92 }}
              data-testid="promo-banner-collapsed"
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Original inline version (kept for backward compatibility)
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
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); sessionStorage.setItem('promo_banner_collapsed', 'true'); }}
                  target="_blank"
                  rel="noreferrer"
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
