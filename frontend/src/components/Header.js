import { Link } from 'react-router-dom';
import { ShoppingCart, User, Search, LogOut, Settings, Heart, Package, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Button } from './ui/button';

export const Header = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  
  const isAdmin = user?.role === 'admin';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-zinc-200" data-testid="header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to={isAdmin ? "/admin" : "/"} className="flex-shrink-0" data-testid="logo-link">
            <h1 className="text-xl font-bold uppercase tracking-tight text-zinc-900">
              avopt.store
            </h1>
          </Link>

          {/* Center - Brand name or Admin indicator */}
          <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2">
            <span className={`text-sm tracking-wide ${isAdmin ? 'text-purple-600 font-medium' : 'text-zinc-400'}`}>
              {isAdmin ? 'Режим администратора' : 'Avarus-Venditore'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {user ? (
              <>
                {isAdmin ? (
                  /* Admin Navigation - Simplified */
                  <>
                    <Link to="/admin" data-testid="admin-link">
                      <Button variant="ghost" size="sm" className="text-purple-600 flex items-center gap-1">
                        <Settings className="w-5 h-5" />
                        <span className="hidden sm:inline text-sm">Панель</span>
                      </Button>
                    </Link>
                    <Link to="/admin/orders" data-testid="admin-orders-link">
                      <Button variant="ghost" size="sm" className="flex items-center gap-1">
                        <ClipboardList className="w-5 h-5" />
                        <span className="hidden sm:inline text-sm">Заказы</span>
                      </Button>
                    </Link>
                    <Link to="/admin/profile" data-testid="admin-profile-link">
                      <Button variant="ghost" size="sm">
                        <User className="w-5 h-5" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={logout} data-testid="logout-button">
                      <LogOut className="w-5 h-5" />
                    </Button>
                  </>
                ) : (
                  /* User Navigation - Full */
                  <>
                    <Link to="/orders" data-testid="orders-link">
                      <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-1">
                        <Package className="w-5 h-5" />
                        <span className="text-sm">Заказы</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="sm:hidden">
                        <Package className="w-5 h-5" />
                      </Button>
                    </Link>
                    <Link to="/catalog" data-testid="search-link">
                      <Button variant="ghost" size="sm">
                        <Search className="w-5 h-5" />
                      </Button>
                    </Link>
                    <Link to="/favorites" data-testid="favorites-link">
                      <Button variant="ghost" size="sm">
                        <Heart className="w-5 h-5" />
                      </Button>
                    </Link>
                    <Link to="/cart" data-testid="cart-link">
                      <Button variant="ghost" size="sm" className="relative">
                        <ShoppingCart className="w-5 h-5" />
                        {cartCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 flex items-center justify-center font-bold">
                            {cartCount}
                          </span>
                        )}
                      </Button>
                    </Link>
                    <Link to="/account" data-testid="account-link">
                      <Button variant="ghost" size="sm">
                        <User className="w-5 h-5" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={logout} data-testid="logout-button">
                      <LogOut className="w-5 h-5" />
                    </Button>
                  </>
                )}
              </>
            ) : (
              <Link to="/login" data-testid="login-link">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide">
                  Войти
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
