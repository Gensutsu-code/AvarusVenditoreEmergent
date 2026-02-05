import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { Header } from "./components/Header";
import { PromoBanner } from "./components/PromoBanner";
import { ChatWidget } from "./components/ChatWidget";

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
import FavoritesPage from "./pages/FavoritesPage";
import OrdersPage from "./pages/OrdersPage";

function AppContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-white">
      <Header />
      {/* Hide promo banner for admin */}
      {!isAdmin && <PromoBanner />}
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
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Routes>
      </main>
      {/* Hide chat widget for admin */}
      {!isAdmin && <ChatWidget />}
      <Toaster position="top-center" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
