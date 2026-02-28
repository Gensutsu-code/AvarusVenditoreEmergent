import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, LogOut, Settings, Heart, Package, ClipboardList, Gift, Newspaper, Menu, X, MessageCircle, Bell, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Button } from './ui/button';
import { AdminNotifications } from './AdminNotifications';
import { HeaderPromoBanner } from './HeaderPromoBanner';
import { SearchDropdown } from './SearchDropdown';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { playNotificationSound, showPushNotification, requestNotificationPermission } from '../utils/notifications';

// Expandable Profile Menu Component
const ExpandableProfileMenu = ({ onLogout, unreadCount = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const timeoutRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfileClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 4000);
    } else {
      setIsExpanded(false);
      navigate('/account');
    }
  };

  const handleItemClick = (action) => {
    setIsExpanded(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (typeof action === 'function') {
      action();
    }
  };

  const iconVariants = {
    hidden: { opacity: 0, scale: 0.5, y: -10 },
    visible: (custom) => ({
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 350,
        damping: 25,
        delay: custom * 0.07
      }
    }),
    exit: {
      opacity: 0,
      scale: 0.5,
      y: -10,
      transition: { duration: 0.15 }
    }
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Profile button */}
      <motion.button
        onClick={handleProfileClick}
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
          isExpanded 
            ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-xl shadow-teal-500/40' 
            : 'bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600 border-2 border-teal-200 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/20'
        }`}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        data-testid="profile-menu-trigger"
      >
        <User className="w-5 h-5" />
        {!isExpanded && unreadCount > 0 && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center font-bold rounded-full px-1 shadow-sm"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="absolute right-0 top-full mt-2 flex flex-col items-center gap-2 z-50"
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* 1. Notifications - Link to page */}
            <motion.div custom={0} variants={iconVariants}>
              <Link 
                to="/notifications" 
                onClick={() => handleItemClick(() => {})}
                className="relative w-10 h-10 rounded-xl bg-white/95 backdrop-blur-sm border border-slate-200 text-slate-500 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center"
                data-testid="notifications-link"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center font-bold rounded-full px-1 shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </motion.div>

            {/* 2. Favorites */}
            <motion.div custom={1} variants={iconVariants}>
              <Link 
                to="/favorites" 
                onClick={() => handleItemClick(() => {})}
                className="w-10 h-10 rounded-xl bg-white/95 backdrop-blur-sm border border-slate-200 text-slate-500 hover:text-pink-500 hover:bg-pink-50 hover:border-pink-300 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center"
                data-testid="favorites-link"
              >
                <Heart className="w-5 h-5" />
              </Link>
            </motion.div>

            {/* 3. Logout */}
            <motion.div custom={2} variants={iconVariants}>
              <button
                onClick={() => handleItemClick(onLogout)}
                className="w-10 h-10 rounded-xl bg-red-50 backdrop-blur-sm border border-red-200 text-red-400 hover:text-red-600 hover:bg-red-100 hover:border-red-400 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center"
                data-testid="logout-button"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Header = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [userBalance, setUserBalance] = useState(null);
  const lastSeenCountRef = useRef(0);
  const hasInitRef = useRef(false);
  const lastToastTimeRef = useRef(0);
  
  const isAdmin = user?.role === 'admin';

  // Global notification polling with sound + push
  useEffect(() => {
    if (user && !isAdmin) {
      requestNotificationPermission();
    }
  }, [user, isAdmin]);

  const clientNotifsEnabledRef = useRef(true);

  // Check if client notifications are enabled (once on mount + every 30s)
  useEffect(() => {
    if (isAdmin) return;
    const check = () => {
      axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/client-notifications-enabled`)
        .then(r => { clientNotifsEnabledRef.current = r.data.enabled !== false; })
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const fetchUserData = useCallback(async () => {
    if (!user || isAdmin) return;
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [notifRes, balanceRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/my-notifications`, { headers }),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/balance`, { headers })
      ]);
      const notifData = await notifRes.json();
      const newCount = notifData.unread_count || 0;
      setNotificationCount(newCount);
      
      const balanceData = await balanceRes.json();
      setUserBalance(balanceData.balance ?? 0);

      // On first load, just set the baseline
      if (!hasInitRef.current) {
        lastSeenCountRef.current = newCount;
        hasInitRef.current = true;
        return;
      }

      // If new unread notifications appeared since last poll
      if (newCount > lastSeenCountRef.current) {
        const now = Date.now();
        // Debounce: skip toast if another toast was shown in last 8 seconds (e.g. from checkout/order action)
        const globalLastToast = window.__lastToastTime || 0;
        if (now - globalLastToast > 8000) {
          const notifs = notifData.notifications || [];
          const latest = notifs.find(n => !n.read);
          if (latest) {
            toast.info(latest.message || latest.title, { id: `client-${latest.id}`, duration: 5000 });
            lastToastTimeRef.current = now;
            window.__lastToastTime = now;
          }
          playNotificationSound();
        }
        // Push notification only when tab is hidden (minimized/switched)
        if (document.hidden) {
          const notifs = notifData.notifications || [];
          const latest = notifs.find(n => !n.read);
          showPushNotification(
            latest?.title || 'Новое уведомление',
            latest?.message || `У вас ${newCount - lastSeenCountRef.current} новых уведомлений`,
            { tag: 'global-notif' }
          );
        }
      }
      lastSeenCountRef.current = newCount;
    } catch (err) {}
  }, [user, isAdmin]);

  useEffect(() => {
    if (user && !isAdmin) {
      fetchUserData();
      const interval = setInterval(fetchUserData, 3000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin, fetchUserData]);

  const NavLink = ({ to, children, className = '' }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        className={`relative px-3 py-2.5 text-sm font-medium transition-all duration-300 rounded-xl flex items-center justify-center
          ${isActive 
            ? 'text-teal-600 bg-teal-500/10'
            : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          } ${className}`}
      >
        {children}
        {isActive && (
          <motion.div
            layoutId="activeTab"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-500"
          />
        )}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl border-b bg-white/70 border-cyan-200/50" data-testid="header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-6">
          {/* Logo */}
          <Link to={isAdmin ? "/admin" : "/"} className="flex-shrink-0 group" data-testid="logo-link">
            <motion.h1 
              className="text-xl font-bold uppercase tracking-tight bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              avopt.store
            </motion.h1>
          </Link>
          
          {/* Search Field - left edge, wider */}
          {user && !isAdmin && (
            <div className="hidden md:flex items-center gap-2">
              <div className="w-72">
                <SearchDropdown 
                  placeholder="Поиск..." 
                  compact={true}
                />
              </div>
              <NavLink to="/catalog" data-testid="search-page-link">
                <motion.div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600 border-2 border-teal-200 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/20 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Search className="w-5 h-5" />
                </motion.div>
              </NavLink>
            </div>
          )}
          
          {/* Admin indicator (only for admin) - center */}
          {isAdmin && (
            <div className="hidden md:block flex-1 text-center">
              <span className="text-sm tracking-wide text-purple-500 font-medium">
                Режим администратора
              </span>
            </div>
          )}

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {user ? (
              <>
                {isAdmin ? (
                  /* Admin Navigation */
                  <div className="flex items-center gap-1 ml-auto">
                    <NavLink to="/admin" data-testid="admin-link">
                      <span className="flex items-center gap-2 text-purple-500">
                        <Settings className="w-4 h-4" />
                        Панель
                      </span>
                    </NavLink>
                    <AdminNotifications />
                    <NavLink to="/admin/orders" data-testid="admin-orders-link">
                      <span className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Заказы
                      </span>
                    </NavLink>
                    <NavLink to="/admin/chats" data-testid="admin-chats-link">
                      <span className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Чаты
                      </span>
                    </NavLink>
                    <NavLink to="/admin/profile" data-testid="admin-profile-link">
                      <User className="w-4 h-4" />
                    </NavLink>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={logout}
                      className="rounded-xl transition-all duration-300 text-slate-500 hover:text-red-500 hover:bg-red-100"
                      data-testid="logout-button"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  /* User Navigation - 4 icons evenly distributed with animations */
                  <>
                    <div className="flex items-center justify-evenly flex-1">
                      <NavLink to="/catalog" data-testid="search-link" className="md:hidden">
                        <Search className="w-4 h-4" />
                      </NavLink>
                      
                      {/* Заказы */}
                      <Link to="/orders" data-testid="orders-link">
                        <motion.div 
                          className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer"
                          initial="rest"
                          whileHover="hover"
                          whileTap={{ scale: 0.95 }}
                          variants={{
                            rest: { scale: 1, backgroundColor: "rgba(20, 184, 166, 0)" },
                            hover: { scale: 1.08, backgroundColor: "rgba(20, 184, 166, 0.1)" }
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <motion.div
                            variants={{
                              rest: { rotate: 0, color: "#475569" },
                              hover: { rotate: [0, -10, 10, -10, 0], color: "#0d9488" }
                            }}
                            transition={{ duration: 0.5 }}
                          >
                            <Package className="w-5 h-5" />
                          </motion.div>
                          <motion.span 
                            className="hidden lg:inline text-sm font-medium"
                            variants={{
                              rest: { color: "#475569" },
                              hover: { color: "#0d9488" }
                            }}
                          >
                            Заказы
                          </motion.span>
                        </motion.div>
                      </Link>
                      
                      {/* Бонусы */}
                      <Link to="/bonus" data-testid="bonus-link">
                        <motion.div 
                          className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer"
                          initial="rest"
                          whileHover="hover"
                          whileTap={{ scale: 0.95 }}
                          variants={{
                            rest: { scale: 1, backgroundColor: "rgba(16, 185, 129, 0)" },
                            hover: { scale: 1.08, backgroundColor: "rgba(16, 185, 129, 0.15)" }
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <motion.div
                            variants={{
                              rest: { rotate: 0, scale: 1 },
                              hover: { rotate: 360, scale: 1.2 }
                            }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          >
                            <Gift className="w-5 h-5 text-emerald-500" />
                          </motion.div>
                          <motion.span 
                            className="hidden lg:inline text-sm font-bold text-emerald-500"
                            variants={{
                              rest: { color: "#10b981" },
                              hover: { color: "#059669" }
                            }}
                          >
                            Бонусы
                          </motion.span>
                        </motion.div>
                      </Link>
                      
                      {/* Новости */}
                      <Link to="/news" data-testid="news-link">
                        <motion.div 
                          className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer"
                          initial="rest"
                          whileHover="hover"
                          whileTap={{ scale: 0.95 }}
                          variants={{
                            rest: { scale: 1, backgroundColor: "rgba(59, 130, 246, 0)" },
                            hover: { scale: 1.08, backgroundColor: "rgba(59, 130, 246, 0.1)" }
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <motion.div
                            variants={{
                              rest: { y: 0, color: "#475569" },
                              hover: { y: [0, -4, 0, -4, 0], color: "#3b82f6" }
                            }}
                            transition={{ duration: 0.5 }}
                          >
                            <Newspaper className="w-5 h-5" />
                          </motion.div>
                          <motion.span 
                            className="hidden lg:inline text-sm font-medium"
                            variants={{
                              rest: { color: "#475569" },
                              hover: { color: "#3b82f6" }
                            }}
                          >
                            Новости
                          </motion.span>
                        </motion.div>
                      </Link>
                      
                      {/* Корзина */}
                      <Link to="/cart" data-testid="cart-link">
                        <motion.div 
                          className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer relative"
                          initial="rest"
                          whileHover="hover"
                          whileTap={{ scale: 0.95 }}
                          variants={{
                            rest: { scale: 1, backgroundColor: "rgba(249, 115, 22, 0)" },
                            hover: { scale: 1.08, backgroundColor: "rgba(249, 115, 22, 0.1)" }
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                          <motion.div
                            variants={{
                              rest: { x: 0, color: "#475569" },
                              hover: { x: [0, -3, 3, -3, 0], color: "#f97316" }
                            }}
                            transition={{ duration: 0.4 }}
                          >
                            <ShoppingCart className="w-5 h-5" />
                          </motion.div>
                          <motion.span 
                            className="hidden lg:inline text-sm font-medium"
                            variants={{
                              rest: { color: "#475569" },
                              hover: { color: "#f97316" }
                            }}
                          >
                            Корзина
                          </motion.span>
                          {cartCount > 0 && (
                            <motion.span 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              variants={{
                                rest: { scale: 1 },
                                hover: { scale: 1.2 }
                              }}
                              className="absolute -top-1 -right-1 lg:relative lg:top-0 lg:right-0 lg:ml-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs w-5 h-5 flex items-center justify-center font-bold rounded-full shadow-lg"
                            >
                              {cartCount}
                            </motion.span>
                          )}
                        </motion.div>
                      </Link>
                    </div>
                    {/* Balance indicator */}
                    {userBalance !== null && (
                      <Link to="/account" data-testid="header-balance">
                        <motion.div 
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/60 cursor-pointer"
                          whileHover={{ scale: 1.05, borderColor: 'rgba(20,184,166,0.5)' }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Wallet className="w-4 h-4 text-teal-500" />
                          <span className="text-sm font-bold text-teal-700">{new Intl.NumberFormat('ru-RU').format(userBalance)} ₽</span>
                        </motion.div>
                      </Link>
                    )}
                    {/* Expandable Profile Menu */}
                    <ExpandableProfileMenu onLogout={logout} unreadCount={notificationCount} />
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 ml-auto">
                <Link to="/login" data-testid="login-link">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button className="font-bold uppercase tracking-wide rounded-xl shadow-lg shadow-teal-500/30 transition-all duration-300 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
                      Войти
                    </Button>
                  </motion.div>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            {user && (
              <Link to="/cart" className="relative p-2">
                <ShoppingCart className="w-5 h-5 text-slate-500" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-teal-500 text-white text-xs w-4 h-4 flex items-center justify-center font-bold rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-500 hover:text-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-cyan-200/50 bg-white/90 backdrop-blur-xl"
          >
            <div className="p-4 space-y-2">
              {user ? (
                <>
                  {isAdmin ? (
                    <>
                      <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-purple-500 hover:bg-purple-50">
                        <Settings className="w-5 h-5" />
                        Панель управления
                      </Link>
                      <Link to="/admin/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                        <ClipboardList className="w-5 h-5" />
                        Заказы
                      </Link>
                      <Link to="/admin/chats" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                        <MessageCircle className="w-5 h-5" />
                        Чаты
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/catalog" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                        <Search className="w-5 h-5" />
                        Каталог
                      </Link>
                      <Link to="/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                        <Package className="w-5 h-5" />
                        Мои заказы
                      </Link>
                      <Link to="/bonus" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-teal-500 hover:bg-teal-50">
                        <Gift className="w-5 h-5" />
                        Бонусы
                      </Link>
                      <Link to="/favorites" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                        <Heart className="w-5 h-5" />
                        Избранное
                      </Link>
                      <Link to="/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                        <User className="w-5 h-5" />
                        Профиль
                      </Link>
                      {userBalance !== null && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/50" data-testid="mobile-balance">
                          <Wallet className="w-5 h-5 text-teal-500" />
                          <span className="text-sm font-bold text-teal-700">Баланс: {new Intl.NumberFormat('ru-RU').format(userBalance)} ₽</span>
                        </div>
                      )}
                    </>
                  )}
                  <button 
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 w-full"
                  >
                    <LogOut className="w-5 h-5" />
                    Выйти
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full font-bold uppercase bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl">
                    Войти
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
