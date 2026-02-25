import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, LogOut, Settings, Heart, Package, ClipboardList, Gift, Newspaper, Menu, X, MessageCircle, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Button } from './ui/button';
import { AdminNotifications } from './AdminNotifications';
import { ClientNotifications } from './ClientNotifications';
import { HeaderPromoBanner } from './HeaderPromoBanner';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Expandable Profile Menu Component
const ExpandableProfileMenu = ({ onLogout, onExpandChange, unreadCount = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const timeoutRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsExpanded(false);
        onExpandChange?.(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onExpandChange]);

  const handleProfileClick = () => {
    if (!isExpanded) {
      // First click - expand
      setIsExpanded(true);
      onExpandChange?.(true);
      // Auto-close after 4 seconds of inactivity
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
        onExpandChange?.(false);
      }, 4000);
    } else {
      // Second click - navigate to profile
      setIsExpanded(false);
      onExpandChange?.(false);
      navigate('/account');
    }
  };

  const handleItemClick = (action) => {
    setIsExpanded(false);
    onExpandChange?.(false);
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
      transition: {
        duration: 0.15
      }
    }
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Profile button - larger and more prominent */}
      <motion.button
        onClick={handleProfileClick}
        className={`relative p-3 rounded-2xl transition-all duration-300 ${
          isExpanded 
            ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-xl shadow-teal-500/40 scale-105' 
            : 'bg-gradient-to-br from-teal-50 to-emerald-50 text-teal-600 border-2 border-teal-200 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/20'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        data-testid="profile-menu-trigger"
      >
        <User className="w-5 h-5" />
        {/* Unread notification badge */}
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

      {/* Dropdown menu - expands downward */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="absolute right-0 top-full mt-2 flex flex-col gap-2 z-50"
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* 1. Notifications */}
            <motion.div custom={0} variants={iconVariants}>
              <ClientNotifications onClose={() => handleItemClick(() => {})} />
            </motion.div>

            {/* 2. Favorites */}
            <motion.div custom={1} variants={iconVariants}>
              <Link 
                to="/favorites" 
                onClick={() => handleItemClick(() => {})}
                className="flex items-center justify-center p-3 rounded-xl bg-white/95 backdrop-blur-sm border border-slate-200 text-slate-500 hover:text-pink-500 hover:bg-pink-50 hover:border-pink-300 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
                data-testid="favorites-link"
              >
                <Heart className="w-5 h-5" />
              </Link>
            </motion.div>

            {/* 3. Logout - reddish tint */}
            <motion.div custom={2} variants={iconVariants}>
              <button
                onClick={() => handleItemClick(onLogout)}
                className="flex items-center justify-center p-3 rounded-xl bg-red-50 backdrop-blur-sm border border-red-200 text-red-400 hover:text-red-600 hover:bg-red-100 hover:border-red-400 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
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
  
  const isAdmin = user?.role === 'admin';

  // Fetch notification count for profile badge
  useEffect(() => {
    if (user && !isAdmin) {
      const fetchNotificationCount = async () => {
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/my-notifications`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          const data = await res.json();
          setNotificationCount(data.unread_count || 0);
        } catch (err) {}
      };
      fetchNotificationCount();
      const interval = setInterval(fetchNotificationCount, 15000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin]);

  const NavLink = ({ to, children, className = '' }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        className={`relative px-3 py-2 text-sm font-medium transition-all duration-300 rounded-xl
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
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo + Promo Banner on left */}
          <div className="flex items-center">
            <Link to={isAdmin ? "/admin" : "/"} className="flex-shrink-0 group" data-testid="logo-link">
              <motion.h1 
                className="text-xl font-bold uppercase tracking-tight bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                avopt.store
              </motion.h1>
            </Link>
            
            {/* Promo Banner - Left side, only for non-admin */}
            {!isAdmin && <HeaderPromoBanner />}
          </div>
          
          {/* Admin indicator (only for admin) - center */}
          {isAdmin && (
            <div className="hidden md:block flex-1 text-center">
              <span className="text-sm tracking-wide text-purple-500 font-medium">
                Режим администратора
              </span>
            </div>
          )}

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {user ? (
              <>
                {isAdmin ? (
                  /* Admin Navigation */
                  <>
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
                  </>
                ) : (
                  /* User Navigation */
                  <>
                    <NavLink to="/catalog" data-testid="search-link">
                      <Search className="w-4 h-4" />
                    </NavLink>
                    <NavLink to="/orders" data-testid="orders-link">
                      <span className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span className="hidden lg:inline">Заказы</span>
                      </span>
                    </NavLink>
                    <NavLink to="/bonus" data-testid="bonus-link">
                      <span className="flex items-center gap-2 text-teal-500">
                        <Gift className="w-4 h-4" />
                        <span className="hidden lg:inline">Бонусы</span>
                      </span>
                    </NavLink>
                    <NavLink to="/news" data-testid="news-link">
                      <Newspaper className="w-4 h-4" />
                    </NavLink>
                    <NavLink to="/cart" data-testid="cart-link">
                      <span className="relative">
                        <ShoppingCart className="w-4 h-4" />
                        {cartCount > 0 && (
                          <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 bg-teal-500 text-white text-xs w-4 h-4 flex items-center justify-center font-bold rounded-full"
                          >
                            {cartCount}
                          </motion.span>
                        )}
                      </span>
                    </NavLink>
                    {/* Expandable Profile Menu */}
                    <ExpandableProfileMenu onLogout={logout} unreadCount={notificationCount} />
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
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
