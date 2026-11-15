import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { SITE_FEATURES } from '../lib/siteFeatures';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const FeaturesContext = createContext({ flags: {}, loaded: false, isOn: () => true, isEnabled: () => true, reload: () => {} });

const matches = (path, routes = []) => routes.some((r) => path === r || path.startsWith(`${r}/`));

export const FeaturesProvider = ({ children }) => {
  const { user } = useAuth();
  const [flags, setFlags] = useState({});
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(
    () => axios.get(`${API}/features`).then((r) => setFlags(r.data || {})).catch(() => {}).finally(() => setLoaded(true)),
    [],
  );
  useEffect(() => { reload(); }, [reload]);

  // switched on globally (what the admin panel follows)
  const isEnabled = useCallback((key) => flags[key]?.enabled !== false, [flags]);
  // available to the current visitor (also respects the audience of the function)
  const isOn = useCallback((key) => {
    if (!isEnabled(key)) return false;
    const audience = flags[key]?.audience || 'all';
    if (audience === 'all' || (user && user.role !== 'user')) return true;
    return (user?.customer_status || 'retail') === audience && !!user;
  }, [flags, isEnabled, user]);

  const value = useMemo(() => {
    const blockedFeature = (path) => SITE_FEATURES.find((f) => !isOn(f.key) && (matches(path, f.routes) || matches(path, f.adminRoutes)));
    return { flags, loaded, isOn, isEnabled, reload, blockedFeature };
  }, [flags, loaded, isOn, isEnabled, reload]);

  // every link to a switched-off page and every element the function owns disappears site-wide
  const css = SITE_FEATURES.filter((f) => !isOn(f.key)).flatMap((f) => [
    ...[...(f.routes || []), ...(f.adminRoutes || [])].flatMap((r) => [`a[href="${r}"]`, `a[href^="${r}/"]`]),
    ...(f.hide || []),
  ]).join(',');

  return (
    <FeaturesContext.Provider value={value}>
      {css && <style data-testid="features-hide-style">{`${css}{display:none !important}`}</style>}
      {children}
    </FeaturesContext.Provider>
  );
};

export const useFeatures = () => useContext(FeaturesContext);
