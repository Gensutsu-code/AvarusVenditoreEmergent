import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Button } from './ui/button';

export const Header = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-zinc-200" data-testid="header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0" data-testid="logo-link">
            <h1 className="text-lg font-bold uppercase tracking-tight text-zinc-900">
              avarus-Venditore
            </h1>
          </Link>

          {/* Navigation */}
          <nav className="hidden sm:flex items-center gap-6">
            <Link 
              to="/catalog" 
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-2"
              data-testid="nav-search"
            >
              <Search className="w-4 h-4" />
              Поиск запчастей
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to="/cart" data-testid="cart-link">
                  <Button variant="ghost" className="relative">
                    <ShoppingCart className="w-5 h-5" />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 flex items-center justify-center font-bold">
                        {cartCount}
                      </span>
                    )}
                  </Button>
                </Link>
                <Link to="/account" data-testid="account-link">
                  <Button variant="ghost">
                    <User className="w-5 h-5" />
                  </Button>
                </Link>
                <Button variant="ghost" onClick={logout} data-testid="logout-button">
                  <LogOut className="w-5 h-5" />
                </Button>
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
