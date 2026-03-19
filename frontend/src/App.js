import "@/App.css";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
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
import CheckoutPage from "./pages/CheckoutPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminChatsPage from "./pages/AdminChatsPage";
import AdminCartsPage from "./pages/AdminCartsPage";
import PersonalFilesPage from "./pages/PersonalFilesPage";
import FavoritesPage from "./pages/FavoritesPage";
import OrdersPage from "./pages/OrdersPage";
import BonusPage from "./pages/BonusPage";
import NewsPage from "./pages/NewsPage";
import ProductPage from "./pages/ProductPage";
import NotificationsPage from "./pages/NotificationsPage";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";
import MaintenancePage from "./pages/MaintenancePage";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function AppContent() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);

  // Check maintenance status
  useEffect(() => {
    axios.get(`${API}/maintenance/status`)
      .then(r => setMaintenance(r.data))
      .catch(() => {})
      .finally(() => setMaintenanceChecked(true));
  }, []);

  // Track page views for non-admin users
  useEffect(() => {
    if (user && !isAdmin) {
      trackPageView(location.pathname);
    }
  }, [location.pathname, user, isAdmin]);

  // Show maintenance page for non-admin users (allow login route for admin access)
  if (maintenanceChecked && maintenance.enabled && !loading && !isAdmin && location.pathname !== '/login') {
    return <MaintenancePage message={maintenance.message} />;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : 'bg-gradient-to-br from-cyan-50 via-pink-50 to-cyan-50'}`}>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/profile" element={<AdminProfilePage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/chats" element={<AdminChatsPage />} />
          <Route path="/admin/carts" element={<AdminCartsPage />} />
          <Route path="/admin/personal-files" element={<PersonalFilesPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/bonus" element={<BonusPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:newsId" element={<NewsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
        </Routes>
      </main>
      {!isAdmin && <FloatingPromoBanner />}
      {!isAdmin && <ChatWidget />}
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
            <AppContent />
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
