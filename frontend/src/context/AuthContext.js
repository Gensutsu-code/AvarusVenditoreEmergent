import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { setTrackerAuth } from '../utils/tracker';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// The session lives in an httpOnly cookie set by the server; scripts never see the token
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    axios.post(`${API}/auth/logout`).catch(() => {});
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem('token');
    fetchUser();
  }, [fetchUser]);

  useEffect(() => { setTrackerAuth(!!user); }, [user]);

  // Intercept 401 responses to auto-logout on invalid/expired sessions
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && user) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [user, logout]);

  const startSession = useCallback((data) => {
    setUser(data.user);
    return data;
  }, []);

  const login = useCallback(async (email, password) => startSession((await axios.post(`${API}/auth/login`, { email, password })).data), [startSession]);

  const register = useCallback(async (data) => startSession((await axios.post(`${API}/auth/register`, data)).data), [startSession]);

  const refreshUser = useCallback(async () => {
    if (user) {
      await fetchUser();
    }
  }, [user, fetchUser]);

  // Memoize so context value has a stable reference — avoids re-rendering all consumers on every parent render.
  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
