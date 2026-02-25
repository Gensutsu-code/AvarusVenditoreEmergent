import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, User, Search, LogOut, Settings, Heart, Package, ClipboardList, Gift, Newspaper, Menu, X, Sun, Moon, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import { AdminNotifications } from './AdminNotifications';
import { ClientNotifications } from './ClientNotifications';
import { HeaderPromoBanner } from './HeaderPromoBanner';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const Header = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isAdmin = user?.role === 'admin';

  const NavLink = ({ to, children, className = '' }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        className={`relative px-3 py-2 text-sm font-medium transition-all duration-300 rounded-xl
          ${isActive 
            ? isDark ? 'text-orange-400 bg-orange-500/10' : 'text-teal-600 bg-teal-500/10'
            : isDark ? 'text-zinc-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
          } ${className}`}
      >
        {children}
        {isActive && (
          <motion.div
            layoutId="activeTab"
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isDark ? 'bg-orange-500' : 'bg-green-500'}`}
          />
        )}
      </Link>
    );
  };

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${isDark ? 'bg-zinc-950/80 border-white/10' : 'bg-white/70 border-cyan-200/50'}`} data-testid="header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo + Promo Banner on left */}
          <div className="flex items-center">
            <Link to={isAdmin ? "/admin" : "/"} className="flex-shrink-0 group" data-testid="logo-link">
              <motion.h1 
                className={`text-xl font-bold uppercase tracking-tight bg-gradient-to-r ${isDark ? 'from-orange-400 to-orange-600' : 'from-emerald-500 to-teal-600'} bg-clip-text text-transparent`}
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
              <span className="text-sm tracking-wide text-purple-400 font-medium">
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
                      <span className="flex items-center gap-2 text-purple-400">
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
                    {/* Theme Toggle for Admin */}
                    <motion.button
                      onClick={toggleTheme}
                      className={`p-2 rounded-xl transition-all duration-300 ${isDark ? 'text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                      whileHover={{ scale: 1.05, rotate: 15 }}
                      whileTap={{ scale: 0.95 }}
                      data-testid="admin-theme-toggle"
                    >
                      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </motion.button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={logout}
                      className={`rounded-xl transition-all duration-300 ${isDark ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-500 hover:bg-red-100'}`}
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
                      <span className="flex items-center gap-2 text-orange-400">
                        <Gift className="w-4 h-4" />
                        <span className="hidden lg:inline">Бонусы</span>
                      </span>
                    </NavLink>
                    <NavLink to="/news" data-testid="news-link">
                      <Newspaper className="w-4 h-4" />
                    </NavLink>
                    <NavLink to="/favorites" data-testid="favorites-link">
                      <Heart className="w-4 h-4" />
                    </NavLink>
                    <NavLink to="/cart" data-testid="cart-link">
                      <span className="relative">
                        <ShoppingCart className="w-4 h-4" />
                        {cartCount > 0 && (
                          <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs w-4 h-4 flex items-center justify-center font-bold rounded-full"
                          >
                            {cartCount}
                          </motion.span>
                        )}
                      </span>
                    </NavLink>
                    <NavLink to="/account" data-testid="account-link">
                      <User className="w-4 h-4" />
                    </NavLink>
                    <ClientNotifications />
                    {/* Theme Toggle */}
                    <motion.button
                      onClick={toggleTheme}
                      className={`p-2 rounded-xl transition-all duration-300 ${isDark ? 'text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                      whileHover={{ scale: 1.05, rotate: 15 }}
                      whileTap={{ scale: 0.95 }}
                      data-testid="theme-toggle"
                    >
                      <AnimatePresence mode="wait">
                        {isDark ? (
                          <motion.div
                            key="sun"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Sun className="w-4 h-4" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="moon"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -90, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Moon className="w-4 h-4" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={logout}
                      className={`rounded-xl transition-all duration-300 ${isDark ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-500 hover:bg-red-100'}`}
                      data-testid="logout-button"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                {/* Theme Toggle for Guest */}
                <motion.button
                  onClick={toggleTheme}
                  className={`p-2 rounded-xl transition-all duration-300 ${isDark ? 'text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                  whileHover={{ scale: 1.05, rotate: 15 }}
                  whileTap={{ scale: 0.95 }}
                  data-testid="guest-theme-toggle"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </motion.button>
                <Link to="/login" data-testid="login-link">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button className={`font-bold uppercase tracking-wide rounded-xl shadow-glow transition-all duration-300 ${isDark ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white' : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-green-600 hover:to-emerald-700 text-white'}`}>
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
                <ShoppingCart className="w-5 h-5 text-zinc-400" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-4 h-4 flex items-center justify-center font-bold rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-zinc-400 hover:text-white"
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
            className="md:hidden bg-zinc-900/95 backdrop-blur-xl border-t border-white/10"
          >
            <div className="px-4 py-4 space-y-2">
              {user ? (
                <>
                  {isAdmin ? (
                    <>
                      <Link to="/admin" className="flex items-center gap-3 px-4 py-3 text-purple-400 hover:bg-white/5 rounded-xl transition-all" onClick={() => setMobileMenuOpen(false)}>
                        <Settings className="w-5 h-5" /> Панель управления
                      </Link>
                      <Link to="/admin/orders" className="flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-white/5 rounded-xl transition-all" onClick={() => setMobileMenuOpen(false)}>
                        <ClipboardList className="w-5 h-5" /> Заказы
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/catalog" className="flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-white/5 rounded-xl transition-all" onClick={() => setMobileMenuOpen(false)}>
                        <Search className="w-5 h-5" /> Каталог
                      </Link>
                      <Link to="/orders" className="flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-white/5 rounded-xl transition-all" onClick={() => setMobileMenuOpen(false)}>
                        <Package className="w-5 h-5" /> Мои заказы
                      </Link>
                      <Link to="/bonus" className="flex items-center gap-3 px-4 py-3 text-orange-400 hover:bg-white/5 rounded-xl transition-all" onClick={() => setMobileMenuOpen(false)}>
                        <Gift className="w-5 h-5" /> Бонусы
                      </Link>
                      <Link to="/favorites" className="flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-white/5 rounded-xl transition-all" onClick={() => setMobileMenuOpen(false)}>
                        <Heart className="w-5 h-5" /> Избранное
                      </Link>
                      <Link to="/account" className="flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-white/5 rounded-xl transition-all" onClick={() => setMobileMenuOpen(false)}>
                        <User className="w-5 h-5" /> Профиль
                      </Link>
                    </>
                  )}
                  <button 
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all w-full"
                  >
                    <LogOut className="w-5 h-5" /> Выйти
                  </button>
                </>
              ) : (
                <Link to="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold uppercase tracking-wide rounded-xl">
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
