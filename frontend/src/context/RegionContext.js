import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_DELIVERY = {
  in_region: { label: 'В наличии в вашем регионе', color: '#16a34a', days_min: 1, days_max: 1 },
  other_region: { label: 'В наличии на другом складе', color: '#eab308', days_min: 3, days_max: 7 },
  out_of_stock: { label: 'Под заказ', color: '#dc2626', days_min: 7, days_max: 21 },
};

const RegionContext = createContext(null);

const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + (n || 0)); return d; };

export const RegionProvider = ({ children }) => {
  const { user } = useAuth();
  const [region, setRegionState] = useState(() => {
    try { return localStorage.getItem('client_region') || ''; } catch { return ''; }
  });
  const [regions, setRegions] = useState([]);
  const [deliverySettings, setDeliverySettings] = useState(DEFAULT_DELIVERY);

  useEffect(() => {
    axios.get(`${API}/regions`).then(r => setRegions(r.data?.regions || [])).catch(() => {});
    axios.get(`${API}/delivery-display`).then(r => setDeliverySettings({ ...DEFAULT_DELIVERY, ...(r.data || {}) })).catch(() => {});
  }, []);

  // Seed region from profile when user logs in and none chosen locally
  useEffect(() => {
    if (user?.region && !region) {
      setRegionState(user.region);
      try { localStorage.setItem('client_region', user.region); } catch { /* ignore */ }
    }
  }, [user, region]);

  const setRegion = useCallback((r) => {
    setRegionState(r);
    try { localStorage.setItem('client_region', r); } catch { /* ignore */ }
    if (user) {
      axios.put(`${API}/me/region`, { region: r }).catch(() => {});
    }
  }, [user]);

  const computeDelivery = useCallback((stockRegions) => {
    const regs = Array.isArray(stockRegions) ? stockRegions : [];
    let key;
    if (region && regs.includes(region)) key = 'in_region';
    else if (regs.length > 0) key = 'other_region';
    else key = 'out_of_stock';
    const cfg = deliverySettings[key] || DEFAULT_DELIVERY[key];
    const d1 = addDays(cfg.days_min);
    const d2 = addDays(cfg.days_max);
    const dateText = (cfg.days_min === cfg.days_max) ? fmtDate(d1) : `${fmtDate(d1)} – ${fmtDate(d2)}`;
    return { key, label: cfg.label, color: cfg.color, days_min: cfg.days_min, days_max: cfg.days_max, dateText };
  }, [region, deliverySettings]);

  return (
    <RegionContext.Provider value={{ region, setRegion, regions, deliverySettings, computeDelivery }}>
      {children}
    </RegionContext.Provider>
  );
};

export const useRegion = () => {
  const ctx = useContext(RegionContext);
  if (!ctx) return { region: '', setRegion: () => {}, regions: [], deliverySettings: DEFAULT_DELIVERY, computeDelivery: () => ({ key: 'out_of_stock', label: 'Под заказ', color: '#dc2626', dateText: '' }) };
  return ctx;
};
