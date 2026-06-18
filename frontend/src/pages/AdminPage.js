import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Package, ShoppingBag, TrendingUp, User,
  Plus, Pencil, Trash2, Save, Eye, FolderOpen, Megaphone, Upload, Image,
  MessageCircle, Send, BarChart3, Download, FileSpreadsheet, Pin, Tag, X, Copy, Gift, Award, ChevronDown, ChevronUp, Paperclip, Play, ZoomIn, ZoomOut, Settings, ChevronLeft, ChevronRight, CreditCard, FileText, Mail, Bell, Wallet, Clock, ScrollText, Code, Minus, RotateCcw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import RichTextEditor from '../components/RichTextEditor';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import UserAnalyticsModal from '../components/UserAnalyticsModal';
import { computeDiscount, formatDiscountBadge } from '../utils/productHelpers';

// Import admin tab components
import {
  PromoTab,
  TelegramTab,
  StatsTab,
  DiscountsTab,
  TermsTab,
  NotificationsTab,
  PartnersTab,
  PaymentsTab,
  CRMTab,
  MarketingTab,
  SettingsTab,
  LogsTab
} from '../components/admin';
import CryptoSettingsTab from '../components/admin/CryptoSettingsTab';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Admin Image Lightbox Component
const AdminImageLightbox = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  
  return (
    <div 
      className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full transition-colors z-10"
      >
        <X className="w-8 h-8" />
      </button>
      
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
          disabled={scale <= 0.5}
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-white text-sm font-medium w-16 text-center">{Math.round(scale * 100)}%</span>
        <button 
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
          disabled={scale >= 3}
        >
          <ZoomIn className="w-5 h-5" />
        </button>
      </div>
      
      <img 
        src={src} 
        alt="Увеличенное изображение"
        className="max-w-[90vw] max-h-[85vh] object-contain transition-transform duration-200"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// Admin Video Lightbox Component
const AdminVideoLightbox = ({ src, onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full transition-colors z-10"
      >
        <X className="w-8 h-8" />
      </button>
      
      <div 
        className="w-[90vw] max-w-4xl aspect-video"
        onClick={(e) => e.stopPropagation()}
      >
        <video 
          src={src} 
          controls
          autoPlay
          className="w-full h-full rounded-lg bg-black"
        >
          Ваш браузер не поддерживает видео
        </video>
      </div>
    </div>
  );
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesColumns, setCategoriesColumns] = useState(4);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null); // For filtering products by category
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promoBanner, setPromoBanner] = useState({ enabled: false, text: '', link: '', bg_color: '#f97316', height: 40, image: null, image_position: 'left' });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const productFileRef = useRef(null);
  const categoryFileRef = useRef(null);
  const promoFileRef = useRef(null);
  const importFileRef = useRef(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [analyticsUser, setAnalyticsUser] = useState(null);
  
  // Theme
  const { isDark } = useTheme();
  
  // Tab order state - New restructured order
  const defaultTabOrder = ['products', 'bonus', 'payments', 'crm', 'marketing', 'logs', 'settings'];
  const [tabOrder, setTabOrder] = useState(() => {
    const saved = localStorage.getItem('adminTabOrder');
    if (saved) {
      const order = JSON.parse(saved);
      // Migrate old tabs to new structure
      if (order.includes('orders') || order.includes('users')) {
        return defaultTabOrder;
      }
      // Remove crypto from main tabs (moved to payments)
      let filtered = order.filter(tab => tab !== 'crypto');
      // Add logs tab if missing (migration)
      if (!filtered.includes('logs')) {
        const settingsIdx = filtered.indexOf('settings');
        if (settingsIdx >= 0) filtered.splice(settingsIdx, 0, 'logs');
        else filtered.push('logs');
      }
      return filtered;
    }
    return defaultTabOrder;
  });
  const [activeTab, setActiveTab] = useState('products');
  const [editingTabOrder, setEditingTabOrder] = useState(false);
  
  // New states
  const [telegramSettings, setTelegramSettings] = useState({ enabled: false, bot_token: '', chat_id: '' });
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newAdminMessage, setNewAdminMessage] = useState('');
  const [extendedStats, setExtendedStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('month');
  const [importResult, setImportResult] = useState(null);
  
  // Lightbox states for admin chat
  const [adminLightboxImage, setAdminLightboxImage] = useState(null);
  const [adminLightboxVideo, setAdminLightboxVideo] = useState(null);
  
  // User management states
  const [editingUser, setEditingUser] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  
  // Order management states  
  const [editingOrder, setEditingOrder] = useState(null);
  
  // Bonus program states - Multiple programs
  const [bonusPrograms, setBonusPrograms] = useState([]);
  const [editingProgram, setEditingProgram] = useState(null);
  const [isNewProgram, setIsNewProgram] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [programUsers, setProgramUsers] = useState([]);
  const [bonusHistory, setBonusHistory] = useState([]);
  
  // Bonus states
  const [prizeRedemptions, setPrizeRedemptions] = useState([]);
  const [pointsModal, setPointsModal] = useState(null); // { action: 'add'|'remove', userId, userName, programId }
  const bonusImageFileRef = useRef(null);
  const bonusBannerFileRef = useRef(null);
  
  // Partners states
  const [partners, setPartners] = useState([]);
  const [editingPartner, setEditingPartner] = useState(null);
  const [isNewPartner, setIsNewPartner] = useState(false);
  const partnerImageRef = useRef(null);
  const [partnerImageUploading, setPartnerImageUploading] = useState(false);
  
  // User details expansion
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [paymentSettings, setPaymentSettings] = useState({ 
    card_discount: 0, crypto_discount: 0, cash_discount: 0,
    card_enabled: true, crypto_enabled: true, cash_enabled: true
  });
  const [newsList, setNewsList] = useState([]);
  const [editingNews, setEditingNews] = useState(null);
  const [newsForm, setNewsForm] = useState({ title: '', content: '', image_url: '' });
  const [cryptoWallets, setCryptoWallets] = useState({ eth_address: '', bsc_address: '', base_address: '', trc_address: '' });
  const [userDetails, setUserDetails] = useState(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  
  // Admin chat file upload
  const adminChatFileRef = useRef(null);
  const [adminChatUploading, setAdminChatUploading] = useState(false);

  // Terms of Service state
  const [termsSections, setTermsSections] = useState([]);
  const [termsSaving, setTermsSaving] = useState(false);

  // Prepayment settings state
  const [prepaymentSettings, setPrepaymentSettings] = useState({
    prepayment_enabled: true,
    min_topup_amount: 500,
    max_topup_amount: 100000
  });

  // Email notifications state
  const [notificationSettings, setNotificationSettings] = useState({
    order_status_enabled: true,
    promotions_enabled: true,
    order_confirmation_enabled: true,
    resend_configured: false
  });
  const [testEmail, setTestEmail] = useState('');
  const [bulkEmailForm, setBulkEmailForm] = useState({ subject: '', html_content: '' });
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      toast.error('Доступ запрещён');
      navigate('/');
      return;
    }
    fetchData();
  }, [user, authLoading, navigate]);

  // Real-time chat polling for admin
  useEffect(() => {
    if (!selectedChat) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/admin/chats/${selectedChat.id}/messages`);
        setChatMessages(res.data.messages || []);
      } catch (err) {
        console.error('Failed to poll chat messages', err);
      }
    }, 2000); // Poll every 2 seconds for real-time feel
    
    return () => clearInterval(interval);
  }, [selectedChat]);

  // Real-time chat list polling for admin
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/admin/chats`);
        setChats(res.data);
      } catch (err) {
        console.error('Failed to poll chats', err);
      }
    }, 3000); // Poll chat list every 3 seconds
    
    return () => clearInterval(interval);
  }, [user]);

  // Handle tab from URL params (for notification clicks)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && defaultTabOrder.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, productsRes, categoriesRes, usersRes, ordersRes, bannerRes, telegramRes, chatsRes, bonusProgramsRes, bonusHistoryRes, partnersRes, prizeRedemptionsRes, paymentRes, newsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/products`),
        axios.get(`${API}/categories`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/orders`),
        axios.get(`${API}/promo-banner`),
        axios.get(`${API}/admin/telegram-settings`),
        axios.get(`${API}/admin/chats`),
        axios.get(`${API}/admin/bonus/programs`),
        axios.get(`${API}/admin/bonus/history`),
        axios.get(`${API}/partners`),
        axios.get(`${API}/admin/prize-redemptions`),
        axios.get(`${API}/admin/payment-settings`),
        axios.get(`${API}/admin/news`)
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setUsers(usersRes.data);
      setOrders(ordersRes.data);
      setPromoBanner(bannerRes.data);
      setTelegramSettings(telegramRes.data);
      setChats(chatsRes.data);
      setBonusPrograms(Array.isArray(bonusProgramsRes.data) ? bonusProgramsRes.data : bonusProgramsRes.data.programs || []);
      setBonusHistory(bonusHistoryRes.data.history || []);
      setPartners(partnersRes.data || []);
      setPrizeRedemptions(prizeRedemptionsRes.data?.redemptions || []);
      setPaymentSettings(paymentRes.data || { 
        card_discount: 0, crypto_discount: 0, cash_discount: 0,
        card_enabled: true, crypto_enabled: true, cash_enabled: true
      });
      setNewsList(newsRes.data || []);
      // Fetch crypto wallets separately
      try { const cw = await axios.get(`${API}/admin/crypto-wallets`); setCryptoWallets(cw.data); } catch(e) {}
      // Fetch categories display columns_count
      try { const cd = await axios.get(`${API}/categories/display-settings`); setCategoriesColumns(cd.data?.columns_count || 4); } catch(e) {}
      // Fetch terms of service
      try { const termsRes = await axios.get(`${API}/admin/terms`); setTermsSections(termsRes.data.sections || []); } catch(e) {}
      // Fetch notification settings
      try { const notifRes = await axios.get(`${API}/admin/notification-settings`); setNotificationSettings(notifRes.data); } catch(e) {}
      // Fetch prepayment settings
      try { const prepayRes = await axios.get(`${API}/admin/prepayment-settings`); setPrepaymentSettings(prepayRes.data); } catch(e) {}
    } catch (err) {
      console.error('Failed to fetch admin data', err);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price);
  
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Product handlers
  const handleSaveProduct = async () => {
    if (!editingProduct.name || !editingProduct.article || !editingProduct.price) {
      toast.error('Заполните обязательные поля');
      return;
    }

    // Validate discount fields if active
    if (editingProduct.discount_active) {
      // Normalize missing discount_type (legacy records may have null)
      if (!editingProduct.discount_type) {
        editingProduct.discount_type = 'percent';
      }
      if (!editingProduct.discount_until) {
        toast.error('Укажите дату окончания акции');
        return;
      }
      if (!editingProduct.discount_value || editingProduct.discount_value <= 0) {
        toast.error('Укажите положительное значение скидки');
        return;
      }
      const until = new Date(editingProduct.discount_until);
      if (isNaN(until.getTime())) {
        toast.error('Некорректная дата окончания акции');
        return;
      }
    }

    // Normalize delivery_days
    const payload = {
      ...editingProduct,
      delivery_days: Math.max(0, parseInt(editingProduct.delivery_days) || 0),
    };

    try {
      if (isNewProduct) {
        const res = await axios.post(`${API}/products`, payload);
        // Real-time update: add to local state
        setProducts(prev => [...prev, res.data]);
        toast.success('Товар создан');
      } else {
        const res = await axios.put(`${API}/products/${editingProduct.id}`, payload);
        // Real-time update: update in local state
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? res.data : p));
        toast.success('Товар обновлён');
      }
      setEditingProduct(null);
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Удалить товар?')) return;
    
    try {
      await axios.delete(`${API}/products/${productId}`);
      // Real-time update: remove from local state
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast.success('Товар удалён');
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  // File upload handler
  const handleFileUpload = async (file, type) => {
    if (!file) return null;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Cloudinary returns full URL, use it directly
      const url = res.data.url;
      toast.success('Изображение загружено');
      return url;
    } catch (err) {
      toast.error('Ошибка загрузки: ' + (err.response?.data?.detail || 'Неизвестная ошибка'));
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await handleFileUpload(file, 'product');
      if (url) {
        setEditingProduct({ ...editingProduct, image_url: url });
      }
    }
  };

  const handleCategoryImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await handleFileUpload(file, 'category');
      if (url) {
        setEditingCategory({ ...editingCategory, image_url: url });
      }
    }
  };

  const handlePromoImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await handleFileUpload(file, 'promo');
      if (url) {
        setPromoBanner({ ...promoBanner, image: url });
      }
    }
  };

  const openNewProduct = () => {
    setIsNewProduct(true);
    setEditingProduct({
      name: '',
      article: '',
      manufacturer: '',
      category_id: '',
      price: 0,
      stock: 0,
      delivery_days: 3,
      warehouse: '',
      description: '',
      image_url: '',
      images: [],
      cross_articles: '',
      is_original: false,
      has_guarantee: false,
      bonus_eligible: true,
      discount_active: false,
      discount_type: 'percent',
      discount_value: 0,
      discount_label: '',
      discount_description: '',
      discount_until: null
    });
  };

  const openEditProduct = (product) => {
    setIsNewProduct(false);
    setEditingProduct({ 
      ...product, 
      cross_articles: product.cross_articles || '',
      images: product.images || []
    });
  };

  // Multiple image upload handler
  const handleMultipleImageUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const uploadedUrls = [];
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await axios.post(`${API}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Cloudinary returns full URL directly
        const url = res.data.url;
        uploadedUrls.push(url);
      }
      
      // Add to existing images
      const currentImages = editingProduct.images || [];
      const newImages = [...currentImages, ...uploadedUrls];
      
      // Set first image as main if none exists
      const mainImage = editingProduct.image_url || uploadedUrls[0];
      
      setEditingProduct({ 
        ...editingProduct, 
        images: newImages,
        image_url: mainImage
      });
      
      toast.success(`Загружено ${uploadedUrls.length} изображений`);
    } catch (err) {
      toast.error('Ошибка загрузки изображений');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (imageUrl) => {
    const newImages = (editingProduct.images || []).filter(img => img !== imageUrl);
    const newMainImage = editingProduct.image_url === imageUrl 
      ? (newImages[0] || '') 
      : editingProduct.image_url;
    
    setEditingProduct({
      ...editingProduct,
      images: newImages,
      image_url: newMainImage
    });
  };

  const handleSetMainImage = (imageUrl) => {
    setEditingProduct({
      ...editingProduct,
      image_url: imageUrl
    });
    toast.success('Главное изображение установлено');
  };

  // User management handlers
  const openNewUser = () => {
    setIsNewUser(true);
    setEditingUser({
      email: '',
      password: '',
      name: '',
      phone: '',
      address: '',
      role: 'user'
    });
  };

  const openEditUser = (u) => {
    setIsNewUser(false);
    setEditingUser({ ...u, password: u.password_plain || '' });
  };

  const handleSaveUser = async () => {
    try {
      if (isNewUser) {
        const res = await axios.post(`${API}/admin/users`, editingUser);
        setUsers([...users, { ...editingUser, id: res.data.id, total_orders: 0, total_spent: 0 }]);
        toast.success('Пользователь создан');
      } else {
        // Send only editable fields
        const { email, name, phone, address, address_comment, role, customer_status, individual_discount, password } = editingUser;
        const payload = { email, name, phone, address, address_comment, role, customer_status, individual_discount };
        if (password) payload.password = password;
        const res = await axios.put(`${API}/admin/users/${editingUser.id}`, payload);
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...res.data } : u));
        toast.success('Пользователь обновлён');
      }
      setEditingUser(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Удалить пользователя?')) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      toast.success('Пользователь удалён');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка удаления');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser({ ...user });
  };

  const handleBlockUser = async (userId, currentBlocked) => {
    const action = currentBlocked ? 'разблокировать' : 'заблокировать';
    if (!window.confirm(`Вы уверены, что хотите ${action} пользователя?`)) return;
    try {
      const res = await axios.post(`${API}/admin/users/${userId}/block`);
      setUsers(users.map(u => u.id === userId ? { ...u, blocked: res.data.blocked } : u));
      toast.success(res.data.blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  // Order management handlers
  const openEditOrder = (order) => {
    setEditingOrder({ ...order });
  };

  const handleSaveOrder = async () => {
    try {
      const res = await axios.put(`${API}/admin/orders/${editingOrder.id}`, {
        status: editingOrder.status,
        full_name: editingOrder.full_name,
        address: editingOrder.address,
        phone: editingOrder.phone,
        comment: editingOrder.comment,
        created_at: editingOrder.created_at,
        items: editingOrder.items
      });
      setOrders(orders.map(o => o.id === editingOrder.id ? res.data : o));
      setEditingOrder(null);
      toast.success('Заказ обновлён');
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleUpdateOrderItem = (index, field, value) => {
    const newItems = [...editingOrder.items];
    newItems[index] = { ...newItems[index], [field]: field === 'price' || field === 'quantity' ? Number(value) : value };
    setEditingOrder({ ...editingOrder, items: newItems });
  };

  const calculateOrderTotal = (items) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Удалить заказ?')) return;
    try {
      await axios.delete(`${API}/admin/orders/${orderId}`);
      setOrders(orders.filter(o => o.id !== orderId));
      setViewingOrder(null);
      toast.success('Заказ удалён');
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  // Category handlers
  const handleSaveCategory = async () => {
    if (!editingCategory.name) {
      toast.error('Введите название категории');
      return;
    }

    try {
      if (isNewCategory) {
        const res = await axios.post(`${API}/categories`, editingCategory);
        // Real-time update: add to local state
        setCategories(prev => [...prev, res.data]);
        toast.success('Категория создана');
      } else {
        const res = await axios.put(`${API}/categories/${editingCategory.id}`, editingCategory);
        // Real-time update: update in local state
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? res.data : c));
        toast.success('Категория обновлена');
      }
      setEditingCategory(null);
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Удалить категорию? Товары из этой категории останутся без категории.')) return;
    
    try {
      await axios.delete(`${API}/categories/${categoryId}`);
      // Real-time update: remove from local state
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      // Also update products to remove category reference
      setProducts(prev => prev.map(p => p.category_id === categoryId ? {...p, category_id: null} : p));
      toast.success('Категория удалена');
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const persistCategoriesOrder = async (orderedIds, columnsCount = null) => {
    try {
      await axios.post(`${API}/categories/reorder`, {
        ordered_ids: orderedIds,
        columns_count: columnsCount,
      });
    } catch (err) {
      toast.error('Не удалось сохранить порядок');
    }
  };

  const moveCategory = (categoryId, direction) => {
    const list = [...categories];
    const idx = list.findIndex((c) => c.id === categoryId);
    if (idx < 0) return;
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= list.length) return;
    [list[idx], list[swap]] = [list[swap], list[idx]];
    list.forEach((c, i) => (c.display_order = i));
    setCategories(list);
    persistCategoriesOrder(list.map((c) => c.id));
  };

  const updateCategoriesColumns = (cols) => {
    setCategoriesColumns(cols);
    persistCategoriesOrder(categories.map((c) => c.id), cols);
  };

  const openNewCategory = () => {
    setIsNewCategory(true);
    setEditingCategory({ name: '', image_url: '' });
  };

  const openEditCategory = (category) => {
    setIsNewCategory(false);
    setEditingCategory({ ...category });
  };

  // Promo banner handler
  const handleSavePromoBanner = async () => {
    try {
      await axios.put(`${API}/admin/promo-banner`, promoBanner);
      toast.success('Баннер обновлён');
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  // Telegram handlers
  const handleSaveTelegram = async () => {
    try {
      await axios.put(`${API}/admin/telegram-settings`, telegramSettings);
      toast.success('Настройки Telegram сохранены');
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleTestTelegram = async () => {
    try {
      await axios.post(`${API}/admin/telegram-test`);
      toast.success('Тестовое сообщение отправлено!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки');
    }
  };

  // Chat handlers
  const fetchChatMessages = async (chatId) => {
    try {
      const res = await axios.get(`${API}/admin/chats/${chatId}/messages`);
      setChatMessages(res.data.messages || []);
      // Refresh chats to update unread count
      const chatsRes = await axios.get(`${API}/admin/chats`);
      setChats(chatsRes.data);
    } catch (err) {
      console.error('Failed to fetch chat messages', err);
    }
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    fetchChatMessages(chat.id);
  };

  const handleSendAdminMessage = async () => {
    if (!newAdminMessage.trim() || !selectedChat) return;
    
    try {
      await axios.post(`${API}/admin/chats/${selectedChat.id}/send`, { text: newAdminMessage });
      setNewAdminMessage('');
      fetchChatMessages(selectedChat.id);
    } catch (err) {
      toast.error('Ошибка отправки');
    }
  };
  
  const handleAdminChatFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    setAdminChatUploading(true);
    try {
      // Upload file to Google Drive
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await axios.post(`${API}/admin/chats/${selectedChat.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Send media message
      await axios.post(`${API}/admin/chats/${selectedChat.id}/send-media`, null, {
        params: {
          file_url: uploadRes.data.url,
          filename: uploadRes.data.filename,
          is_image: uploadRes.data.is_image,
          is_video: uploadRes.data.is_video,
          caption: ''
        }
      });

      fetchChatMessages(selectedChat.id);
      toast.success('Файл отправлен');
    } catch (err) {
      console.error('Failed to upload file', err);
      toast.error('Ошибка загрузки файла');
    } finally {
      setAdminChatUploading(false);
      if (adminChatFileRef.current) adminChatFileRef.current.value = '';
    }
  };

  // Partner image upload
  const handlePartnerImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPartnerImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API}/admin/partners/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update editingPartner with new image URL
      setEditingPartner(prev => ({ ...prev, image_url: res.data.url }));
      toast.success('Изображение загружено');
    } catch (err) {
      console.error('Failed to upload partner image', err);
      toast.error('Ошибка загрузки изображения');
    } finally {
      setPartnerImageUploading(false);
      if (partnerImageRef.current) partnerImageRef.current.value = '';
    }
  };

  // Extended stats
  const fetchExtendedStats = async (period) => {
    try {
      const res = await axios.get(`${API}/admin/stats/extended?period=${period}`);
      setExtendedStats(res.data);
    } catch (err) {
      console.error('Failed to fetch extended stats', err);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && !authLoading) {
      fetchExtendedStats(statsPeriod);
    }
  }, [statsPeriod, user, authLoading]);

  // Import handlers
  const handleImportProducts = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setImportResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API}/admin/products/import-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportResult(res.data);
      toast.success(`Импортировано: ${res.data.imported}, Обновлено: ${res.data.updated}`);
      // Refresh products list to show imported items
      const productsRes = await axios.get(`${API}/products`);
      setProducts(productsRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка импорта');
    } finally {
      setUploading(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const handleExportProducts = async () => {
    try {
      const res = await axios.get(`${API}/admin/products/csv-export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'products_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Ошибка экспорта');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await axios.get(`${API}/admin/products/csv-template`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'products_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Ошибка скачивания шаблона');
    }
  };

  const handleDownloadPrompt = async () => {
    try {
      const res = await axios.get(`${API}/admin/products/csv-prompt`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'chatgpt_prompt.txt');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Ошибка скачивания промпта');
    }
  };

  // Order handlers
  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/admin/orders/${orderId}/status?status=${status}`);
      toast.success('Статус обновлён');
      
      // Update local state without full page reload
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { ...order, status } : order
        )
      );
      
      // Update viewing order if it's open
      if (viewingOrder?.id === orderId) {
        setViewingOrder({ ...viewingOrder, status });
      }
    } catch (err) {
      toast.error('Ошибка обновления статуса');
    }
  };

  const STATUS_OPTIONS = [
    { value: 'pending', label: 'Ожидает', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'processing', label: 'В обработке', color: 'bg-blue-100 text-blue-800' },
    { value: 'shipped', label: 'Отправлен', color: 'bg-purple-100 text-purple-800' },
    { value: 'delivered', label: 'Доставлен', color: 'bg-green-100 text-green-800' },
    { value: 'cancelled', label: 'Отменён', color: 'bg-red-100 text-red-800' }
  ];

  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : '—';
  };

  // Tab management functions
  const moveTab = (tabId, direction) => {
    const currentIndex = tabOrder.indexOf(tabId);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= tabOrder.length) return;
    
    const newOrder = [...tabOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    setTabOrder(newOrder);
    localStorage.setItem('adminTabOrder', JSON.stringify(newOrder));
  };

  // Handler functions for refactored components
  
  // Payment settings handlers
  const handleSavePaymentSettings = async () => {
    try {
      await axios.put(`${API}/admin/payment-settings`, paymentSettings);
      toast.success('Настройки оплаты сохранены');
    } catch (err) { toast.error('Ошибка сохранения'); }
  };

  const handleSaveCryptoWallets = async () => {
    try {
      await axios.put(`${API}/admin/crypto-wallets`, cryptoWallets);
      toast.success('Кошельки сохранены');
    } catch (err) { toast.error('Ошибка'); }
  };

  // Terms handlers
  const handleSaveTerms = async () => {
    setTermsSaving(true);
    try {
      await axios.put(`${API}/admin/terms`, { sections: termsSections });
      toast.success('Правила сохранены');
    } catch (err) {
      toast.error('Ошибка сохранения');
    } finally {
      setTermsSaving(false);
    }
  };

  const handleResetTerms = async () => {
    if (window.confirm('Сбросить правила к значениям по умолчанию?')) {
      try {
        await axios.post(`${API}/admin/terms/reset`);
        const termsRes = await axios.get(`${API}/admin/terms`);
        setTermsSections(termsRes.data.sections || []);
        toast.success('Правила сброшены');
      } catch (err) {
        toast.error('Ошибка сброса');
      }
    }
  };

  // Prepayment settings handler
  const handleSavePrepaymentSettings = async () => {
    try {
      await axios.put(`${API}/admin/prepayment-settings`, prepaymentSettings);
      toast.success('Настройки предоплаты сохранены');
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  // Notification handlers
  const handleSaveNotificationSettings = async () => {
    try {
      await axios.put(`${API}/admin/notification-settings`, {
        order_status_enabled: notificationSettings.order_status_enabled,
        promotions_enabled: notificationSettings.promotions_enabled,
        order_confirmation_enabled: notificationSettings.order_confirmation_enabled
      });
      toast.success('Настройки сохранены');
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast.error('Введите email');
      return;
    }
    setSendingEmail(true);
    try {
      await axios.post(`${API}/admin/email/test`, { email: testEmail });
      toast.success(`Тестовое письмо отправлено на ${testEmail}`);
      setTestEmail('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendBulkEmail = async (userIds = null) => {
    if (!bulkEmailForm.subject || !bulkEmailForm.html_content) {
      toast.error('Заполните тему и содержание письма');
      return;
    }
    const count = userIds ? userIds.length : users.length;
    const label = userIds ? `выбранным пользователям (${count})` : `всем пользователям (${count})`;
    if (!window.confirm(`Отправить рассылку ${label}?`)) return;
    
    setSendingEmail(true);
    try {
      const payload = { ...bulkEmailForm };
      if (userIds && userIds.length > 0) {
        payload.user_ids = userIds;
      }
      const res = await axios.post(`${API}/admin/email/send-bulk`, payload);
      toast.success(res.data.message);
      setBulkEmailForm({ subject: '', html_content: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка рассылки');
    } finally {
      setSendingEmail(false);
    }
  };

  // Partners handlers
  const handleAddDefaultPartners = async () => {
    try {
      await axios.post(`${API}/admin/partners/seed`);
      toast.success('Партнёры по умолчанию добавлены');
      const partnersRes = await axios.get(`${API}/partners`);
      setPartners(partnersRes.data || []);
    } catch (err) {
      toast.error('Ошибка');
    }
  };

  const handleDeletePartner = async (partnerId) => {
    if (window.confirm('Удалить партнёра?')) {
      try {
        await axios.delete(`${API}/admin/partners/${partnerId}`);
        setPartners(prev => prev.filter(p => p.id !== partnerId));
        toast.success('Партнёр удалён');
      } catch (err) {
        toast.error('Ошибка удаления');
      }
    }
  };

  const handleSavePartner = async () => {
    if (!editingPartner?.name) {
      toast.error('Введите название партнёра');
      return;
    }
    try {
      if (isNewPartner) {
        const res = await axios.post(`${API}/admin/partners`, editingPartner);
        setPartners(prev => [...prev, res.data]);
        toast.success('Партнёр добавлен');
      } else {
        const res = await axios.put(`${API}/admin/partners/${editingPartner.id}`, editingPartner);
        setPartners(prev => prev.map(p => p.id === editingPartner.id ? res.data : p));
        toast.success('Партнёр обновлён');
      }
      setEditingPartner(null);
      setIsNewPartner(false);
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  const resetTabOrder = () => {
    setTabOrder(defaultTabOrder);
    localStorage.removeItem('adminTabOrder');
    toast.success('Порядок вкладок сброшен');
  };

  // Tab configuration - New restructured tabs
  const tabConfig = {
    products: { icon: Package, label: 'Каталог', count: products.length },
    bonus: { icon: Gift, label: 'Бонусы', badge: bonusPrograms.reduce((sum, p) => sum + (p.pending_requests || 0), 0) },
    payments: { icon: CreditCard, label: 'Платежи' },
    crm: { icon: Users, label: 'CRM', count: users.length },
    marketing: { icon: Megaphone, label: 'Маркетинг' },
    logs: { icon: ScrollText, label: 'Логи' },
    settings: { icon: Settings, label: 'Настройки' }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <>
      {/* Admin Image Lightbox */}
      {adminLightboxImage && (
        <AdminImageLightbox 
          src={adminLightboxImage} 
          onClose={() => setAdminLightboxImage(null)} 
        />
      )}
      
      {/* Admin Video Lightbox */}
      {adminLightboxVideo && (
        <AdminVideoLightbox 
          src={adminLightboxVideo} 
          onClose={() => setAdminLightboxVideo(null)} 
        />
      )}
      
    <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`} data-testid="admin-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-2xl md:text-3xl font-bold tracking-tight uppercase ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            <span className={`bg-gradient-to-r ${isDark ? 'from-orange-400 to-orange-600' : 'from-teal-500 to-emerald-500'} bg-clip-text text-transparent`}>
              Панель администратора
            </span>
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingTabOrder(!editingTabOrder)}
            className={`${editingTabOrder ? 'bg-teal-100 border-teal-500' : ''} ${isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : ''}`}
          >
            <Settings className="w-4 h-4 mr-1" />
            {editingTabOrder ? 'Готово' : 'Настроить вкладки'}
          </Button>
        </div>

        {/* Tab Order Editor */}
        {editingTabOrder && (
          <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-teal-800">
                Перетащите вкладки для изменения порядка или используйте стрелки
              </p>
              <Button variant="outline" size="sm" onClick={resetTabOrder}>
                Сбросить
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tabOrder.map((tabId, index) => {
                const config = tabConfig[tabId];
                const IconComponent = config.icon;
                return (
                  <div key={tabId} className="flex items-center gap-1 bg-white border border-teal-200 rounded-lg px-2 py-1.5">
                    <button 
                      onClick={() => moveTab(tabId, 'left')}
                      disabled={index === 0}
                      className="p-0.5 hover:bg-teal-100 rounded disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1.5 px-2">
                      <IconComponent className="w-3.5 h-3.5 text-teal-600" />
                      <span className="text-xs font-medium">{config.label}</span>
                    </div>
                    <button 
                      onClick={() => moveTab(tabId, 'right')}
                      disabled={index === tabOrder.length - 1}
                      className="p-0.5 hover:bg-teal-100 rounded disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs - Dynamic Order with Full Width Distribution */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className={`rounded-xl border shadow-sm overflow-hidden ${isDark ? 'bg-zinc-900/60 border-zinc-800 backdrop-blur-xl' : 'bg-white border-zinc-200'}`}>
          <div className="overflow-x-auto">
            <TabsList className={`w-full flex border-b rounded-none p-0 h-auto ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'}`}>
              {tabOrder.map((tabId) => {
                const config = tabConfig[tabId];
                const IconComponent = config.icon;
                const isActive = activeTab === tabId;
                return (
                  <TabsTrigger 
                    key={tabId}
                    value={tabId} 
                    className={`flex-1 flex items-center justify-center gap-2 rounded-none border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                      isDark 
                        ? isActive 
                          ? 'bg-gradient-to-t from-teal-500/10 to-transparent border-teal-500 text-teal-400' 
                          : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                        : isActive 
                          ? 'bg-gradient-to-t from-teal-500/10 to-transparent border-teal-500 text-teal-700' 
                          : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isActive ? (isDark ? 'text-teal-400' : 'text-teal-600') : ''}`} />
                    <span className="hidden sm:inline">{config.label}</span>
                    {config.count !== undefined && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        isDark 
                          ? isActive ? 'bg-teal-500/20 text-teal-300' : 'bg-zinc-700 text-zinc-400'
                          : isActive ? 'bg-teal-100 text-teal-700' : 'bg-zinc-200 text-zinc-500'
                      }`}>
                        {config.count}
                      </span>
                    )}
                    {config.badge > 0 && (
                      <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                        {config.badge}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Products & Categories Tab (Каталог) - Modern Design */}
          <TabsContent value="products" className="p-6">
            <motion.div 
              className="space-y-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Categories Section */}
              <div className="bg-gradient-to-br from-teal-50/50 to-emerald-50/30 rounded-2xl p-6 border border-teal-100/50">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                      <FolderOpen className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Категории</h2>
                      <p className="text-sm text-slate-500">{categories.length} категорий • Нажмите для фильтрации товаров</p>
                    </div>
                  </div>
                  <Button onClick={openNewCategory} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/20" data-testid="add-category-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить
                  </Button>
                </div>

                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap" data-testid="categories-display-settings">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500 font-medium">Колонок на странице поиска:</span>
                    <select
                      value={categoriesColumns}
                      onChange={(e) => updateCategoriesColumns(parseInt(e.target.value))}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white focus:border-teal-400"
                      data-testid="categories-columns-select"
                    >
                      {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-slate-400">Стрелки ↑↓ на карточках меняют порядок</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <div 
                    onClick={() => setSelectedCategoryId(null)}
                    className={`group relative cursor-pointer rounded-xl p-4 border transition-all duration-300 ${
                      selectedCategoryId === null 
                        ? 'bg-gradient-to-br from-teal-500 to-emerald-500 border-teal-500 shadow-xl shadow-teal-500/30 scale-105' 
                        : 'bg-white/80 backdrop-blur-sm border-white/50 shadow-sm hover:shadow-xl hover:shadow-teal-500/10 hover:-translate-y-1'
                    }`}
                  >
                    <div className={`aspect-square mb-3 overflow-hidden rounded-lg flex items-center justify-center ${
                      selectedCategoryId === null ? 'bg-white/20' : 'bg-gradient-to-br from-slate-100 to-slate-50'
                    }`}>
                      <Package className={`w-10 h-10 ${selectedCategoryId === null ? 'text-white' : 'text-slate-300'}`} />
                    </div>
                    <div className="text-center">
                      <h3 className={`font-semibold text-sm ${selectedCategoryId === null ? 'text-white' : 'text-slate-800'}`}>Все товары</h3>
                      <p className={`text-xs font-medium mt-0.5 ${selectedCategoryId === null ? 'text-teal-100' : 'text-teal-600'}`}>
                        {products.length} товаров
                      </p>
                    </div>
                  </div>

                  {categories.map((category) => (
                    <div 
                      key={category.id} 
                      onClick={() => setSelectedCategoryId(selectedCategoryId === category.id ? null : category.id)}
                      className={`group relative cursor-pointer rounded-xl p-4 border transition-all duration-300 ${
                        selectedCategoryId === category.id 
                          ? 'bg-gradient-to-br from-teal-500 to-emerald-500 border-teal-500 shadow-xl shadow-teal-500/30 scale-105' 
                          : 'bg-white/80 backdrop-blur-sm border-white/50 shadow-sm hover:shadow-xl hover:shadow-teal-500/10 hover:-translate-y-1'
                      }`}
                    >
                      <div className={`aspect-square mb-3 overflow-hidden rounded-lg ${
                        selectedCategoryId === category.id ? 'ring-2 ring-white/50' : ''
                      }`}>
                        {category.image_url ? (
                          <img src={category.image_url} alt={category.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${
                            selectedCategoryId === category.id ? 'bg-white/20' : 'bg-gradient-to-br from-slate-100 to-slate-50'
                          }`}>
                            <FolderOpen className={`w-10 h-10 ${selectedCategoryId === category.id ? 'text-white' : 'text-slate-300'}`} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className={`font-semibold text-sm truncate ${selectedCategoryId === category.id ? 'text-white' : 'text-slate-800'}`}>{category.name}</h3>
                          <p className={`text-xs font-medium mt-0.5 ${selectedCategoryId === category.id ? 'text-teal-100' : 'text-teal-600'}`}>
                            {products.filter(p => p.category_id === category.id).length} товаров
                          </p>
                        </div>
                        <div className={`flex gap-1 transition-opacity ${selectedCategoryId === category.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <button
                            className={`p-1.5 rounded-lg transition-colors ${
                              selectedCategoryId === category.id 
                                ? 'bg-white/20 hover:bg-white/30 text-white' 
                                : 'bg-slate-100 hover:bg-teal-100 text-slate-500 hover:text-teal-600'
                            }`}
                            onClick={(e) => { e.stopPropagation(); moveCategory(category.id, 'up'); }}
                            title="Выше"
                            data-testid={`cat-up-${category.id}`}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className={`p-1.5 rounded-lg transition-colors ${
                              selectedCategoryId === category.id 
                                ? 'bg-white/20 hover:bg-white/30 text-white' 
                                : 'bg-slate-100 hover:bg-teal-100 text-slate-500 hover:text-teal-600'
                            }`}
                            onClick={(e) => { e.stopPropagation(); moveCategory(category.id, 'down'); }}
                            title="Ниже"
                            data-testid={`cat-down-${category.id}`}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            className={`p-1.5 rounded-lg transition-colors ${
                              selectedCategoryId === category.id 
                                ? 'bg-white/20 hover:bg-white/30 text-white' 
                                : 'bg-slate-100 hover:bg-teal-100 text-slate-500 hover:text-teal-600'
                            }`} 
                            onClick={(e) => { e.stopPropagation(); openEditCategory(category); }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            className={`p-1.5 rounded-lg transition-colors ${
                              selectedCategoryId === category.id 
                                ? 'bg-white/20 hover:bg-red-400/50 text-white' 
                                : 'bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500'
                            }`} 
                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-400">
                      <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Категорий пока нет</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Products Section - Cards View */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        Товары
                        {selectedCategoryId && (
                          <span className="ml-2 text-teal-600">
                            — {categories.find(c => c.id === selectedCategoryId)?.name}
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {selectedCategoryId 
                          ? `${products.filter(p => p.category_id === selectedCategoryId).length} из ${products.length} товаров`
                          : `${products.length} позиций`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCategoryId && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedCategoryId(null)}
                        className="text-slate-500"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Сбросить фильтр
                      </Button>
                    )}
                    <Button onClick={openNewProduct} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/20" data-testid="add-product-btn">
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить товар
                    </Button>
                  </div>
                </div>

                {/* Products Grid - Compact Cards like Categories */}
                <div className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {products
                      .filter(p => selectedCategoryId ? p.category_id === selectedCategoryId : true)
                      .map((product) => (
                        <motion.div 
                          key={product.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="group relative bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 shadow-sm hover:shadow-xl hover:shadow-teal-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                          onClick={() => openEditProduct(product)}
                        >
                          <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 mb-3 overflow-hidden rounded-lg relative">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-10 h-10 text-slate-300" />
                              </div>
                            )}
                            {/* Stock Badge */}
                            <div className={`absolute top-2 right-2 w-3 h-3 rounded-full shadow-sm ${
                              product.stock > 0 
                                ? 'bg-emerald-500' 
                                : 'bg-red-500'
                            }`} title={product.stock > 0 ? 'В наличии' : 'Нет в наличии'} />
                            {/* Badges top-left — only Bonus (full label) */}
                            {product.bonus_eligible !== false && (
                              <div className="absolute top-1.5 left-1.5">
                                <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow whitespace-nowrap" title="Участвует в бонусной программе" data-testid={`admin-badge-bonus-${product.id}`}>
                                  <Gift className="w-3 h-3" />Бонусы
                                </span>
                              </div>
                            )}
                            {/* Discount badge top-right */}
                            {(() => {
                              const d = computeDiscount(product);
                              if (!d) return null;
                              return (
                                <div className="absolute bottom-1.5 left-1.5 right-1.5" data-testid={`admin-badge-discount-${product.id}`}>
                                  <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow truncate flex items-center justify-between gap-1">
                                    <span className="truncate">{d.label || 'Акция'}</span>
                                    <span className="flex-shrink-0">{formatDiscountBadge(d)}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-mono text-[11px] font-bold text-pink-600 break-all leading-tight mb-0.5" title={product.article} data-testid={`admin-product-article-${product.id}`}>
                                {product.article}
                              </p>
                              <h3 className="font-semibold text-sm text-slate-800 line-clamp-2 leading-tight">{product.name}</h3>
                              <p className="text-xs text-teal-600 font-bold mt-0.5">
                                {formatPrice(product.price)} ₽
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-100 text-slate-500 hover:text-teal-600 transition-colors" 
                                onClick={(e) => { e.stopPropagation(); openEditProduct(product); }}
                                data-testid={`edit-${product.id}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 transition-colors" 
                                onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                                data-testid={`delete-${product.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                  </div>

                  {products.filter(p => selectedCategoryId ? p.category_id === selectedCategoryId : true).length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{selectedCategoryId ? 'Нет товаров в этой категории' : 'Товаров пока нет'}</p>
                      {selectedCategoryId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          onClick={() => setSelectedCategoryId(null)}
                        >
                          Показать все товары
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <h2 className="text-lg font-semibold mb-4">Заказы</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 px-2">№ Заказа</th>
                    <th className="text-left py-3 px-2">Дата</th>
                    <th className="text-left py-3 px-2">Клиент</th>
                    <th className="text-right py-3 px-2">Сумма</th>
                    <th className="text-center py-3 px-2">Статус</th>
                    <th className="text-right py-3 px-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-2 px-2 font-mono">{order.id.slice(0, 8)}</td>
                      <td className="py-2 px-2 text-zinc-500">{formatDate(order.created_at)}</td>
                      <td className="py-2 px-2">{order.full_name}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatPrice(order.total)} ₽</td>
                      <td className="py-2 px-2 text-center">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className={`text-xs font-bold px-2 py-1 border-0 ${STATUS_OPTIONS.find(s => s.value === order.status)?.color || 'bg-zinc-100'}`}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Откатить статус"
                            onClick={async () => {
                              try {
                                const res = await axios.put(`${API}/admin/orders/${order.id}/rollback-status`);
                                toast.success(`Статус откачен на: ${res.data.status}`);
                                fetchData();
                              } catch (err) { toast.error(err.response?.data?.detail || 'Нет предыдущего статуса'); }
                            }}
                            data-testid={`rollback-order-${order.id}`}>
                            <RotateCcw className="w-4 h-4 text-amber-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setViewingOrder(order)} data-testid={`view-order-${order.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditOrder(order)} data-testid={`edit-order-${order.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteOrder(order.id)} 
                            className="text-red-500 hover:text-red-600"
                            data-testid={`delete-order-${order.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </motion.div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Управление пользователями ({users.length})</h2>
              <Button onClick={openNewUser} className="bg-teal-500 hover:bg-teal-600" data-testid="add-user-btn">
                <Plus className="w-4 h-4 mr-2" />
                Добавить пользователя
              </Button>
            </div>
            
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="border border-zinc-200 bg-white rounded-lg overflow-hidden">
                  {/* User Row - Clickable Header */}
                  <div 
                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50 transition-colors ${
                      expandedUserId === u.id ? 'bg-teal-50 border-b border-teal-200' : ''
                    }`}
                    onClick={async () => {
                      if (expandedUserId === u.id) {
                        setExpandedUserId(null);
                        setUserDetails(null);
                      } else {
                        setExpandedUserId(u.id);
                        setLoadingUserDetails(true);
                        try {
                          const res = await axios.get(`${API}/admin/users/${u.id}/details`);
                          setUserDetails(res.data);
                        } catch (err) {
                          toast.error('Ошибка загрузки данных');
                        } finally {
                          setLoadingUserDetails(false);
                        }
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center overflow-hidden">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-zinc-400" />
                        )}
                      </div>
                      
                      {/* Basic Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{u.name}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            u.role === 'admin' ? 'bg-teal-100 text-teal-800' : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500">{u.email}</p>
                        {u.password_plain && (
                          <p className="text-xs font-mono text-zinc-600 bg-zinc-100 inline-block px-2 py-0.5 rounded mt-0.5" data-testid={`user-password-preview-${u.id}`}>
                            Пароль: {u.password_plain}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-mono font-bold text-zinc-900">{u.total_orders || 0} заказов</p>
                        <p className="text-sm text-zinc-500">{formatPrice(u.total_spent || 0)} ₽</p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); openEditUser(u); }} 
                          data-testid={`edit-user-${u.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); setAnalyticsUser({ id: u.id, name: u.name || u.email }); }} 
                          className="text-blue-500 hover:text-blue-600"
                          data-testid={`analytics-user-${u.id}`}
                          title="Аналитика"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id); }} 
                          className="text-red-500 hover:text-red-600"
                          disabled={u.email === 'admin@avarus.ru'}
                          data-testid={`delete-user-${u.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${
                          expandedUserId === u.id ? 'rotate-180' : ''
                        }`} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded User Details */}
                  {expandedUserId === u.id && (
                    <div className="border-t border-zinc-200 bg-zinc-50">
                      {loadingUserDetails ? (
                        <div className="p-6 text-center text-zinc-500">
                          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          Загрузка...
                        </div>
                      ) : userDetails ? (
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Personal Info */}
                          <div className="bg-white p-4 rounded-lg border border-zinc-200">
                            <h4 className="font-bold text-sm text-zinc-500 uppercase mb-3 flex items-center gap-2">
                              <User className="w-4 h-4" /> Личные данные
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">ФИО:</span>
                                <span className="font-medium">{userDetails.user.name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Email:</span>
                                <span className="font-medium">{userDetails.user.email}</span>
                              </div>
                              <div className="flex justify-between" data-testid="user-detail-password">
                                <span className="text-zinc-500">Пароль:</span>
                                <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded text-xs select-all">
                                  {userDetails.user.password_plain || '—'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Телефон:</span>
                                <span className="font-medium">{userDetails.user.phone || '—'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Адрес:</span>
                                <span className="font-medium text-right max-w-[150px] truncate" title={userDetails.user.address}>
                                  {userDetails.user.address || '—'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Роль:</span>
                                <span className={`font-bold ${userDetails.user.role === 'admin' ? 'text-teal-600' : 'text-zinc-600'}`}>
                                  {userDetails.user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Дата регистрации:</span>
                                <span className="font-medium">
                                  {userDetails.user.created_at ? formatDate(userDetails.user.created_at) : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Order Statistics */}
                          <div className="bg-white p-4 rounded-lg border border-zinc-200">
                            <h4 className="font-bold text-sm text-zinc-500 uppercase mb-3 flex items-center gap-2">
                              <ShoppingBag className="w-4 h-4" /> Статистика заказов
                            </h4>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="bg-teal-50 p-3 rounded text-center">
                                <p className="text-2xl font-bold text-teal-600">{userDetails.statistics.total_orders}</p>
                                <p className="text-xs text-zinc-500">Заказов</p>
                              </div>
                              <div className="bg-green-50 p-3 rounded text-center">
                                <p className="text-lg font-bold text-green-600">{formatPrice(userDetails.statistics.total_spent)} ₽</p>
                                <p className="text-xs text-zinc-500">Потрачено</p>
                              </div>
                              <div className="bg-blue-50 p-3 rounded text-center">
                                <p className="text-lg font-bold text-blue-600">{formatPrice(userDetails.statistics.avg_order_value)} ₽</p>
                                <p className="text-xs text-zinc-500">Средний чек</p>
                              </div>
                              <div className="bg-emerald-50 p-3 rounded text-center">
                                <p className="text-lg font-bold text-emerald-600">{userDetails.statistics.total_items}</p>
                                <p className="text-xs text-zinc-500">Товаров</p>
                              </div>
                            </div>
                            
                            {/* Orders by status */}
                            {Object.keys(userDetails.statistics.orders_by_status || {}).length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-zinc-400 mb-1">По статусу:</p>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(userDetails.statistics.orders_by_status).map(([status, count]) => (
                                    <span key={status} className="text-xs bg-zinc-100 px-2 py-0.5 rounded">
                                      {status}: {count}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* First/Last order */}
                            <div className="text-xs text-zinc-500 space-y-1">
                              {userDetails.statistics.first_order_date && (
                                <p>Первый заказ: {formatDate(userDetails.statistics.first_order_date)}</p>
                              )}
                              {userDetails.statistics.last_order_date && (
                                <p>Последний заказ: {formatDate(userDetails.statistics.last_order_date)}</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Favorite Products & Bonus */}
                          <div className="space-y-4">
                            {/* Favorite Products */}
                            {userDetails.statistics.favorite_products?.length > 0 && (
                              <div className="bg-white p-4 rounded-lg border border-zinc-200">
                                <h4 className="font-bold text-sm text-zinc-500 uppercase mb-3 flex items-center gap-2">
                                  <Package className="w-4 h-4" /> Популярные товары
                                </h4>
                                <div className="space-y-2">
                                  {userDetails.statistics.favorite_products.slice(0, 3).map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm bg-zinc-50 p-2 rounded">
                                      <div>
                                        <span className="font-mono text-xs text-teal-600 mr-1">{p.article}</span>
                                        <span className="text-zinc-700 truncate">{p.name?.substring(0, 20)}</span>
                                      </div>
                                      <span className="font-bold">{p.count} шт.</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Recent Orders */}
                            {userDetails.recent_orders?.length > 0 && (
                              <div className="bg-white p-4 rounded-lg border border-zinc-200">
                                <h4 className="font-bold text-sm text-zinc-500 uppercase mb-3 flex items-center gap-2">
                                  <ShoppingBag className="w-4 h-4" /> Последние заказы
                                </h4>
                                <div className="space-y-2">
                                  {userDetails.recent_orders.slice(0, 3).map((order, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm bg-zinc-50 p-2 rounded">
                                      <div>
                                        <span className="font-mono text-xs text-zinc-400">#{order.id?.substring(0, 8)}</span>
                                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                                          order.status === 'delivered' ? 'bg-green-100 text-green-600' :
                                          order.status === 'shipped' ? 'bg-blue-100 text-blue-600' :
                                          order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                                          'bg-yellow-100 text-yellow-600'
                                        }`}>
                                          {order.status}
                                        </span>
                                      </div>
                                      <span className="font-bold">{formatPrice(order.total)} ₽</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
            </motion.div>
          </TabsContent>

          {/* Promo Banner Tab */}
          <TabsContent value="promo">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <PromoTab
              promoBanner={promoBanner}
              setPromoBanner={setPromoBanner}
              uploading={uploading}
              handlePromoImageUpload={handlePromoImageUpload}
              handleSavePromoBanner={handleSavePromoBanner}
            />
            </motion.div>
          </TabsContent>

          {/* Extended Statistics Tab */}
          <TabsContent value="stats">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <StatsTab
              statsPeriod={statsPeriod}
              setStatsPeriod={setStatsPeriod}
              extendedStats={extendedStats}
            />
            </motion.div>
          </TabsContent>

          {/* Chat Tab - Keeping inline due to complexity */}
          <TabsContent value="chat" className="p-6">
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[500px]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Chat list */}
              <div className="border border-zinc-200 overflow-hidden flex flex-col">
                <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 font-semibold text-sm flex items-center justify-between">
                  <span>Диалоги ({chats.length})</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={async () => {
                      try {
                        await axios.post(`${API}/admin/chat/setup-telegram-webhook`);
                        toast.success('Telegram webhook установлен');
                      } catch (err) {
                        toast.error('Ошибка установки webhook');
                      }
                    }}
                    title="Настроить Telegram бот"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {chats.length === 0 ? (
                    <p className="text-center text-zinc-400 text-sm py-8">Нет диалогов</p>
                  ) : (
                    [...chats].sort((a, b) => {
                      // Pinned first
                      if (a.pinned && !b.pinned) return -1;
                      if (!a.pinned && b.pinned) return 1;
                      // Then by update time
                      return new Date(b.updated_at) - new Date(a.updated_at);
                    }).map((chat) => (
                      <div
                        key={chat.id}
                        className={`relative group ${selectedChat?.id === chat.id ? 'bg-teal-50' : 'hover:bg-zinc-50'}`}
                      >
                        <button
                          onClick={() => handleSelectChat(chat)}
                          className="w-full text-left p-3 border-b border-zinc-100 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {chat.pinned && <Pin className="w-3 h-3 text-teal-500 flex-shrink-0" />}
                              <span className="font-medium text-sm truncate">{chat.user_name}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {chat.labels?.map((label, i) => (
                                <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  label === 'важный' ? 'bg-red-100 text-red-600' :
                                  label === 'vip' ? 'bg-purple-100 text-purple-600' :
                                  'bg-zinc-100 text-zinc-600'
                                }`}>{label}</span>
                              ))}
                              {chat.unread_count > 0 && (
                                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                  {chat.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-zinc-400 truncate">{chat.user_email}</p>
                        </button>
                        
                        {/* Chat actions on hover */}
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-white shadow border border-zinc-200 rounded p-0.5">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await axios.put(`${API}/admin/chats/${chat.id}/pin`);
                                setChats(prev => prev.map(c => c.id === chat.id ? {...c, pinned: res.data.pinned} : c));
                                toast.success(res.data.pinned ? 'Закреплено' : 'Откреплено');
                              } catch (err) {
                                toast.error('Ошибка');
                              }
                            }}
                            className={`p-1 rounded hover:bg-zinc-100 ${chat.pinned ? 'text-teal-500' : 'text-zinc-400'}`}
                            title="Закрепить"
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const label = prompt('Введите метку (важный, vip, или другую):');
                              if (label) {
                                try {
                                  const res = await axios.put(`${API}/admin/chats/${chat.id}/label?label=${encodeURIComponent(label)}`);
                                  setChats(prev => prev.map(c => c.id === chat.id ? {...c, labels: res.data.labels} : c));
                                  toast.success('Метка обновлена');
                                } catch (err) {
                                  toast.error('Ошибка');
                                }
                              }
                            }}
                            className="p-1 rounded hover:bg-zinc-100 text-zinc-400"
                            title="Добавить метку"
                          >
                            <Tag className="w-3 h-3" />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm('Удалить диалог?')) {
                                try {
                                  await axios.delete(`${API}/admin/chats/${chat.id}`);
                                  setChats(prev => prev.filter(c => c.id !== chat.id));
                                  if (selectedChat?.id === chat.id) {
                                    setSelectedChat(null);
                                    setChatMessages([]);
                                  }
                                  toast.success('Диалог удалён');
                                } catch (err) {
                                  toast.error('Ошибка удаления');
                                }
                              }
                            }}
                            className="p-1 rounded hover:bg-red-100 text-zinc-400 hover:text-red-500"
                            title="Удалить"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chat messages */}
              <div className="md:col-span-2 border border-zinc-200 overflow-hidden flex flex-col">
                {selectedChat ? (
                  <>
                    <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">{selectedChat.user_name}</span>
                        <span className="text-xs text-zinc-400 ml-2">{selectedChat.user_email}</span>
                        {selectedChat.labels?.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {selectedChat.labels.map((label, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 rounded">{label}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedChat.id);
                          toast.success('ID скопирован');
                        }}
                        className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
                        title="Скопировать ID для Telegram"
                      >
                        <Copy className="w-3 h-3" />
                        {selectedChat.id.slice(0, 8)}...
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex group ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] px-3 py-2 rounded-lg text-sm relative ${
                              msg.sender_type === 'admin'
                                ? 'bg-teal-500 text-white'
                                : 'bg-white border border-zinc-200'
                            }`}
                          >
                            {/* Media content */}
                            {msg.message_type === 'image' && msg.file_url && (
                              <div 
                                className="relative w-28 h-28 rounded overflow-hidden cursor-pointer group mb-2"
                                onClick={() => setAdminLightboxImage(msg.file_url.startsWith('http') ? msg.file_url : `${BACKEND_URL}${msg.file_url}`)}
                              >
                                <img 
                                  src={msg.file_url.startsWith('http') ? msg.file_url : `${BACKEND_URL}${msg.file_url}`} 
                                  alt="Изображение" 
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            )}
                            {msg.message_type === 'video' && msg.file_url && (
                              <div 
                                className="relative w-36 h-24 rounded overflow-hidden cursor-pointer group mb-2 bg-zinc-900"
                                onClick={() => setAdminLightboxVideo(msg.file_url.startsWith('http') ? msg.file_url : `${BACKEND_URL}${msg.file_url}`)}
                              >
                                {msg.file_url.includes('drive.google.com') ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Play className="w-8 h-8 text-white/80" />
                                  </div>
                                ) : (
                                  <video 
                                    src={msg.file_url.startsWith('http') ? msg.file_url : `${BACKEND_URL}${msg.file_url}`} 
                                    className="w-full h-full object-cover"
                                    muted
                                  />
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <Play className="w-8 h-8 text-white drop-shadow-lg" />
                                </div>
                              </div>
                            )}
                            {msg.message_type === 'file' && msg.file_url && (
                              <a 
                                href={msg.file_url.startsWith('http') ? msg.file_url : `${BACKEND_URL}${msg.file_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-zinc-100 rounded mb-2 hover:bg-zinc-200"
                              >
                                <Download className="w-4 h-4" />
                                <span className="text-xs truncate">{msg.filename || 'Файл'}</span>
                              </a>
                            )}
                            
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <div className={`flex items-center gap-1 text-[10px] mt-1 ${msg.sender_type === 'admin' ? 'text-teal-200' : 'text-zinc-400'}`}>
                              {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              {msg.edited && <span>(ред.)</span>}
                            </div>
                            
                            {/* Message actions - Delete for all, Edit only for admin messages */}
                            <div className={`absolute ${msg.sender_type === 'admin' ? '-left-16' : '-right-8'} top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1`}>
                              {msg.sender_type === 'admin' && (
                                <button
                                  onClick={async () => {
                                    const newText = prompt('Редактировать сообщение:', msg.text);
                                    if (newText && newText !== msg.text) {
                                      try {
                                        await axios.put(`${API}/admin/chats/${selectedChat.id}/messages/${msg.id}`, { text: newText });
                                        setChatMessages(prev => prev.map(m => m.id === msg.id ? {...m, text: newText, edited: true} : m));
                                        toast.success('Сообщение отредактировано');
                                      } catch (err) {
                                        toast.error('Ошибка');
                                      }
                                    }
                                  }}
                                  className="p-1 bg-white border border-zinc-200 rounded text-zinc-400 hover:text-zinc-600"
                                  title="Редактировать"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  if (window.confirm('Удалить сообщение?')) {
                                    try {
                                      await axios.delete(`${API}/admin/chats/${selectedChat.id}/messages/${msg.id}`);
                                      setChatMessages(prev => prev.filter(m => m.id !== msg.id));
                                      toast.success('Сообщение удалено');
                                    } catch (err) {
                                      toast.error('Ошибка');
                                    }
                                  }
                                }}
                                className="p-1 bg-white border border-zinc-200 rounded text-zinc-400 hover:text-red-500"
                                title="Удалить"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-zinc-200 bg-white">
                      <div className="flex gap-2">
                        {/* File upload input */}
                        <input
                          ref={adminChatFileRef}
                          type="file"
                          onChange={handleAdminChatFileUpload}
                          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
                          className="hidden"
                        />
                        <Button 
                          type="button"
                          variant="outline"
                          onClick={() => adminChatFileRef.current?.click()}
                          disabled={adminChatUploading}
                          className="px-3"
                          title="Прикрепить файл"
                        >
                          {adminChatUploading ? (
                            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Paperclip className="w-4 h-4" />
                          )}
                        </Button>
                        <Input
                          value={newAdminMessage}
                          onChange={(e) => setNewAdminMessage(e.target.value)}
                          placeholder="Введите ответ..."
                          onKeyPress={(e) => e.key === 'Enter' && handleSendAdminMessage()}
                          className="flex-1"
                        />
                        <Button onClick={handleSendAdminMessage} className="bg-teal-500 hover:bg-teal-600">
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-zinc-400 mt-2">
                        Или ответьте через Telegram: <code className="bg-zinc-100 px-1 rounded">/reply {selectedChat.id.slice(0, 8)} Ваш ответ</code>
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-zinc-400">
                    <div className="text-center">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Выберите диалог</p>
                      <p className="text-xs mt-2">Отвечайте через сайт или Telegram</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* Telegram Tab */}
          <TabsContent value="telegram">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <TelegramTab
              telegramSettings={telegramSettings}
              setTelegramSettings={setTelegramSettings}
              handleSaveTelegram={handleSaveTelegram}
              handleTestTelegram={handleTestTelegram}
            />
            </motion.div>
          </TabsContent>

          {/* Bonus Program Tab - Multiple Programs */}
          <TabsContent value="bonus" className="p-6">
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Header with Add Button */}
              <div className="bg-gradient-to-br from-teal-50/50 to-emerald-50/30 rounded-2xl p-6 border border-teal-100/50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                      <Gift className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">Бонусные программы</h2>
                      <p className="text-sm text-slate-500">{bonusPrograms.length} программ</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingProgram({
                        title: 'Новая бонусная программа',
                        description: '',
                        image_url: '',
                        levels: [],
                        prizes: [],
                        enabled: true
                      });
                      setIsNewProgram(true);
                    }}
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/20"
                    data-testid="add-bonus-program-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить программу
                  </Button>
                </div>
              </div>

              {/* Programs List */}
              {bonusPrograms.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-sm border border-dashed border-teal-200 rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <Gift className="w-8 h-8 text-teal-400" />
                  </div>
                  <p className="text-slate-600 font-medium">Нет бонусных программ</p>
                  <p className="text-sm text-slate-400 mt-1">Создайте первую программу для начала работы</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bonusPrograms.map((program) => (
                    <div key={program.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
                      {/* Program Header */}
                      <div 
                        className={`px-6 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                          selectedProgramId === program.id 
                            ? 'bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-200' 
                            : 'hover:bg-slate-50'
                        }`}
                        onClick={async () => {
                          if (selectedProgramId === program.id) {
                            setSelectedProgramId(null);
                            setProgramUsers([]);
                          } else {
                            setSelectedProgramId(program.id);
                            try {
                              const res = await axios.get(`${API}/admin/bonus/programs/${program.id}/users`);
                              setProgramUsers(res.data.users || []);
                            } catch (err) {
                              toast.error('Ошибка загрузки пользователей');
                            }
                          }
                        }}
                      >
                        <div className="flex items-center gap-4">
                          {program.image_url ? (
                            <img src={program.image_url} alt="" className="w-14 h-14 rounded-xl object-cover shadow-sm" />
                          ) : (
                            <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-xl flex items-center justify-center">
                              <Gift className="w-7 h-7 text-teal-500" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                              {program.title}
                              {!program.enabled && (
                                <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Отключена</span>
                              )}
                              {program.pending_requests > 0 && (
                                <span className="text-xs bg-gradient-to-r from-red-500 to-rose-500 text-white px-2.5 py-0.5 rounded-full animate-pulse shadow-sm">
                                  {program.pending_requests} запросов
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-slate-500 mt-0.5">
                              {program.levels?.length > 0 
                                ? `${program.levels.length} уровней • Баллы по % от уровня`
                                : 'Уровни не настроены'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 rounded-lg bg-slate-100 hover:bg-teal-100 text-slate-500 hover:text-teal-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProgram({...program});
                              setIsNewProgram(false);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 transition-colors"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Удалить программу "${program.title}"?`)) {
                                try {
                                  await axios.delete(`${API}/admin/bonus/programs/${program.id}`);
                                  toast.success('Программа удалена');
                                  setBonusPrograms(prev => prev.filter(p => p.id !== program.id));
                                  if (selectedProgramId === program.id) {
                                    setSelectedProgramId(null);
                                  }
                                } catch (err) {
                                  toast.error('Ошибка удаления');
                                }
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${
                            selectedProgramId === program.id ? 'rotate-180' : ''
                          }`} />
                        </div>
                      </div>

                      {/* Program Users (Expandable) */}
                      {selectedProgramId === program.id && (
                        <div className="border-t border-slate-100">
                          <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-3 flex items-center gap-2">
                            <Users className="w-4 h-4 text-teal-500" />
                            <span className="text-sm font-medium text-slate-600">Пользователи программы</span>
                            <span className="text-xs bg-teal-100 text-teal-600 px-2 py-0.5 rounded-full">{programUsers.length}</span>
                          </div>
                          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full">
                              <thead className="sticky top-0 bg-white shadow-sm">
                                <tr className="bg-slate-50/80">
                                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Пользователь</th>
                                  <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Баллы</th>
                                  <th className="text-center py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Уровень</th>
                                  <th className="text-center py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Статус</th>
                                  <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Действия</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {programUsers.map((pu) => (
                                  <tr 
                                    key={pu.id} 
                                    className="transition-colors hover:bg-slate-50"
                                  >
                                    <td className="py-3 px-6">
                                      <span className="font-medium text-slate-800">{pu.name}</span>
                                    </td>
                                    <td className="py-3 px-6 text-right">
                                      <span className="font-mono font-semibold text-slate-700">
                                        {pu.current_amount?.toFixed(0) || 0}
                                      </span>
                                    </td>
                                    <td className="py-3 px-6 text-center">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-teal-100 to-emerald-100 text-teal-700">
                                        {pu.current_level?.name || 'Бронза'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-6 text-center">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                                        Активен
                                      </span>
                                    </td>
                                    <td className="py-3 px-6 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7 px-2 text-xs"
                                          onClick={() => setPointsModal({ action: 'add', userId: pu.id, userName: pu.name, programId: program.id })}
                                          data-testid={`add-points-${pu.id}`}>
                                          <Plus className="w-3 h-3 mr-1" />Начислить
                                        </Button>
                                        <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
                                          onClick={() => setPointsModal({ action: 'remove', userId: pu.id, userName: pu.name, programId: program.id })}
                                          data-testid={`remove-points-${pu.id}`}>
                                          <Minus className="w-3 h-3 mr-1" />Списать
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500 h-7 px-1.5"
                                          onClick={async () => {
                                            if (!window.confirm(`Обнулить баллы для ${pu.name}?`)) return;
                                            try {
                                              await axios.post(`${API}/admin/bonus/programs/${program.id}/users/${pu.id}/reset-points`);
                                              toast.success('Баллы обнулены');
                                              const res = await axios.get(`${API}/admin/bonus/programs/${program.id}/users`);
                                              setProgramUsers(res.data.users || []);
                                            } catch { toast.error('Ошибка'); }
                                          }}
                                          data-testid={`reset-points-${pu.id}`}
                                          title="Обнулить баллы">
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {programUsers.length === 0 && (
                                  <tr>
                                    <td colSpan="5" className="py-8 text-center text-slate-400">
                                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                      Нет пользователей
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Combined History & Prize Requests Section */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">История и запросы призов</h3>
                      <p className="text-sm text-slate-500">
                        {prizeRedemptions.length} запросов
                        {prizeRedemptions.filter(r => r.status === 'pending').length > 0 && (
                          <span className="ml-2 text-teal-500 font-medium">
                            ({prizeRedemptions.filter(r => r.status === 'pending').length} ожидают)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {prizeRedemptions.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Нет запросов на призы</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {prizeRedemptions.map(redemption => (
                        <div key={redemption.id} className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                          redemption.status === 'pending' ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' :
                          redemption.status === 'approved' ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200' :
                          redemption.status === 'issued' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200' :
                          'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-800">{redemption.user_name || redemption.user_email}</p>
                              <p className="text-sm text-slate-600 mt-0.5">
                                Приз: <span className="font-medium text-slate-800">{redemption.prize_name}</span> 
                                <span className="text-slate-400 ml-1">({redemption.points_cost} баллов)</span>
                              </p>
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(redemption.created_at).toLocaleDateString('ru-RU')} — 
                                <span className={`font-medium ${
                                  redemption.status === 'pending' ? 'text-yellow-600' :
                                  redemption.status === 'approved' ? 'text-emerald-600' :
                                  redemption.status === 'issued' ? 'text-blue-600' :
                                  'text-red-600'
                                }`}>
                                  {redemption.status === 'pending' && ' Ожидает'}
                                  {redemption.status === 'approved' && ' Одобрен'}
                                  {redemption.status === 'issued' && ' Выдан'}
                                  {redemption.status === 'rejected' && ' Отклонён'}
                                </span>
                              </p>
                            </div>
                            {redemption.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-sm" onClick={async () => {
                                  try {
                                    await axios.put(`${API}/admin/prize-redemptions/${redemption.id}?status=approved`);
                                    setPrizeRedemptions(prev => prev.map(r => r.id === redemption.id ? {...r, status: 'approved'} : r));
                                    toast.success('Приз одобрен');
                                  } catch (err) { toast.error('Ошибка'); }
                                }} data-testid={`approve-prize-${redemption.id}`}>
                                  Одобрить
                                </Button>
                                <Button size="sm" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-sm" onClick={async () => {
                                  try {
                                    await axios.put(`${API}/admin/prize-redemptions/${redemption.id}?status=issued`);
                                    setPrizeRedemptions(prev => prev.map(r => r.id === redemption.id ? {...r, status: 'issued'} : r));
                                    toast.success('Приз выдан');
                                  } catch (err) { toast.error('Ошибка'); }
                                }} data-testid={`issue-prize-${redemption.id}`}>
                                  Выдать
                                </Button>
                                <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={async () => {
                                  try {
                                    await axios.put(`${API}/admin/prize-redemptions/${redemption.id}?status=rejected`);
                                    setPrizeRedemptions(prev => prev.map(r => r.id === redemption.id ? {...r, status: 'rejected'} : r));
                                    toast.success('Приз отклонён');
                                  } catch (err) { toast.error('Ошибка'); }
                                }} data-testid={`reject-prize-${redemption.id}`}>
                                  Отклонить
                                </Button>
                              </div>
                            )}
                            {redemption.status === 'approved' && (
                              <Button size="sm" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-sm" onClick={async () => {
                                try {
                                  await axios.put(`${API}/admin/prize-redemptions/${redemption.id}?status=issued`);
                                  setPrizeRedemptions(prev => prev.map(r => r.id === redemption.id ? {...r, status: 'issued'} : r));
                                  toast.success('Приз выдан');
                                } catch (err) { toast.error('Ошибка'); }
                              }}>
                                Выдать
                              </Button>
                            )}
                            {(redemption.status === 'issued' || redemption.status === 'rejected') && (
                              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500" onClick={async () => {
                                if (!window.confirm('Удалить этот запрос из истории?')) return;
                                try {
                                  await axios.delete(`${API}/admin/bonus/prize-redemptions/${redemption.id}`);
                                  setPrizeRedemptions(prev => prev.filter(r => r.id !== redemption.id));
                                  toast.success('Запрос удалён');
                                } catch (err) { toast.error('Ошибка'); }
                              }} data-testid={`delete-redemption-${redemption.id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* Edit Bonus Program Modal */}
          <Dialog open={!!editingProgram} onOpenChange={() => setEditingProgram(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isNewProgram ? 'Создать бонусную программу' : 'Редактировать программу'}</DialogTitle>
              </DialogHeader>
              {editingProgram && (
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Заголовок</Label>
                    <Input
                      value={editingProgram.title || ''}
                      onChange={(e) => setEditingProgram({...editingProgram, title: e.target.value})}
                      placeholder="Название программы"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Краткое описание</Label>
                    <Input
                      value={editingProgram.description || ''}
                      onChange={(e) => setEditingProgram({...editingProgram, description: e.target.value})}
                      placeholder="Короткое описание для карточки"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Расширенное описание</Label>
                    <Textarea
                      value={editingProgram.full_description || ''}
                      onChange={(e) => setEditingProgram({...editingProgram, full_description: e.target.value})}
                      placeholder="Подробное описание программы, условия участия, правила начисления баллов..."
                      className="mt-1 min-h-[100px]"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Изображение программы</Label>
                    <div className="mt-1 flex items-center gap-4">
                      <input
                        type="file"
                        ref={bonusImageFileRef}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleFileUpload(file, 'bonus');
                            if (url) {
                              setEditingProgram({...editingProgram, image_url: url});
                            }
                          }
                        }}
                        accept="image/*"
                        className="hidden"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => bonusImageFileRef.current?.click()}
                        disabled={uploading}
                        size="sm"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? 'Загрузка...' : 'Загрузить'}
                      </Button>
                      {editingProgram.image_url && (
                        <div className="flex items-center gap-2">
                          <img src={editingProgram.image_url} alt="Preview" className="h-12 object-contain rounded" />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingProgram({...editingProgram, image_url: ''})}
                            className="text-red-500 h-8 px-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Banner Image */}
                  <div className="border-t pt-4">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Баннер (отображается на странице бонусов)</Label>
                    <div className="mt-2">
                      <input
                        type="file"
                        ref={bonusBannerFileRef}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleFileUpload(file, 'bonus_banner');
                            if (url) {
                              setEditingProgram({...editingProgram, banner_url: url});
                            }
                          }
                        }}
                        accept="image/*"
                        className="hidden"
                      />
                      
                      {editingProgram.banner_url ? (
                        <div className="space-y-3">
                          <div className="flex justify-center bg-zinc-100 rounded-lg p-4">
                            <img 
                              src={editingProgram.banner_url} 
                              alt="Banner Preview" 
                              className="rounded-lg object-cover"
                              style={{ height: editingProgram.banner_height || 200 }}
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Label className="text-xs text-zinc-500">Высота баннера (px)</Label>
                              <Input
                                type="number"
                                value={editingProgram.banner_height || 200}
                                onChange={(e) => setEditingProgram({...editingProgram, banner_height: parseInt(e.target.value) || 200})}
                                min={100}
                                max={600}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-zinc-500">Размер заголовка (px)</Label>
                              <Input
                                type="number"
                                value={editingProgram.header_font_size || 14}
                                onChange={(e) => setEditingProgram({...editingProgram, header_font_size: parseInt(e.target.value) || 14})}
                                min={12}
                                max={48}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex gap-2 pt-5">
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => bonusBannerFileRef.current?.click()}
                                disabled={uploading}
                                size="sm"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Заменить
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setEditingProgram({...editingProgram, banner_url: '', banner_height: 200})}
                                className="text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => bonusBannerFileRef.current?.click()}
                          disabled={uploading}
                          className="w-full h-24 border-dashed"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="w-6 h-6 text-zinc-400" />
                            <span className="text-sm text-zinc-500">{uploading ? 'Загрузка...' : 'Загрузить баннер'}</span>
                          </div>
                        </Button>
                      )}
                      
                      {/* Header Font Size - always visible */}
                      <div className="mt-4">
                        <Label className="text-xs text-zinc-500">Размер заголовка "Бонусная программа" (px)</Label>
                        <Input
                          type="number"
                          value={editingProgram.header_font_size || 14}
                          onChange={(e) => setEditingProgram({...editingProgram, header_font_size: parseInt(e.target.value) || 14})}
                          min={12}
                          max={48}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prizes Section */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-xs font-bold uppercase text-zinc-500">Призы</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newPrize = {
                            id: `prize_${Date.now()}`,
                            name: '',
                            description: '',
                            image_url: '',
                            points_cost: 1000,
                            quantity: -1,
                            enabled: true
                          };
                          setEditingProgram({
                            ...editingProgram, 
                            prizes: [...(editingProgram.prizes || []), newPrize]
                          });
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Добавить приз
                      </Button>
                    </div>
                    
                    {(editingProgram.prizes || []).length === 0 ? (
                      <p className="text-sm text-zinc-400 text-center py-4">
                        Нет призов. Добавьте призы, которые пользователи смогут получить за баллы.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(editingProgram.prizes || []).map((prize, idx) => (
                          <div key={prize.id} className="border rounded-lg p-3 bg-zinc-50">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex flex-col gap-0.5 mr-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const prizes = [...(editingProgram.prizes || [])];
                                    [prizes[idx - 1], prizes[idx]] = [prizes[idx], prizes[idx - 1]];
                                    setEditingProgram({...editingProgram, prizes});
                                  }}
                                  className={`p-0.5 rounded transition-colors ${idx === 0 ? 'text-zinc-300' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200'}`}
                                  data-testid={`prize-move-up-${idx}`}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === (editingProgram.prizes || []).length - 1}
                                  onClick={() => {
                                    const prizes = [...(editingProgram.prizes || [])];
                                    [prizes[idx], prizes[idx + 1]] = [prizes[idx + 1], prizes[idx]];
                                    setEditingProgram({...editingProgram, prizes});
                                  }}
                                  className={`p-0.5 rounded transition-colors ${idx === (editingProgram.prizes || []).length - 1 ? 'text-zinc-300' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200'}`}
                                  data-testid={`prize-move-down-${idx}`}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              </div>
                              <span className="text-xs font-mono text-zinc-400 mt-2 mr-1">#{idx + 1}</span>
                              <Input
                                value={prize.name}
                                onChange={(e) => {
                                  const updatedPrizes = [...(editingProgram.prizes || [])];
                                  updatedPrizes[idx].name = e.target.value;
                                  setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                }}
                                placeholder="Название приза"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500"
                                onClick={() => {
                                  const updatedPrizes = (editingProgram.prizes || []).filter((_, i) => i !== idx);
                                  setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            {/* Prize image upload */}
                            <div className="flex items-center gap-3 mb-2">
                              {prize.image_url ? (
                                <img src={prize.image_url} alt={prize.name} className="w-16 h-16 object-cover rounded" />
                              ) : (
                                <div className="w-16 h-16 bg-zinc-200 rounded flex items-center justify-center">
                                  <Gift className="w-6 h-6 text-zinc-400" />
                                </div>
                              )}
                              <div className="flex-1">
                                <input
                                  type="file"
                                  id={`prize-image-${idx}`}
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const url = await handleFileUpload(file, 'prizes');
                                      if (url) {
                                        const updatedPrizes = [...(editingProgram.prizes || [])];
                                        updatedPrizes[idx].image_url = url;
                                        setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById(`prize-image-${idx}`).click()}
                                  disabled={uploading}
                                >
                                  <Upload className="w-3 h-3 mr-1" />
                                  {prize.image_url ? 'Заменить' : 'Фото'}
                                </Button>
                                {prize.image_url && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 ml-1"
                                    onClick={() => {
                                      const updatedPrizes = [...(editingProgram.prizes || [])];
                                      updatedPrizes[idx].image_url = '';
                                      setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                    }}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            <Input
                              value={prize.description || ''}
                              onChange={(e) => {
                                const updatedPrizes = [...(editingProgram.prizes || [])];
                                updatedPrizes[idx].description = e.target.value;
                                setEditingProgram({...editingProgram, prizes: updatedPrizes});
                              }}
                              placeholder="Описание приза"
                              className="mb-2"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[10px] text-zinc-400">Стоимость (баллов)</Label>
                                <Input
                                  type="number"
                                  value={prize.points_cost || 0}
                                  onChange={(e) => {
                                    const updatedPrizes = [...(editingProgram.prizes || [])];
                                    updatedPrizes[idx].points_cost = parseFloat(e.target.value) || 0;
                                    setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                  }}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-zinc-400">Количество (-1 = ∞)</Label>
                                <Input
                                  type="number"
                                  value={prize.quantity}
                                  onChange={(e) => {
                                    const updatedPrizes = [...(editingProgram.prizes || [])];
                                    updatedPrizes[idx].quantity = parseInt(e.target.value) || -1;
                                    setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                  }}
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={prize.enabled}
                                    onChange={(e) => {
                                      const updatedPrizes = [...(editingProgram.prizes || [])];
                                      updatedPrizes[idx].enabled = e.target.checked;
                                      setEditingProgram({...editingProgram, prizes: updatedPrizes});
                                    }}
                                    className="rounded"
                                  />
                                  Активен
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Levels Section - Multi-tier system */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-xs font-bold uppercase text-zinc-500">Уровни программы</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newLevel = {
                            id: `level_${Date.now()}`,
                            name: '',
                            min_points: 0,
                            cashback_percent: 0,
                            color: '#f97316',
                            benefits: ''
                          };
                          setEditingProgram({
                            ...editingProgram, 
                            levels: [...(editingProgram.levels || []), newLevel]
                          });
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Добавить уровень
                      </Button>
                    </div>
                    
                    {(editingProgram.levels || []).length === 0 ? (
                      <p className="text-sm text-zinc-400 text-center py-4">
                        Нет уровней. Добавьте уровни для многоуровневой бонусной программы (например: Бронза, Серебро, Золото).
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(editingProgram.levels || []).map((level, idx) => (
                          <div key={level.id} className="border rounded-lg p-3" style={{ borderLeftColor: level.color, borderLeftWidth: '4px' }}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Input
                                value={level.name}
                                onChange={(e) => {
                                  const updatedLevels = [...(editingProgram.levels || [])];
                                  updatedLevels[idx].name = e.target.value;
                                  setEditingProgram({...editingProgram, levels: updatedLevels});
                                }}
                                placeholder="Название уровня (напр: Золото)"
                                className="flex-1"
                              />
                              <input
                                type="color"
                                value={level.color || '#f97316'}
                                onChange={(e) => {
                                  const updatedLevels = [...(editingProgram.levels || [])];
                                  updatedLevels[idx].color = e.target.value;
                                  setEditingProgram({...editingProgram, levels: updatedLevels});
                                }}
                                className="w-10 h-10 rounded cursor-pointer"
                                title="Цвет уровня"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500"
                                onClick={() => {
                                  const updatedLevels = (editingProgram.levels || []).filter((_, i) => i !== idx);
                                  setEditingProgram({...editingProgram, levels: updatedLevels});
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <Label className="text-[10px] text-zinc-400">Мин. баллов для уровня</Label>
                                <Input
                                  type="number"
                                  value={level.min_points || 0}
                                  onChange={(e) => {
                                    const updatedLevels = [...(editingProgram.levels || [])];
                                    updatedLevels[idx].min_points = parseFloat(e.target.value) || 0;
                                    setEditingProgram({...editingProgram, levels: updatedLevels});
                                  }}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-zinc-400">Кешбэк (%)</Label>
                                <Input
                                  type="number"
                                  value={level.cashback_percent || 0}
                                  onChange={(e) => {
                                    const updatedLevels = [...(editingProgram.levels || [])];
                                    updatedLevels[idx].cashback_percent = parseFloat(e.target.value) || 0;
                                    setEditingProgram({...editingProgram, levels: updatedLevels});
                                  }}
                                  className="mt-1"
                                  min="0"
                                  max="100"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px] text-zinc-400">Привилегии уровня</Label>
                              <Input
                                value={level.benefits || ''}
                                onChange={(e) => {
                                  const updatedLevels = [...(editingProgram.levels || [])];
                                  updatedLevels[idx].benefits = e.target.value;
                                  setEditingProgram({...editingProgram, levels: updatedLevels});
                                }}
                                placeholder="Например: Бесплатная доставка, приоритетная поддержка"
                                className="mt-1"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingProgram.enabled}
                      onCheckedChange={(checked) => setEditingProgram({...editingProgram, enabled: checked})}
                    />
                    <span className={editingProgram.enabled ? 'text-green-600' : 'text-zinc-400'}>
                      {editingProgram.enabled ? 'Активна' : 'Отключена'}
                    </span>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setEditingProgram(null)}>
                      Отмена
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          if (isNewProgram) {
                            const res = await axios.post(`${API}/admin/bonus/programs`, editingProgram);
                            toast.success('Программа создана');
                            setBonusPrograms(prev => [...prev, res.data]);
                          } else {
                            await axios.put(`${API}/admin/bonus/programs/${editingProgram.id}`, editingProgram);
                            toast.success('Программа обновлена');
                            setBonusPrograms(prev => prev.map(p => p.id === editingProgram.id ? { ...p, ...editingProgram } : p));
                          }
                          setEditingProgram(null);
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Ошибка сохранения');
                        }
                      }}
                      className="bg-teal-500 hover:bg-teal-600"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isNewProgram ? 'Создать' : 'Сохранить'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Points Management Modal */}
          <Dialog open={!!pointsModal} onOpenChange={() => setPointsModal(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {pointsModal?.action === 'add' ? (
                    <><Plus className="w-5 h-5 text-emerald-500" /> Начислить баллы</>
                  ) : (
                    <><Minus className="w-5 h-5 text-red-500" /> Списать баллы</>
                  )}
                </DialogTitle>
              </DialogHeader>
              {pointsModal && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  const amount = parseFloat(fd.get('amount'));
                  const reason = fd.get('reason') || '';
                  if (!amount || amount <= 0) { toast.error('Укажите сумму'); return; }
                  try {
                    const url = pointsModal.action === 'add'
                      ? `${API}/admin/bonus/programs/${pointsModal.programId}/users/${pointsModal.userId}/add-points`
                      : `${API}/admin/bonus/programs/${pointsModal.programId}/users/${pointsModal.userId}/remove-points`;
                    const res = await axios.post(url, { amount, reason });
                    toast.success(`${pointsModal.action === 'add' ? 'Начислено' : 'Списано'}: ${amount} баллов`);
                    setPointsModal(null);
                    const usersRes = await axios.get(`${API}/admin/bonus/programs/${pointsModal.programId}/users`);
                    setProgramUsers(usersRes.data.users || []);
                  } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка'); }
                }} className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="font-medium text-slate-800">{pointsModal.userName}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Количество баллов</Label>
                    <Input name="amount" type="number" min="1" step="1" required autoFocus placeholder="100" className="mt-1 font-mono" data-testid="points-amount-input" />
                  </div>
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Причина (опц.)</Label>
                    <Input name="reason" placeholder="Бонус за отзыв" className="mt-1" data-testid="points-reason-input" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" type="button" onClick={() => setPointsModal(null)}>Отмена</Button>
                    <Button type="submit" className={pointsModal.action === 'add' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'} data-testid="points-submit-btn">
                      {pointsModal.action === 'add' ? 'Начислить' : 'Списать'}
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Payment Settings Tab */}
          <TabsContent value="discounts">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <DiscountsTab
              paymentSettings={paymentSettings}
              setPaymentSettings={setPaymentSettings}
              cryptoWallets={cryptoWallets}
              setCryptoWallets={setCryptoWallets}
              prepaymentSettings={prepaymentSettings}
              setPrepaymentSettings={setPrepaymentSettings}
              handleSavePaymentSettings={handleSavePaymentSettings}
              handleSaveCryptoWallets={handleSaveCryptoWallets}
              handleSavePrepaymentSettings={handleSavePrepaymentSettings}
            />
            </motion.div>
          </TabsContent>

          {/* Partners Tab */}

          {/* News Tab */}
          <TabsContent value="news" className="p-6">
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Управление новостями</h2>
                <Button onClick={() => { setEditingNews(null); setNewsForm({ title: '', content: '', image_url: '' }); document.getElementById('news-form')?.scrollIntoView(); }} className="bg-teal-500 hover:bg-teal-600" data-testid="add-news-btn">
                  <Plus className="w-4 h-4 mr-2" /> Добавить новость
                </Button>
              </div>

              {/* News form */}
              <div id="news-form" className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                <h3 className="font-semibold">{editingNews ? 'Редактировать новость' : 'Новая публикация'}</h3>
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Заголовок</Label>
                  <Input value={newsForm.title} onChange={(e) => setNewsForm({...newsForm, title: e.target.value})}
                    placeholder="Заголовок новости" className="mt-1" data-testid="news-title-input" />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Содержание</Label>
                  <div className="mt-1">
                    <RichTextEditor
                      value={newsForm.content}
                      onChange={(val) => setNewsForm({...newsForm, content: val})}
                      placeholder="Текст новости... Используйте **жирный**, _курсив_, вставляйте фото и эмодзи"
                      enableImages
                      minHeight={150}
                    />
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">Формат: **жирный**, _курсив_, [ссылка](url), - список. Фото вставляются через панель инструментов.</p>
                </div>
                <Button onClick={async () => {
                  if (!newsForm.title || !newsForm.content) { toast.error('Заполните заголовок и содержание'); return; }
                  try {
                    if (editingNews) {
                      await axios.put(`${API}/admin/news/${editingNews.id}`, newsForm);
                      setNewsList(prev => prev.map(n => n.id === editingNews.id ? {...n, ...newsForm} : n));
                      toast.success('Новость обновлена');
                    } else {
                      const res = await axios.post(`${API}/admin/news`, newsForm);
                      setNewsList(prev => [res.data, ...prev]);
                      toast.success('Новость опубликована');
                    }
                    setNewsForm({ title: '', content: '', image_url: '' });
                    setEditingNews(null);
                  } catch (err) { toast.error('Ошибка сохранения'); }
                }} className="bg-teal-500 hover:bg-teal-600" data-testid="save-news-btn">
                  <Save className="w-4 h-4 mr-2" /> {editingNews ? 'Обновить' : 'Опубликовать'}
                </Button>
              </div>

              {/* News list */}
              <div className="space-y-3">
                {newsList.map(article => (
                  <div key={article.id} className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-800">{article.title}</p>
                      <p className="text-sm text-zinc-500 line-clamp-1">{article.content}</p>
                      <p className="text-xs text-zinc-400 mt-1">{new Date(article.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => { setEditingNews(article); setNewsForm({ title: article.title, content: article.content, image_url: article.image_url || '' }); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={async () => {
                        if (!window.confirm('Удалить новость?')) return;
                        try {
                          await axios.delete(`${API}/admin/news/${article.id}`);
                          setNewsList(prev => prev.filter(n => n.id !== article.id));
                          toast.success('Новость удалена');
                        } catch (err) { toast.error('Ошибка'); }
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="partners">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <PartnersTab
              partners={partners}
              setPartners={setPartners}
              setIsNewPartner={setIsNewPartner}
              setEditingPartner={setEditingPartner}
              handleAddDefaultPartners={handleAddDefaultPartners}
              handleDeletePartner={handleDeletePartner}
            />
            </motion.div>
          </TabsContent>

          {/* Terms of Service Tab */}
          <TabsContent value="terms">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <TermsTab
              termsSections={termsSections}
              setTermsSections={setTermsSections}
              termsSaving={termsSaving}
              handleSaveTerms={handleSaveTerms}
              handleResetTerms={handleResetTerms}
            />
            </motion.div>
          </TabsContent>

          {/* Email Notifications Tab */}
          <TabsContent value="notifications">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <NotificationsTab
              notificationSettings={notificationSettings}
              setNotificationSettings={setNotificationSettings}
              testEmail={testEmail}
              setTestEmail={setTestEmail}
              bulkEmailForm={bulkEmailForm}
              setBulkEmailForm={setBulkEmailForm}
              sendingEmail={sendingEmail}
              users={users}
              handleSaveNotificationSettings={handleSaveNotificationSettings}
              handleSendTestEmail={handleSendTestEmail}
              handleSendBulkEmail={handleSendBulkEmail}
            />
            </motion.div>
          </TabsContent>

          {/* NEW COMBINED TABS */}
          
          {/* Payments Tab - combines payment methods, prepayment, crypto */}
          <TabsContent value="payments" className="p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <PaymentsTab
              paymentSettings={paymentSettings}
              setPaymentSettings={setPaymentSettings}
              handleSavePaymentSettings={handleSavePaymentSettings}
              prepaymentSettings={prepaymentSettings}
              setPrepaymentSettings={setPrepaymentSettings}
              handleSavePrepaymentSettings={handleSavePrepaymentSettings}
              isDark={isDark}
            />
            </motion.div>
          </TabsContent>

          {/* CRM Tab - combines users and analytics */}
          <TabsContent value="crm" className="p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <CRMTab
              users={users}
              setUsers={setUsers}
              stats={stats}
              formatPrice={formatPrice}
              handleEditUser={handleEditUser}
              handleDeleteUser={handleDeleteUser}
              handleBlockUser={handleBlockUser}
              onViewAnalytics={setAnalyticsUser}
              isDark={isDark}
            />
            </motion.div>
          </TabsContent>

          {/* Marketing Tab - combines promo, news, newsletters */}
          <TabsContent value="marketing" className="p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <MarketingTab
              promoBanner={promoBanner}
              setPromoBanner={setPromoBanner}
              handleSavePromoBanner={handleSavePromoBanner}
              uploading={uploading}
              handlePromoImageUpload={handlePromoImageUpload}
              promoFileRef={promoFileRef}
              bonusPrograms={bonusPrograms}
              setBonusPrograms={setBonusPrograms}
              news={newsList}
              setNews={setNewsList}
              notificationSettings={notificationSettings}
              setNotificationSettings={setNotificationSettings}
              handleSaveNotificationSettings={handleSaveNotificationSettings}
              testEmail={testEmail}
              setTestEmail={setTestEmail}
              handleSendTestEmail={handleSendTestEmail}
              bulkEmailForm={bulkEmailForm}
              setBulkEmailForm={setBulkEmailForm}
              handleSendBulkEmail={handleSendBulkEmail}
              sendingEmail={sendingEmail}
              users={users}
              isDark={isDark}
            />
            </motion.div>
          </TabsContent>

          {/* Logs Tab - Action Logging & Developer Mode */}
          <TabsContent value="logs" className="p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <LogsTab isDark={isDark} />
            </motion.div>
          </TabsContent>

          {/* Settings Tab - combines telegram, partners, terms */}
          <TabsContent value="settings" className="p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
            <SettingsTab
              telegramConfig={telegramSettings}
              setTelegramConfig={setTelegramSettings}
              handleSaveTelegramConfig={handleSaveTelegram}
              handleTestTelegram={handleTestTelegram}
              partners={partners}
              setPartners={setPartners}
              editingPartner={editingPartner}
              setEditingPartner={setEditingPartner}
              isNewPartner={isNewPartner}
              setIsNewPartner={setIsNewPartner}
              handleAddDefaultPartners={handleAddDefaultPartners}
              handleDeletePartner={handleDeletePartner}
              handleSavePartner={handleSavePartner}
              handlePartnerImageUpload={handlePartnerImageUpload}
              partnerImageUploading={partnerImageUploading}
              partnerImageRef={partnerImageRef}
              termsSections={termsSections}
              setTermsSections={setTermsSections}
              handleSaveTerms={handleSaveTerms}
              handleResetTerms={handleResetTerms}
              termsSaving={termsSaving}
              isDark={isDark}
            />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Product Modal - Modern Design */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50" data-testid="product-edit-modal">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Package className="w-5 h-5 text-white" />
              </div>
              <span className="text-slate-800">{isNewProduct ? 'Добавить товар' : 'Редактировать товар'}</span>
            </DialogTitle>
          </DialogHeader>
          
          {editingProduct && (
            <div className="space-y-5 mt-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-teal-600">Название *</Label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="mt-1.5 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                  data-testid="product-name-input"
                />
              </div>
              
              <div>
                <Label className="text-xs font-semibold uppercase text-teal-600">Артикул *</Label>
                <Input
                  value={editingProduct.article}
                  onChange={(e) => setEditingProduct({ ...editingProduct, article: e.target.value })}
                  className="mt-1.5 border-slate-200 focus:border-teal-500 focus:ring-teal-500 font-mono"
                  data-testid="product-article-input"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-teal-600">Производитель</Label>
                <Input
                  value={editingProduct.manufacturer || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, manufacturer: e.target.value })}
                  placeholder="Например: SACHS, BPW, MAN"
                  className="mt-1.5 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                  data-testid="product-manufacturer-input"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-teal-600">Категория</Label>
                <select
                  value={editingProduct.category_id || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value || null })}
                  className="mt-1.5 w-full h-10 px-3 border border-slate-200 bg-white rounded-md focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  data-testid="product-category-select"
                >
                  <option value="">Без категории</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                  <Label className="text-xs font-semibold uppercase text-teal-600">Цена *</Label>
                  <Input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="mt-1.5 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                    data-testid="product-price-input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase text-teal-600">Наличие</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, stock: editingProduct.stock > 0 ? 0 : 1 })}
                      className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                        editingProduct.stock > 0 ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      data-testid="product-stock-toggle"
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                          editingProduct.stock > 0 ? 'translate-x-9' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-medium ${editingProduct.stock > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {editingProduct.stock > 0 ? 'В наличии' : 'Нет в наличии'}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase text-teal-600">Доставка (дней)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editingProduct.delivery_days ?? 3}
                    onChange={(e) => {
                      const v = e.target.value;
                      const parsed = v === '' ? 0 : parseInt(v);
                      setEditingProduct({ ...editingProduct, delivery_days: isNaN(parsed) ? 0 : Math.max(0, parsed) });
                    }}
                    className="mt-1.5 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                    data-testid="product-delivery-input"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">0 = «Сегодня», 1 = «1 день», и т.д.</p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-teal-600">Склад</Label>
                <select
                  value={editingProduct.warehouse || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, warehouse: e.target.value })}
                  className="mt-1.5 w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-teal-500 focus:ring-teal-500 focus:outline-none"
                  data-testid="product-warehouse-select"
                >
                  <option value="">Не указан</option>
                  <option value="Ростов">Ростов</option>
                  <option value="Пятигорск">Пятигорск</option>
                  <option value="Москва">Москва</option>
                  <option value="Новосибирск">Новосибирск</option>
                </select>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer" data-testid="product-original-toggle">
                  <input
                    type="checkbox"
                    checked={editingProduct.is_original || false}
                    onChange={(e) => setEditingProduct({ ...editingProduct, is_original: e.target.checked })}
                    className="w-4 h-4 accent-teal-500 rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700">Оригинал</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer" data-testid="product-guarantee-toggle">
                  <input
                    type="checkbox"
                    checked={editingProduct.has_guarantee || false}
                    onChange={(e) => setEditingProduct({ ...editingProduct, has_guarantee: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700">Гарантия</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer" data-testid="product-bonus-toggle">
                  <input
                    type="checkbox"
                    checked={editingProduct.bonus_eligible !== false}
                    onChange={(e) => setEditingProduct({ ...editingProduct, bonus_eligible: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700">Участвует в бонусной программе</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer" data-testid="product-isnew-toggle">
                  <input
                    type="checkbox"
                    checked={editingProduct.is_new === true}
                    onChange={(e) => setEditingProduct({ ...editingProduct, is_new: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span className="text-sm font-medium text-zinc-700">Новинка (14 дней)</span>
                </label>
              </div>

              {/* Discount/Promo Section */}
              <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/50 to-pink-50/30 p-4 space-y-3" data-testid="product-discount-section">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">%</span>
                    </div>
                    <Label className="text-sm font-bold text-rose-700">Скидка / Акция</Label>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer" data-testid="product-discount-toggle">
                    <input
                      type="checkbox"
                      checked={editingProduct.discount_active === true}
                      onChange={(e) => {
                        const next = { ...editingProduct, discount_active: e.target.checked };
                        // When enabling discount, ensure discount_type has a sensible default
                        if (e.target.checked && !next.discount_type) {
                          next.discount_type = 'percent';
                        }
                        setEditingProduct(next);
                      }}
                      className="w-4 h-4 accent-rose-500 rounded"
                    />
                    <span className="text-sm font-medium text-zinc-700">Включена</span>
                  </label>
                </div>

                {editingProduct.discount_active && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold uppercase text-rose-600">Тип скидки</Label>
                        <select
                          value={editingProduct.discount_type || 'percent'}
                          onChange={(e) => setEditingProduct({ ...editingProduct, discount_type: e.target.value })}
                          className="mt-1.5 w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-rose-500 focus:outline-none"
                          data-testid="product-discount-type"
                        >
                          <option value="percent">Процент (%)</option>
                          <option value="amount">Сумма (₽)</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase text-rose-600">
                          Значение {editingProduct.discount_type === 'amount' ? '(₽)' : '(%)'}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingProduct.discount_value ?? ''}
                          onChange={(e) => setEditingProduct({ ...editingProduct, discount_value: parseFloat(e.target.value) || 0 })}
                          placeholder={editingProduct.discount_type === 'amount' ? '500' : '15'}
                          className="mt-1.5 border-slate-200 focus:border-rose-500"
                          data-testid="product-discount-value"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase text-rose-600">Название акции</Label>
                      <Input
                        type="text"
                        value={editingProduct.discount_label || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, discount_label: e.target.value })}
                        placeholder="Например: Чёрная пятница"
                        className="mt-1.5 border-slate-200 focus:border-rose-500"
                        data-testid="product-discount-label"
                        maxLength={60}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase text-rose-600">Описание акции</Label>
                      <textarea
                        rows={2}
                        value={editingProduct.discount_description || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, discount_description: e.target.value })}
                        placeholder="Краткое описание, отображается в подсказке"
                        className="mt-1.5 w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:border-rose-500 focus:outline-none resize-none"
                        data-testid="product-discount-description"
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase text-rose-600">
                        Действует до <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={editingProduct.discount_until ? String(editingProduct.discount_until).slice(0, 10) : ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, discount_until: e.target.value || null })}
                        className="mt-1.5 border-slate-200 focus:border-rose-500"
                        data-testid="product-discount-until"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">После этой даты скидка автоматически отключается</p>
                    </div>
                    {/* Preview */}
                    {editingProduct.price > 0 && editingProduct.discount_value > 0 && (
                      <div className="p-3 bg-white rounded-lg border border-rose-200">
                        <p className="text-xs text-slate-400 mb-1">Предпросмотр (базовая)</p>
                        {(() => {
                          const p = parseFloat(editingProduct.price) || 0;
                          const v = parseFloat(editingProduct.discount_value) || 0;
                          let finalPrice = p;
                          if (editingProduct.discount_type === 'percent') {
                            finalPrice = Math.max(0, p - (p * v) / 100);
                          } else {
                            finalPrice = Math.max(0, p - v);
                          }
                          return (
                            <div className="flex items-center gap-2">
                              <span className="line-through text-slate-400 text-sm">{formatPrice(p)} ₽</span>
                              <span className="text-xl font-bold text-rose-600">{formatPrice(finalPrice)} ₽</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Tiered discounts */}
                    <div className="pt-3 border-t border-rose-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold uppercase text-rose-600">Скидки по количеству</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const tiers = Array.isArray(editingProduct.discount_tiers) ? [...editingProduct.discount_tiers] : [];
                            tiers.push({ min_qty: 1, type: editingProduct.discount_type || 'percent', value: 0 });
                            setEditingProduct({ ...editingProduct, discount_tiers: tiers });
                          }}
                          className="border-rose-200 text-rose-600 hover:bg-rose-50 h-7 text-xs rounded-lg"
                          data-testid="add-tier-btn"
                        >
                          + Добавить порог
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        При заказе от N шт. применяется скидка тира вместо базовой. Если ни один порог не совпадает — действует базовая выше.
                      </p>
                      {Array.isArray(editingProduct.discount_tiers) && editingProduct.discount_tiers.length > 0 && (
                        <div className="space-y-2">
                          {editingProduct.discount_tiers.map((tier, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-rose-100" data-testid={`tier-row-${idx}`}>
                              <span className="text-xs text-slate-500 whitespace-nowrap">От</span>
                              <Input
                                type="number"
                                min="1"
                                value={tier.min_qty}
                                onChange={(e) => {
                                  const tiers = [...editingProduct.discount_tiers];
                                  tiers[idx] = { ...tier, min_qty: parseInt(e.target.value) || 1 };
                                  setEditingProduct({ ...editingProduct, discount_tiers: tiers });
                                }}
                                className="w-16 h-8 text-xs"
                              />
                              <span className="text-xs text-slate-500">шт.</span>
                              <select
                                value={tier.type || 'percent'}
                                onChange={(e) => {
                                  const tiers = [...editingProduct.discount_tiers];
                                  tiers[idx] = { ...tier, type: e.target.value };
                                  setEditingProduct({ ...editingProduct, discount_tiers: tiers });
                                }}
                                className="h-8 rounded border border-slate-200 text-xs px-1"
                              >
                                <option value="percent">%</option>
                                <option value="amount">₽</option>
                              </select>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={tier.value}
                                onChange={(e) => {
                                  const tiers = [...editingProduct.discount_tiers];
                                  tiers[idx] = { ...tier, value: parseFloat(e.target.value) || 0 };
                                  setEditingProduct({ ...editingProduct, discount_tiers: tiers });
                                }}
                                placeholder={tier.type === 'amount' ? '500' : '15'}
                                className="flex-1 h-8 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const tiers = editingProduct.discount_tiers.filter((_, i) => i !== idx);
                                  setEditingProduct({ ...editingProduct, discount_tiers: tiers });
                                }}
                                className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center"
                                data-testid={`remove-tier-${idx}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-teal-600">Изображения</Label>
                <div className="mt-1.5 space-y-3">
                  <input
                    type="file"
                    ref={productFileRef}
                    onChange={(e) => handleMultipleImageUpload(Array.from(e.target.files || []))}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => productFileRef.current?.click()}
                    disabled={uploading}
                    className="w-full border-dashed border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-50"
                  >
                    <Upload className="w-4 h-4 mr-2 text-teal-500" />
                    {uploading ? 'Загрузка...' : 'Загрузить изображения'}
                  </Button>
                  
                  {/* Image gallery */}
                  {(editingProduct.images?.length > 0 || editingProduct.image_url) && (
                    <div className="grid grid-cols-4 gap-2">
                      {/* Main image first */}
                      {editingProduct.image_url && (
                        <div className="relative group">
                          <div className="aspect-square bg-slate-100 overflow-hidden rounded-lg border-2 border-teal-500">
                            <img src={editingProduct.image_url} alt="Main" className="w-full h-full object-cover" />
                          </div>
                          <span className="absolute top-1 left-1 bg-teal-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                            Главное
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(editingProduct.image_url)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      
                      {/* Other images */}
                      {(editingProduct.images || [])
                        .filter(img => img !== editingProduct.image_url)
                        .map((img, idx) => (
                          <div key={idx} className="relative group">
                            <div className="aspect-square bg-slate-100 overflow-hidden rounded-lg border border-slate-200 hover:border-teal-300">
                              <img src={img} alt={`Product ${idx + 2}`} className="w-full h-full object-cover" />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSetMainImage(img)}
                              className="absolute bottom-1 left-1 bg-teal-500 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Главное
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(img)}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                  
                  <Input
                    placeholder="Или вставьте URL и нажмите Enter..."
                    className="text-sm border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                    data-testid="product-image-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const url = e.target.value.trim();
                        if (url) {
                          const currentImages = editingProduct.images || [];
                          const mainImage = editingProduct.image_url || url;
                          setEditingProduct({
                            ...editingProduct,
                            images: [...currentImages, url],
                            image_url: mainImage
                          });
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-slate-400">Загрузите несколько изображений или добавьте URL</p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-teal-600">Описание</Label>
                <Textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="mt-1.5 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                  rows={3}
                  data-testid="product-description-input"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-teal-600">Кросс-номера (аналоги)</Label>
                <Textarea
                  value={editingProduct.cross_articles || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, cross_articles: e.target.value })}
                  placeholder="Артикулы аналогов через запятую или с новой строки"
                  className="mt-1.5 font-mono text-sm border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                  rows={2}
                  data-testid="product-cross-articles-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setEditingProduct(null)} className="border-slate-200">
                  Отмена
                </Button>
                <Button onClick={handleSaveProduct} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-lg shadow-teal-500/20" data-testid="save-product-btn">
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Category Modal */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent className="max-w-md" data-testid="category-edit-modal">
          <DialogHeader>
            <DialogTitle>{isNewCategory ? 'Добавить категорию' : 'Редактировать категорию'}</DialogTitle>
          </DialogHeader>
          
          {editingCategory && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Название *</Label>
                <Input
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="mt-1"
                  data-testid="category-name-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Изображение</Label>
                <div className="mt-1 space-y-2">
                  <input
                    type="file"
                    ref={categoryFileRef}
                    onChange={handleCategoryImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => categoryFileRef.current?.click()}
                    disabled={uploading}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Загрузка...' : 'Загрузить изображение'}
                  </Button>
                  <Input
                    value={editingCategory.image_url || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, image_url: e.target.value })}
                    placeholder="Или вставьте URL: https://..."
                    className="text-sm"
                    data-testid="category-image-input"
                  />
                  {editingCategory.image_url && (
                    <div className="aspect-video w-full bg-zinc-100 overflow-hidden border">
                      <img src={editingCategory.image_url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingCategory(null)}>
                  Отмена
                </Button>
                <Button onClick={handleSaveCategory} className="bg-teal-500 hover:bg-teal-600" data-testid="save-category-btn">
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Order Modal */}
      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Заказ #{viewingOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          {viewingOrder && (
            <div className="space-y-4 mt-4">
              {/* Order info */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-zinc-50 p-4 border border-zinc-200">
                <div>
                  <p className="text-zinc-500 text-xs uppercase">Получатель</p>
                  <p className="font-medium">{viewingOrder.full_name}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase">Телефон</p>
                  <p className="font-medium">{viewingOrder.phone}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-zinc-500 text-xs uppercase">Адрес доставки</p>
                  <p className="font-medium">{viewingOrder.address}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase">Дата заказа</p>
                  <p className="font-medium">{formatDate(viewingOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs uppercase">Способ оплаты</p>
                  <p className="font-medium">
                    {viewingOrder.payment_method === 'card' ? 'Банковская карта' : 
                     viewingOrder.payment_method === 'crypto' ? 'Криптовалюта' : 'Наличные'}
                  </p>
                  {viewingOrder.payment_status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      viewingOrder.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                      viewingOrder.payment_status === 'crypto_pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>
                      {viewingOrder.payment_status === 'paid' ? 'Оплачен' : 
                       viewingOrder.payment_status === 'crypto_pending' ? 'Ожидает подтверждения' : 
                       viewingOrder.payment_status}
                    </span>
                  )}
                </div>
              </div>

              {/* Crypto payment confirmation */}
              {viewingOrder.payment_status === 'crypto_pending' && viewingOrder.crypto_tx_hash && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <p className="font-semibold text-teal-800 mb-2">Крипто-платёж ожидает подтверждения</p>
                  <p className="text-sm text-zinc-600">Сеть: <span className="font-mono font-bold">{viewingOrder.crypto_chain?.toUpperCase()}</span></p>
                  <p className="text-sm text-zinc-600 break-all">TX: <span className="font-mono">{viewingOrder.crypto_tx_hash}</span></p>
                  <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white mt-3" onClick={async () => {
                    try {
                      await axios.put(`${API}/admin/orders/${viewingOrder.id}/confirm-crypto`);
                      setViewingOrder(prev => ({...prev, payment_status: 'paid', status: 'processing'}));
                      toast.success('Крипто-платёж подтверждён');
                    } catch (err) { toast.error('Ошибка подтверждения'); }
                  }} data-testid="confirm-crypto-btn">
                    Подтвердить оплату
                  </Button>
                </div>
              )}

              {/* Order items with full details */}
              <div className="border border-zinc-200">
                <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200">
                  <p className="text-xs font-bold uppercase text-zinc-500">Товары в заказе ({viewingOrder.items.length})</p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {viewingOrder.items.map((item, idx) => (
                    <div key={idx} className="flex gap-4 p-4">
                      {/* Product image */}
                      <div className="w-16 h-16 flex-shrink-0 bg-zinc-100 overflow-hidden">
                        {item.image_url ? (
                          <img 
                            src={item.image_url.startsWith('http') ? item.image_url : `${BACKEND_URL}${item.image_url}`} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      
                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 line-clamp-1">{item.name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          {item.manufacturer && (
                            <p className="text-sm font-bold text-orange-600">{item.manufacturer}</p>
                          )}
                          {item.article && (
                            <p className="text-sm font-mono font-semibold text-zinc-600">Арт: {item.article}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm">
                          <span className="text-zinc-500">
                            {formatPrice(item.price)} ₽ × {item.quantity} шт.
                          </span>
                        </div>
                      </div>
                      
                      {/* Item total */}
                      <div className="text-right">
                        <p className="font-mono font-semibold text-zinc-900">
                          {formatPrice(item.price * item.quantity)} ₽
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Order total */}
                <div className="bg-zinc-50 px-4 py-3 border-t border-zinc-200 flex justify-between items-center">
                  <span className="font-semibold">Итого:</span>
                  <span className="font-mono text-xl font-bold text-zinc-900">{formatPrice(viewingOrder.total)} ₽</span>
                </div>
              </div>

              {/* Status update */}
              <div className="border border-zinc-200 p-4">
                <Label className="text-xs font-bold uppercase text-zinc-500">Статус заказа</Label>
                <div className="flex gap-2 mt-2">
                  <select
                    value={viewingOrder.status}
                    onChange={(e) => handleUpdateOrderStatus(viewingOrder.id, e.target.value)}
                    className={`flex-1 h-10 px-3 border border-zinc-200 font-semibold ${STATUS_OPTIONS.find(s => s.value === viewingOrder.status)?.color || 'bg-zinc-50'}`}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <Button variant="outline" className="h-10 text-amber-600 border-amber-200 hover:bg-amber-50" title="Откатить статус"
                    onClick={async () => {
                      try {
                        const res = await axios.put(`${API}/admin/orders/${viewingOrder.id}/rollback-status`);
                        toast.success(`Статус откачен на: ${res.data.status}`);
                        setViewingOrder(prev => ({...prev, status: res.data.status, previous_status: res.data.previous_status}));
                        fetchData();
                      } catch (err) { toast.error(err.response?.data?.detail || 'Нет предыдущего статуса'); }
                    }}
                    data-testid="rollback-order-status-detail">
                    <RotateCcw className="w-4 h-4 mr-1" /> Откатить
                  </Button>
                </div>
              </div>

              {/* Document generation */}
              <div className="border border-zinc-200 rounded-lg p-4">
                <Label className="text-xs font-bold uppercase text-zinc-500 mb-3 block">Документы</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: 'invoice', format: 'docx', label: 'Накладная WORD', color: 'blue' },
                    { type: 'invoice', format: 'pdf', label: 'Накладная PDF', color: 'red' },
                    { type: 'receipt', format: 'docx', label: 'Чек WORD', color: 'blue' },
                    { type: 'receipt', format: 'pdf', label: 'Чек PDF', color: 'red' },
                  ].map(doc => (
                    <button key={`${doc.type}-${doc.format}`}
                      onClick={async () => {
                        try {
                          const res = await axios.get(`${API}/admin/orders/${viewingOrder.id}/${doc.type}/${doc.format}`, { responseType: 'blob' });
                          const url = window.URL.createObjectURL(new Blob([res.data]));
                          const a = document.createElement('a'); a.href = url; a.download = `${doc.type}_${viewingOrder.id.slice(0,8)}.${doc.format}`;
                          document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
                        } catch (err) { toast.error('Ошибка скачивания'); }
                      }}
                      className={`flex items-center justify-center gap-2 px-3 py-2 bg-${doc.color}-50 hover:bg-${doc.color}-100 border border-${doc.color}-200 rounded-lg text-sm font-medium text-${doc.color}-700 cursor-pointer transition-colors`}
                      data-testid={`download-${doc.type}-${doc.format}`}>
                      <FileText className="w-4 h-4" /> {doc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delete order button */}
              <div className="flex justify-end pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleDeleteOrder(viewingOrder.id)}
                  className="text-red-500 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить заказ
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="user-edit-modal">
          <DialogHeader>
            <DialogTitle>{isNewUser ? 'Добавить пользователя' : 'Редактировать пользователя'}</DialogTitle>
          </DialogHeader>
          
          {editingUser && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Имя *</Label>
                <Input
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="mt-1"
                  data-testid="user-name-input"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Email *</Label>
                <Input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="mt-1"
                  data-testid="user-email-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">
                  Пароль {isNewUser ? '*' : '(оставьте пустым, чтобы не менять)'}
                </Label>
                <Input
                  type="text"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  placeholder={isNewUser ? '' : 'Новый пароль...'}
                  className="mt-1 font-mono"
                  data-testid="user-password-input"
                />
                {!isNewUser && editingUser.password_plain && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Текущий пароль: <span className="font-mono font-semibold">{editingUser.password_plain}</span>
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Телефон</Label>
                <Input
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  placeholder="+7 (999) 123-45-67"
                  className="mt-1"
                  data-testid="user-phone-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Адрес</Label>
                <Textarea
                  value={editingUser.address || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, address: e.target.value })}
                  placeholder="Адрес доставки"
                  className="mt-1"
                  rows={2}
                  data-testid="user-address-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Комментарий к адресу</Label>
                <Textarea
                  value={editingUser.address_comment || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, address_comment: e.target.value })}
                  placeholder="Код домофона, этаж, ориентиры..."
                  className="mt-1"
                  rows={2}
                  data-testid="user-address-comment-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Роль</Label>
                <select
                  value={editingUser.role || 'user'}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="mt-1 w-full h-10 px-3 border border-zinc-200 bg-white"
                  data-testid="user-role-select"
                >
                  <option value="user">Пользователь</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Отмена
                </Button>
                <Button 
                  onClick={handleSaveUser} 
                  className="bg-teal-500 hover:bg-teal-600" 
                  data-testid="save-user-btn"
                  disabled={!editingUser.name || !editingUser.email || (isNewUser && !editingUser.password)}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Modal */}
      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="order-edit-modal">
          <DialogHeader>
            <DialogTitle>Редактировать заказ #{editingOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          {editingOrder && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Статус</Label>
                <select
                  value={editingOrder.status}
                  onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value })}
                  className={`mt-1 w-full h-10 px-3 border border-zinc-200 font-semibold ${STATUS_OPTIONS.find(s => s.value === editingOrder.status)?.color || 'bg-zinc-50'}`}
                  data-testid="order-status-select"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Получатель</Label>
                <Input
                  value={editingOrder.full_name}
                  onChange={(e) => setEditingOrder({ ...editingOrder, full_name: e.target.value })}
                  className="mt-1"
                  data-testid="order-fullname-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Телефон</Label>
                <Input
                  value={editingOrder.phone}
                  onChange={(e) => setEditingOrder({ ...editingOrder, phone: e.target.value })}
                  className="mt-1"
                  data-testid="order-phone-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Адрес доставки</Label>
                <Textarea
                  value={editingOrder.address}
                  onChange={(e) => setEditingOrder({ ...editingOrder, address: e.target.value })}
                  className="mt-1"
                  rows={2}
                  data-testid="order-address-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Комментарий к заказу</Label>
                <Textarea
                  value={editingOrder.comment || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, comment: e.target.value })}
                  className="mt-1"
                  rows={2}
                  placeholder="Комментарий от клиента или для курьера..."
                  data-testid="order-comment-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Дата и время заказа</Label>
                <Input
                  type="datetime-local"
                  value={editingOrder.created_at ? editingOrder.created_at.slice(0, 16) : ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, created_at: e.target.value ? e.target.value + ':00' : editingOrder.created_at })}
                  className="mt-1"
                  data-testid="order-date-input"
                />
              </div>

              {/* Order Items with editable prices */}
              <div className="border-t pt-4">
                <Label className="text-xs font-bold uppercase text-zinc-500 mb-3 block">Товары в заказе</Label>
                <div className="space-y-3">
                  {editingOrder.items?.map((item, idx) => (
                    <div key={idx} className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                      <div className="flex items-start gap-3">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-zinc-500">{item.article}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <Label className="text-xs text-zinc-400">Цена (₽)</Label>
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleUpdateOrderItem(idx, 'price', e.target.value)}
                            className="mt-1 h-8 text-sm"
                            min={0}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-400">Кол-во</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateOrderItem(idx, 'quantity', e.target.value)}
                            className="mt-1 h-8 text-sm"
                            min={1}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-400">Сумма</Label>
                          <p className="mt-1 h-8 flex items-center text-sm font-bold">
                            {formatPrice(item.price * item.quantity)} ₽
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-orange-50 p-3 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-600">Итого:</p>
                <p className="text-2xl font-bold font-mono text-orange-600">
                  {formatPrice(calculateOrderTotal(editingOrder.items || []))} ₽
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingOrder(null)}>
                  Отмена
                </Button>
                <Button 
                  onClick={handleSaveOrder} 
                  className="bg-teal-500 hover:bg-teal-600" 
                  data-testid="save-order-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Partner Modal */}
      <Dialog open={!!editingPartner} onOpenChange={() => setEditingPartner(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="partner-edit-modal">
          <DialogHeader>
            <DialogTitle>{isNewPartner ? 'Добавить партнёра' : 'Редактировать партнёра'}</DialogTitle>
          </DialogHeader>
          
          {editingPartner && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Название *</Label>
                <Input
                  value={editingPartner.name}
                  onChange={(e) => setEditingPartner({ ...editingPartner, name: e.target.value })}
                  placeholder="Например: MANN+HUMMEL"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Описание</Label>
                <Input
                  value={editingPartner.description}
                  onChange={(e) => setEditingPartner({ ...editingPartner, description: e.target.value })}
                  placeholder="Например: Фильтры"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Логотип партнёра</Label>
                <div className="mt-2 space-y-3">
                  {/* Current image preview */}
                  {editingPartner.image_url && (
                    <div className="h-20 bg-zinc-100 rounded-lg flex items-center justify-center p-2">
                      <img src={editingPartner.image_url} alt="Preview" className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  
                  {/* Upload button */}
                  <div className="flex gap-2">
                    <input
                      ref={partnerImageRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePartnerImageUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => partnerImageRef.current?.click()}
                      disabled={partnerImageUploading}
                      className="flex-1"
                    >
                      {partnerImageUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-2" />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {editingPartner.image_url ? 'Заменить изображение' : 'Загрузить изображение'}
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* URL input for external images */}
                  <div>
                    <Label className="text-[10px] text-zinc-400">Или вставьте URL</Label>
                    <Input
                      value={editingPartner.image_url}
                      onChange={(e) => setEditingPartner({ ...editingPartner, image_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Ссылка (необязательно)</Label>
                <Input
                  value={editingPartner.link}
                  onChange={(e) => setEditingPartner({ ...editingPartner, link: e.target.value })}
                  placeholder="https://partner-website.com"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Порядок отображения</Label>
                <Input
                  type="number"
                  value={editingPartner.order}
                  onChange={(e) => setEditingPartner({ ...editingPartner, order: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingPartner(null)}>
                  Отмена
                </Button>
                <Button 
                  onClick={async () => {
                    if (!editingPartner.name) {
                      toast.error('Введите название');
                      return;
                    }
                    try {
                      if (isNewPartner) {
                        const res = await axios.post(`${API}/admin/partners`, editingPartner);
                        setPartners(prev => [...prev, res.data]);
                        toast.success('Партнёр добавлен');
                      } else {
                        const res = await axios.put(`${API}/admin/partners/${editingPartner.id}`, editingPartner);
                        setPartners(prev => prev.map(p => p.id === editingPartner.id ? res.data : p));
                        toast.success('Партнёр обновлён');
                      }
                      setEditingPartner(null);
                    } catch (err) {
                      toast.error('Ошибка сохранения');
                    }
                  }}
                  className="bg-teal-500 hover:bg-teal-600"
                  disabled={!editingPartner.name}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UserAnalyticsModal
        userId={analyticsUser?.id}
        userName={analyticsUser?.name}
        open={!!analyticsUser}
        onClose={() => setAnalyticsUser(null)}
      />
    </div>
    </>
  );
}
