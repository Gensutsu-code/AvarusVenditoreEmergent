import "@/App.css";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { IndividualPriceProvider } from "./context/IndividualPriceContext";
import { RegionProvider } from "./context/RegionContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { Header } from "./components/Header";
import { ChatWidget } from "./components/ChatWidget";
import { FloatingPromoBanner } from "./components/HeaderPromoBanner";
import { trackPageView } from "./utils/tracker";
import axios from "axios";

// Pages
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminChatsPage from "./pages/AdminChatsPage";
import AdminCartsPage from "./pages/AdminCartsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Footer from "./components/Footer";
import FavoritesPage from "./pages/FavoritesPage";
import OrdersPage from "./pages/OrdersPage";
import RewardsPage from "./pages/RewardsPage";
import AdminFeaturesPage from "./pages/AdminFeaturesPage";
import { FeaturesProvider, useFeatures } from "./context/FeaturesContext";
import NewsPage from "./pages/NewsPage";
import ProductPage from "./pages/ProductPage";
import NotificationsPage from "./pages/NotificationsPage";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";
import MaintenancePage from "./pages/MaintenancePage";
import ClientReturnsPage from "./pages/ClientReturnsPage";
import AdminReturnsPage from "./pages/AdminReturnsPage";
import AdminProductsPage from "./pages/AdminProductsPage";
import CreditPage from "./pages/CreditPage";
import AdminCreditPage from "./pages/AdminCreditPage";
import ContactPage from "./pages/ContactPage";
import WarehousesMapPage from "./pages/WarehousesMapPage";
import PartsFinderPage from "./pages/PartsFinderPage";
import AiAssistantPage from "./pages/AiAssistantPage";
import AdminStaffPage from "./pages/AdminStaffPage";
import ManagerPage from "./pages/ManagerPage";
import GaragePage from "./pages/GaragePage";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function PageMaintenanceBanner({ message }) {
  const { isDark } = useTheme();
  return (
    <div className={`flex flex-col items-center justify-center py-24 px-6 ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`} data-testid="page-maintenance-banner">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-teal-500/10 border border-teal-500/20'}`}>
        <svg className={`w-8 h-8 ${isDark ? 'text-orange-400' : 'text-teal-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"/>
        </svg>
      </div>
      <h2 className={`text-2xl font-bold mb-3 ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>Раздел на обслуживании</h2>
      <p className={`text-center max-w-md ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
        {message || 'Этот раздел временно недоступен. Пожалуйста, попробуйте позже.'}
      </p>
      <a
        href="/login"
        className={`mt-8 text-[11px] opacity-20 hover:opacity-60 transition-opacity ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
        data-testid="page-maintenance-admin-link"
      >
        Панель управления
      </a>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();
  const { isOn, blockedFeature, loaded: featuresLoaded } = useFeatures();
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '', pages: {} });
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);

  // Check maintenance status + poll every 15 seconds
  useEffect(() => {
    const check = () => {
      axios.get(`${API}/maintenance/status`)
        .then(r => setMaintenance(r.data))
        .catch(() => {})
        .finally(() => setMaintenanceChecked(true));
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  // Track page views for non-admin users
  useEffect(() => {
    if (user && !isAdmin) {
      trackPageView(location.pathname);
    }
  }, [location.pathname, user, isAdmin]);

  // Routes that must always be accessible (login, admin panel, auth flows)
  const isProtectedRoute = location.pathname === '/login' || location.pathname === '/register' || location.pathname.startsWith('/admin') || location.pathname === '/forgot-password' || location.pathname === '/reset-password';

  // Show maintenance page for non-admin users (allow login/register/admin routes for admin access)
  if (maintenanceChecked && maintenance.enabled && !loading && !isAdmin && !isProtectedRoute) {
    return <MaintenancePage message={maintenance.message} />;
  }

  // Per-page maintenance check — skip for login/admin routes
  const pageMaintenanceMap = {
    '/catalog': 'catalog',
    '/bonus': 'bonus',
    '/account': 'account',
    '/news': 'news',
    '/orders': 'orders',
    '/cart': 'cart',
    '/favorites': 'favorites',
  };
  const pageKey = Object.entries(pageMaintenanceMap).find(([route]) => location.pathname.startsWith(route))?.[1];
  const pageMaint = pageKey && maintenance.pages?.[pageKey];
  const isPageDown = pageMaint?.enabled && !isAdmin && !isProtectedRoute;

  // Managers only have their cabinet, the AI assistant and their profile
  const managerPaths = ['/manager', '/assistant', '/account'];
  if (user?.role === 'manager' && !managerPaths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) {
    return <Navigate to="/manager" replace />;
  }
  const isManager = user?.role === 'manager';

  // Pages of a switched-off function send everyone back to the start page
  if (featuresLoaded && blockedFeature(location.pathname)) {
    return <Navigate to={location.pathname.startsWith('/admin') ? '/admin' : '/'} replace />;
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-zinc-950' : 'bg-gradient-to-br from-cyan-50 via-pink-50 to-cyan-50'}`}>
      <Header />
      {!isAdmin && !isManager && location.pathname !== '/contact' && isOn('promo_banner') && <FloatingPromoBanner />}
      <main className="flex-1">
        {isPageDown ? (
          <PageMaintenanceBanner message={pageMaint.message} />
        ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
          <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/parts-finder" element={<PartsFinderPage />} />
          <Route path="/assistant" element={<AiAssistantPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<Navigate to="/cart" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/profile" element={<AdminProfilePage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/chats" element={<AdminChatsPage />} />
          <Route path="/admin/carts" element={<AdminCartsPage />} />
          <Route path="/admin/returns" element={<AdminReturnsPage />} />
          <Route path="/admin/staff" element={<AdminStaffPage />} />
          <Route path="/admin/features" element={<AdminFeaturesPage />} />
          <Route path="/manager" element={<ManagerPage />} />
          <Route path="/garage" element={<GaragePage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
          <Route path="/admin/credit" element={<AdminCreditPage />} />
          <Route path="/admin/warehouse" element={<Navigate to="/admin" replace />} />
          <Route path="/credit" element={<CreditPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/warehouses" element={<WarehousesMapPage />} />
          <Route path="/returns" element={<ClientReturnsPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/bonus" element={<RewardsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:newsId" element={<NewsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
        </Routes>
          </motion.div>
        </AnimatePresence>
        )}
      </main>
      {!isAdmin && !isManager && <Footer />}
      {!isAdmin && !isManager && isOn('chat') && <ChatWidget />}
      <Toaster position="top-center" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <IndividualPriceProvider>
              <RegionProvider>
                <FeaturesProvider>
                  <AppContent />
                </FeaturesProvider>
              </RegionProvider>
            </IndividualPriceProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
