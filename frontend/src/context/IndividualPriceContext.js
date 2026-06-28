import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const IndividualPriceContext = createContext({ getIndividualPrice: () => null, refresh: () => {} });

export const IndividualPriceProvider = ({ children }) => {
  const { user } = useAuth();
  const [prices, setPrices] = useState({});

  const refresh = useCallback(async () => {
    if (!user) { setPrices({}); return; }
    try {
      const r = await axios.get(`${API}/products/my-individual-prices`);
      setPrices(r.data.prices || {});
    } catch {
      setPrices({});
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const getIndividualPrice = useCallback((productId) => {
    const v = prices[productId];
    return typeof v === 'number' ? v : null;
  }, [prices]);

  return (
    <IndividualPriceContext.Provider value={{ getIndividualPrice, refresh }}>
      {children}
    </IndividualPriceContext.Provider>
  );
};

export const useIndividualPrice = () => useContext(IndividualPriceContext);
