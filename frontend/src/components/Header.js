import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, LogOut, Heart, Package, Gift, Newspaper, Menu, X, MessageCircle, Bell, Wallet, CreditCard } from 'lucide-react';
import { AdminDesktopNav, AdminMobileNav } from './admin/AdminNav';
import { RegionWarehouses } from './RegionWarehouses';
import { useFeatures } from '../context/FeaturesContext';
import { Sparkles as AiIcon, Briefcase as ManagerIcon, Warehouse as GarageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Button } from './ui/button';
import { AdminNotifications } from './AdminNotifications';
import { SearchDropdown } from './SearchDropdown';
import { MiniCart } from './MiniCart';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import axios from 'axios';
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

  // Cleanup auto-collapse timer on unmount — otherwise the ref-closure can
  // outlive the component during route changes and trip third-party walkers.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
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
  const { isOn } = useFeatures();
  const showPartsHub = isOn('ai_assistant') || isOn('parts_finder');
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [userBalance, setUserBalance] = useState(null);
  const [creditInfo, setCreditInfo] = useState(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(null);
  const lastSeenCountRef = useRef(0);
  const hasInitRef = useRef(false);
  const lastToastTimeRef = useRef(0);
  
  const isAdmin = user?.role === 'admin';

  // Floating "+N баллов" in the header right after an order is placed
  useEffect(() => {
    const handler = (e) => {
      const amount = Math.round(e.detail?.amount || 0);
      if (amount <= 0) return;
      setPointsEarned(amount);
      setTimeout(() => setPointsEarned(null), 3800);
    };
    window.addEventListener('bonus-points-earned', handler);
    return () => window.removeEventListener('bonus-points-earned', handler);
  }, []);

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

      // Always fetch balance regardless of notification settings
      const balanceRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/balance`, { headers });
      const balanceData = await balanceRes.json();
      setUserBalance(balanceData.balance ?? 0);

      // Credit (deferral) info
      try {
        const creditRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/credit/my`, { headers });
        const creditData = await creditRes.json();
        setCreditInfo(creditData && creditData.status === 'approved' ? creditData : null);
      } catch (e) { /* ignore */ }

      // Chat unread count (for "Связь" badge)
      try {
        const chatRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/chat/unread-count`, { headers });
        const chatData = await chatRes.json();
        setChatUnread(chatData.count || 0);
      } catch (e) { /* ignore */ }

      // Skip notification polling if disabled by admin
      if (!clientNotifsEnabledRef.current) {
        setNotificationCount(0);
        return;
      }

      const notifRes = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/my-notifications`, { headers });
      const notifData = await notifRes.json();
      const newCount = notifData.unread_count || 0;
      setNotificationCount(newCount);

      // On first load, just set the baseline
      if (!hasInitRef.current) {
        lastSeenCountRef.current = newCount;
        hasInitRef.current = true;
        return;
      }

      // If new unread notifications appeared since last poll
      if (newCount > lastSeenCountRef.current) {
        const now = Date.now();
        // Debounce: skip toast if another toast was shown in last 8 seconds
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
        // Push notification only when tab is hidden
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

  const NavLink = ({ to, children, className = '', ...rest }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        {...rest}
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

  // Managers work only in their cabinet, the AI assistant and their profile
  if (user?.role === 'manager') {
    const mLink = (to, label, Icon, testid) => (
      <Link to={to} className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-sm font-semibold transition-colors duration-200 ${location.pathname.startsWith(to) ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`} data-testid={testid}>
        <Icon className="w-4 h-4" /><span className="hidden sm:inline">{label}</span>
      </Link>
    );
    return (
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b bg-white/70 border-cyan-200/50" data-testid="manager-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-16 gap-2">
          <Link to="/manager" className="mr-auto text-xl font-bold uppercase tracking-tight bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent" data-testid="logo-link">avopt.store</Link>
          {mLink('/manager', 'Кабинет менеджера', ManagerIcon, 'manager-cabinet-link')}
          {isOn('ai_assistant') && mLink('/parts', 'ИИ-помощник', AiIcon, 'parts-hub-link')}
          {mLink('/account', 'Профиль', User, 'manager-profile-link')}
          <button type="button" onClick={logout} className="p-2 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-100 transition-colors duration-200" title="Выйти" data-testid="logout-button">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl border-b bg-white/70 border-cyan-200/50" data-testid="header">
      <div className="max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-3">
          {/* Logo */}
          <Link to={isAdmin ? "/admin" : "/"} className="flex-shrink-0 group flex items-center min-h-[40px]" data-testid="logo-link">
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
              <div className="w-36 xl:w-48 min-[1700px]:w-64">
                <SearchDropdown 
                  placeholder="Поиск..." 
                  compact={true}
                />
              </div>
              {user.role === 'manager' && (
                <Link to="/manager" className="h-10 px-3 rounded-xl flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-700 transition-colors duration-200 text-sm font-semibold whitespace-nowrap" data-testid="manager-cabinet-link">
                  <ManagerIcon className="w-4 h-4" /><span className="hidden lg:inline">Кабинет менеджера</span>
                </Link>
              )}
              {showPartsHub && (
                <Link to="/parts" className="h-10 px-3 rounded-xl flex items-center gap-1.5 bg-gradient-to-br from-teal-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-teal-500/30 transition-shadow duration-300 font-semibold text-sm whitespace-nowrap" title="Подбор запчастей: ИИ-помощник и подбор по параметрам" data-testid="parts-hub-link">
                  <AiIcon className="w-4 h-4" /> Подбор
                </Link>
              )}
              <NavLink to="/catalog" data-testid="search-page-link">
                <motion.div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600 border-2 border-teal-200 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/20 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Search className="w-5 h-5" />
                </motion.div>
              </NavLink>
              <RegionWarehouses />
            </div>
          )}
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {user ? (
              <>
                {isAdmin ? (
                  /* Admin Navigation */
                  <AdminDesktopNav onLogout={logout} notifications={<AdminNotifications />} />
                ) : (
                  /* User Navigation - 4 icons evenly distributed with animations */
                  <>
                    <div className="flex items-center justify-evenly flex-1">
                      <NavLink to="/catalog" data-testid="search-link" className="md:hidden">
                        <Search className="w-4 h-4" />
                      </NavLink>
                      
                      {/* Заказы */}
                      <Link to="/garage" data-testid="garage-link" title="Мой гараж" className="h-10 px-3 rounded-xl flex items-center gap-1.5 bg-white/95 border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600 transition-colors duration-200 text-sm font-medium whitespace-nowrap">
                        <GarageIcon className="w-4 h-4 text-teal-500" /><span className="hidden min-[1700px]:inline">Гараж</span>
                      </Link>
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
                            className="hidden xl:inline text-sm font-medium"
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
                      <Link to="/bonus" data-testid="bonus-link" className="relative">
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
                            animate={pointsEarned ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.35, 1] } : {}}
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

                        {/* Floating "+N баллов" after order */}
                        <AnimatePresence>
                          {pointsEarned && (
                            <motion.div
                              className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 flex items-center gap-1 whitespace-nowrap pointer-events-none z-50"
                              initial={{ opacity: 0, y: -4, scale: 0.7 }}
                              animate={{ opacity: [0, 1, 1, 0], y: [-4, -14, -22, -34], scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 3.6, times: [0, 0.12, 0.7, 1], ease: 'easeOut' }}
                              data-testid="header-points-earned"
                            >
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-500/40 tabular-nums">
                                +{new Intl.NumberFormat('ru-RU').format(pointsEarned)} баллов
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
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
                            className="hidden xl:inline text-sm font-medium"
                            variants={{
                              rest: { color: "#475569" },
                              hover: { color: "#3b82f6" }
                            }}
                          >
                            Новости
                          </motion.span>
                        </motion.div>
                      </Link>
                      
                      {/* Связь с админом */}
                      <Link to="/contact" data-testid="contact-link">
                        <motion.div 
                          className="relative flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer"
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
                            className="relative"
                            variants={{
                              rest: { rotate: 0, color: "#475569" },
                              hover: { rotate: [0, -10, 10, 0], color: "#0d9488" }
                            }}
                            transition={{ duration: 0.5 }}
                          >
                            <MessageCircle className="w-5 h-5" />
                            {chatUnread > 0 && (
                              <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full" data-testid="contact-unread-badge">
                                {chatUnread > 9 ? '9+' : chatUnread}
                              </span>
                            )}
                          </motion.div>
                          <motion.span 
                            className="hidden xl:inline text-sm font-medium"
                            variants={{ rest: { color: "#475569" }, hover: { color: "#0d9488" } }}
                          >
                            Связь
                          </motion.span>
                        </motion.div>
                      </Link>

                      {/* Корзина */}
                      <MiniCart />
                    </div>
                    {/* Balance indicator */}
                    {userBalance !== null && (
                      <Link to="/account" data-testid="header-balance">
                        <motion.div 
                          className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/60 cursor-pointer whitespace-nowrap"
                          whileHover={{ scale: 1.05, borderColor: 'rgba(20,184,166,0.5)' }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Wallet className="w-4 h-4 text-teal-500 shrink-0" />
                          <span className="text-sm font-bold text-teal-700 leading-none">{new Intl.NumberFormat('ru-RU').format(Math.round(userBalance))} ₽</span>
                        </motion.div>
                      </Link>
                    )}
                    {/* Credit (deferral) balance indicator */}
                    {creditInfo && (
                      <Link to="/credit" data-testid="header-credit-balance">
                        <motion.div
                          className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200/60 cursor-pointer whitespace-nowrap"
                          whileHover={{ scale: 1.05, borderColor: 'rgba(139,92,246,0.5)' }}
                          whileTap={{ scale: 0.97 }}
                          title="Доступный лимит отсрочки"
                        >
                          <CreditCard className="w-4 h-4 text-violet-500 shrink-0" />
                          <span className="text-sm font-bold text-violet-700 leading-none">{new Intl.NumberFormat('ru-RU').format(Math.round(creditInfo.available))} ₽</span>
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
                {showPartsHub && (
                  <Link to="/parts" className="h-10 px-3 rounded-xl flex items-center gap-1.5 bg-white/95 border border-teal-200 text-teal-600 hover:border-teal-400 transition-colors duration-200 text-sm font-semibold whitespace-nowrap" title="Подбор запчастей: ИИ-помощник и подбор по параметрам" data-testid="parts-hub-link-guest">
                    <AiIcon className="w-4 h-4" /><span className="hidden sm:inline">Подбор запчастей</span>
                  </Link>
                )}
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
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              aria-label="Меню"
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
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
              {user && !isAdmin && (
                <>
                <div className="pb-2 mb-1 border-b border-slate-100"><RegionWarehouses onNavigate={() => setMobileMenuOpen(false)} /></div>
                </>
              )}
              {user ? (
                <>
                  {isAdmin ? (
                    <AdminMobileNav onNavigate={() => setMobileMenuOpen(false)} />
                  ) : (
                    <>
                      <Link to="/catalog" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                        <Search className="w-5 h-5" />
                        Каталог
                      </Link>
                      {user?.role === 'manager' && <Link to="/manager" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-800 hover:bg-slate-50 font-semibold" data-testid="manager-cabinet-link-mobile"><ManagerIcon className="w-5 h-5" /><span>Кабинет менеджера</span></Link>}
                      {showPartsHub && <Link to="/parts" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-teal-600 hover:bg-teal-50 font-medium" data-testid="parts-hub-link-mobile"><AiIcon className="w-5 h-5" /><span>Подбор запчастей</span></Link>}
                      <Link to="/garage" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50" data-testid="garage-link-mobile"><GarageIcon className="w-5 h-5" /><span className="font-medium">Мой гараж</span></Link>
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
                      <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                        <MessageCircle className="w-5 h-5" />
                        Связь с админом
                      </Link>
                      <Link to="/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                        <User className="w-5 h-5" />
                        Профиль
                      </Link>
                      {userBalance !== null && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/50" data-testid="mobile-balance">
                          <Wallet className="w-5 h-5 text-teal-500 shrink-0" />
                          <span className="text-sm font-bold text-teal-700">Баланс: {new Intl.NumberFormat('ru-RU').format(Math.round(userBalance))} ₽</span>
                        </div>
                      )}
                      {creditInfo && (
                        <Link to="/credit" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200/50" data-testid="mobile-credit-balance">
                          <CreditCard className="w-5 h-5 text-violet-500 shrink-0" />
                          <span className="text-sm font-bold text-violet-700">Отсрочка: {new Intl.NumberFormat('ru-RU').format(Math.round(creditInfo.available))} ₽</span>
                        </Link>
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
                <>
                  <Link to="/catalog" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                    <Search className="w-5 h-5" />
                    Каталог
                  </Link>
                  {showPartsHub && <Link to="/parts" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-teal-600 hover:bg-teal-50 font-medium" data-testid="parts-hub-link-mobile"><AiIcon className="w-5 h-5" /><span>Подбор запчастей</span></Link>}
                  <Link to="/news" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                    <Newspaper className="w-5 h-5" />
                    Новости
                  </Link>
                  <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-slate-600 hover:bg-slate-50">
                    <MessageCircle className="w-5 h-5" />
                    Связь с админом
                  </Link>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full font-bold uppercase bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl mt-1">
                      Войти
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
