import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const PromoBanner = () => {
  const [banner, setBanner] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchBanner();
  }, []);

  const fetchBanner = async () => {
    try {
      const res = await axios.get(`${API}/promo-banner`);
      setBanner(res.data);
    } catch (err) {
      console.error('Failed to fetch promo banner', err);
    }
  };

  if (!banner || !banner.enabled || dismissed) {
    return null;
  }

  const height = banner.height || 40;

  const content = (
    <div 
      className="flex items-center justify-between px-4 text-white relative"
      style={{ 
        backgroundColor: banner.bg_color || '#f97316',
        minHeight: `${height}px`
      }}
      data-testid="promo-banner"
    >
      {/* Left image */}
      <div className="flex-shrink-0 h-full flex items-center">
        {banner.left_image ? (
          <img 
            src={banner.left_image} 
            alt="" 
            className="object-contain"
            style={{ maxHeight: `${height - 8}px` }}
          />
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Center text */}
      <div className="flex-1 text-center py-2">
        <span className="text-sm font-medium">{banner.text}</span>
      </div>

      {/* Right image */}
      <div className="flex-shrink-0 h-full flex items-center">
        {banner.right_image ? (
          <img 
            src={banner.right_image} 
            alt="" 
            className="object-contain"
            style={{ maxHeight: `${height - 8}px` }}
          />
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Close button */}
      <button 
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 hover:opacity-70 p-1"
        data-testid="promo-banner-close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  if (banner.link) {
    return (
      <Link to={banner.link} className="block hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
};
