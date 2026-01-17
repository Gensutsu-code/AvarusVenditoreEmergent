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

  const content = (
    <div 
      className="py-2 px-4 text-center text-white text-sm font-medium relative"
      style={{ backgroundColor: banner.bg_color || '#f97316' }}
      data-testid="promo-banner"
    >
      <span>{banner.text}</span>
      <button 
        onClick={() => setDismissed(true)}
        className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-70"
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
