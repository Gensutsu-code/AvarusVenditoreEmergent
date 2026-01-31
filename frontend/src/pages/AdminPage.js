import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Package, ShoppingBag, TrendingUp, 
  Plus, Pencil, Trash2, Save, Eye, FolderOpen, Megaphone, Upload, Image,
  MessageCircle, Send, BarChart3, Download, FileSpreadsheet, Pin, Tag, X, Copy, Gift, Award
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [promoBanner, setPromoBanner] = useState({ enabled: false, text: '', link: '', bg_color: '#f97316', height: 40, left_image: null, right_image: null });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const productFileRef = useRef(null);
  const categoryFileRef = useRef(null);
  const promoLeftFileRef = useRef(null);
  const promoRightFileRef = useRef(null);
  const importFileRef = useRef(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  
  // New states
  const [telegramSettings, setTelegramSettings] = useState({ enabled: false, bot_token: '', chat_id: '' });
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newAdminMessage, setNewAdminMessage] = useState('');
  const [extendedStats, setExtendedStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('month');
  const [importResult, setImportResult] = useState(null);
  
  // User management states
  const [editingUser, setEditingUser] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  
  // Order management states  
  const [editingOrder, setEditingOrder] = useState(null);
  
  // Bonus program states
  const [bonusSettings, setBonusSettings] = useState({ 
    title: 'Бонусная программа', 
    description: 'Накопите сумму заказов и получите бонус!', 
    image_url: '', 
    max_amount: 50000, 
    min_threshold: 5000, 
    enabled: true 
  });
  const [bonusUsers, setBonusUsers] = useState([]);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [pendingBonusRequests, setPendingBonusRequests] = useState(0);
  const [issueBonusModal, setIssueBonusModal] = useState(null); // { userId, userName }
  const [bonusCodeInput, setBonusCodeInput] = useState('');
  const [issuingBonus, setIssuingBonus] = useState(false);
  const bonusImageFileRef = useRef(null);
  
  // Partners states
  const [partners, setPartners] = useState([]);
  const [editingPartner, setEditingPartner] = useState(null);
  const [isNewPartner, setIsNewPartner] = useState(false);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, productsRes, categoriesRes, usersRes, ordersRes, bannerRes, telegramRes, chatsRes, bonusUsersRes, bonusHistoryRes, partnersRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/products`),
        axios.get(`${API}/categories`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/orders`),
        axios.get(`${API}/promo-banner`),
        axios.get(`${API}/admin/telegram-settings`),
        axios.get(`${API}/admin/chats`),
        axios.get(`${API}/admin/bonus/users`),
        axios.get(`${API}/admin/bonus/history`),
        axios.get(`${API}/partners`)
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setUsers(usersRes.data);
      setOrders(ordersRes.data);
      setPromoBanner(bannerRes.data);
      setTelegramSettings(telegramRes.data);
      setChats(chatsRes.data);
      setBonusUsers(bonusUsersRes.data.users || []);
      setBonusSettings(bonusUsersRes.data.settings || bonusSettings);
      setBonusHistory(bonusHistoryRes.data.history || []);
      setPendingBonusRequests(bonusUsersRes.data.pending_requests || 0);
      setPartners(partnersRes.data || []);
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

    try {
      if (isNewProduct) {
        const res = await axios.post(`${API}/products`, editingProduct);
        // Real-time update: add to local state
        setProducts(prev => [...prev, res.data]);
        toast.success('Товар создан');
      } else {
        const res = await axios.put(`${API}/products/${editingProduct.id}`, editingProduct);
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
      
      // Return full URL
      const url = `${BACKEND_URL}${res.data.url}`;
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

  const handlePromoLeftImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await handleFileUpload(file, 'promo');
      if (url) {
        setPromoBanner({ ...promoBanner, left_image: url });
      }
    }
  };

  const handlePromoRightImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await handleFileUpload(file, 'promo');
      if (url) {
        setPromoBanner({ ...promoBanner, right_image: url });
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
      description: '',
      image_url: '',
      images: [],
      cross_articles: ''
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
        
        const url = `${BACKEND_URL}${res.data.url}`;
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
        const res = await axios.put(`${API}/admin/users/${editingUser.id}`, editingUser);
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
        phone: editingOrder.phone
      });
      setOrders(orders.map(o => o.id === editingOrder.id ? res.data : o));
      setEditingOrder(null);
      toast.success('Заказ обновлён');
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
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
      await axios.put(`${API}/promo-banner`, promoBanner);
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
      
      const res = await axios.post(`${API}/admin/products/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportResult(res.data);
      toast.success(`Импортировано: ${res.data.imported}, Обновлено: ${res.data.updated}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка импорта');
    } finally {
      setUploading(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const handleExportProducts = () => {
    window.open(`${API}/admin/products/export`, '_blank');
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="admin-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-8">
          Панель администратора
        </h1>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-zinc-200 p-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_users}</p>
                  <p className="text-sm text-zinc-500">Пользователей</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 p-6">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_products}</p>
                  <p className="text-sm text-zinc-500">Товаров</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 p-6">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_orders}</p>
                  <p className="text-sm text-zinc-500">Заказов</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{formatPrice(stats.total_revenue)} ₽</p>
                  <p className="text-sm text-zinc-500">Выручка</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="products" className="bg-white border border-zinc-200">
          <TabsList className="w-full justify-start border-b border-zinc-200 rounded-none bg-zinc-50 p-0 h-auto flex-wrap">
            <TabsTrigger value="products" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <Package className="w-4 h-4 mr-2" />
              Товары ({products.length})
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <FolderOpen className="w-4 h-4 mr-2" />
              Категории ({categories.length})
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Заказы ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <Users className="w-4 h-4 mr-2" />
              Пользователи ({users.length})
            </TabsTrigger>
            <TabsTrigger value="promo" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <Megaphone className="w-4 h-4 mr-2" />
              Акции
            </TabsTrigger>
            <TabsTrigger value="stats" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <BarChart3 className="w-4 h-4 mr-2" />
              Статистика
            </TabsTrigger>
            <TabsTrigger value="chat" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <MessageCircle className="w-4 h-4 mr-2" />
              Чаты {chats.filter(c => c.unread_count > 0).length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {chats.reduce((sum, c) => sum + (c.unread_count || 0), 0)}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="telegram" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <Send className="w-4 h-4 mr-2" />
              Telegram
            </TabsTrigger>
            <TabsTrigger value="import" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Импорт
            </TabsTrigger>
            <TabsTrigger value="bonus" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <Gift className="w-4 h-4 mr-2" />
              Бонусы {pendingBonusRequests > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {pendingBonusRequests}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="partners" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500 px-4 py-3">
              <Image className="w-4 h-4 mr-2" />
              Партнёры
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Управление товарами</h2>
              <Button onClick={openNewProduct} className="bg-orange-500 hover:bg-orange-600" data-testid="add-product-btn">
                <Plus className="w-4 h-4 mr-2" />
                Добавить товар
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 px-2">Фото</th>
                    <th className="text-left py-3 px-2">Название</th>
                    <th className="text-left py-3 px-2">Производитель</th>
                    <th className="text-left py-3 px-2">Артикул</th>
                    <th className="text-left py-3 px-2">Категория</th>
                    <th className="text-right py-3 px-2">Цена</th>
                    <th className="text-right py-3 px-2">Наличие</th>
                    <th className="text-right py-3 px-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-2 px-2">
                        <div className="w-12 h-12 bg-zinc-100 overflow-hidden">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-300">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 font-medium">{product.name}</td>
                      <td className="py-2 px-2 font-semibold text-orange-600">{product.manufacturer || '—'}</td>
                      <td className="py-2 px-2 font-mono font-semibold text-zinc-600">{product.article}</td>
                      <td className="py-2 px-2 text-zinc-500">{getCategoryName(product.category_id)}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatPrice(product.price)} ₽</td>
                      <td className="py-2 px-2 text-right">{product.stock} шт.</td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditProduct(product)} data-testid={`edit-${product.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id)} className="text-red-500 hover:text-red-600" data-testid={`delete-${product.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Управление категориями</h2>
              <Button onClick={openNewCategory} className="bg-orange-500 hover:bg-orange-600" data-testid="add-category-btn">
                <Plus className="w-4 h-4 mr-2" />
                Добавить категорию
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => (
                <div key={category.id} className="border border-zinc-200 p-4">
                  {category.image_url && (
                    <div className="aspect-video bg-zinc-100 mb-3 overflow-hidden">
                      <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{category.name}</h3>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditCategory(category)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)} className="text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">
                    Товаров: {products.filter(p => p.category_id === category.id).length}
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="p-6">
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
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Управление пользователями</h2>
              <Button onClick={openNewUser} className="bg-orange-500 hover:bg-orange-600" data-testid="add-user-btn">
                <Plus className="w-4 h-4 mr-2" />
                Добавить пользователя
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 px-2">Имя</th>
                    <th className="text-left py-3 px-2">Email</th>
                    <th className="text-left py-3 px-2">Телефон</th>
                    <th className="text-left py-3 px-2">Роль</th>
                    <th className="text-right py-3 px-2">Заказов</th>
                    <th className="text-right py-3 px-2">Потрачено</th>
                    <th className="text-left py-3 px-2">Дата</th>
                    <th className="text-right py-3 px-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-2 px-2 font-medium">{u.name}</td>
                      <td className="py-2 px-2">{u.email}</td>
                      <td className="py-2 px-2 text-zinc-500">{u.phone || '—'}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs font-bold px-2 py-1 ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-zinc-100'}`}>
                          {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{u.total_orders || 0}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatPrice(u.total_spent || 0)} ₽</td>
                      <td className="py-2 px-2 text-zinc-500 text-xs">{u.created_at ? formatDate(u.created_at) : '—'}</td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditUser(u)} data-testid={`edit-user-${u.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteUser(u.id)} 
                            className="text-red-500 hover:text-red-600"
                            disabled={u.email === 'admin@avarus.ru'}
                            data-testid={`delete-user-${u.id}`}
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
          </TabsContent>

          {/* Promo Banner Tab */}
          <TabsContent value="promo" className="p-6">
            <h2 className="text-lg font-semibold mb-4">Баннер акций и скидок</h2>
            
            <div className="max-w-xl space-y-4">
              <div className="flex items-center gap-4">
                <Switch
                  checked={promoBanner.enabled}
                  onCheckedChange={(checked) => setPromoBanner({ ...promoBanner, enabled: checked })}
                  data-testid="promo-enabled"
                />
                <Label>Показывать баннер</Label>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Текст баннера</Label>
                <Input
                  value={promoBanner.text}
                  onChange={(e) => setPromoBanner({ ...promoBanner, text: e.target.value })}
                  placeholder="Скидка 10% на все товары!"
                  className="mt-1"
                  data-testid="promo-text"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Ссылка (необязательно)</Label>
                <Input
                  value={promoBanner.link || ''}
                  onChange={(e) => setPromoBanner({ ...promoBanner, link: e.target.value })}
                  placeholder="/catalog?search=акция"
                  className="mt-1"
                  data-testid="promo-link"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Цвет фона</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={promoBanner.bg_color || '#f97316'}
                    onChange={(e) => setPromoBanner({ ...promoBanner, bg_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={promoBanner.bg_color || '#f97316'}
                    onChange={(e) => setPromoBanner({ ...promoBanner, bg_color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Высота баннера (px)</Label>
                <Input
                  type="number"
                  value={promoBanner.height || 40}
                  onChange={(e) => setPromoBanner({ ...promoBanner, height: parseInt(e.target.value) || 40 })}
                  min={30}
                  max={200}
                  className="mt-1 w-32"
                  data-testid="promo-height"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Изображение слева</Label>
                  <div className="mt-1 space-y-2">
                    <input
                      type="file"
                      ref={promoLeftFileRef}
                      onChange={handlePromoLeftImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => promoLeftFileRef.current?.click()}
                      disabled={uploading}
                      size="sm"
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Загрузка...' : 'Загрузить'}
                    </Button>
                    {promoBanner.left_image && (
                      <div className="flex items-center gap-2">
                        <img src={promoBanner.left_image} alt="Left" className="h-10 object-contain" />
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setPromoBanner({ ...promoBanner, left_image: null })}
                          className="text-red-500 h-8 px-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Изображение справа</Label>
                  <div className="mt-1 space-y-2">
                    <input
                      type="file"
                      ref={promoRightFileRef}
                      onChange={handlePromoRightImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => promoRightFileRef.current?.click()}
                      disabled={uploading}
                      size="sm"
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Загрузка...' : 'Загрузить'}
                    </Button>
                    {promoBanner.right_image && (
                      <div className="flex items-center gap-2">
                        <img src={promoBanner.right_image} alt="Right" className="h-10 object-contain" />
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setPromoBanner({ ...promoBanner, right_image: null })}
                          className="text-red-500 h-8 px-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview */}
              {promoBanner.text && (
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Предпросмотр</Label>
                  <div 
                    className="flex items-center justify-between px-4 text-white text-sm font-medium"
                    style={{ 
                      backgroundColor: promoBanner.bg_color || '#f97316',
                      minHeight: `${promoBanner.height || 40}px`
                    }}
                  >
                    <div className="flex-shrink-0">
                      {promoBanner.left_image && (
                        <img src={promoBanner.left_image} alt="" className="object-contain" style={{ maxHeight: `${(promoBanner.height || 40) - 8}px` }} />
                      )}
                    </div>
                    <span className="flex-1 text-center">{promoBanner.text}</span>
                    <div className="flex-shrink-0">
                      {promoBanner.right_image && (
                        <img src={promoBanner.right_image} alt="" className="object-contain" style={{ maxHeight: `${(promoBanner.height || 40) - 8}px` }} />
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={handleSavePromoBanner} className="bg-orange-500 hover:bg-orange-600" data-testid="save-promo-btn">
                <Save className="w-4 h-4 mr-2" />
                Сохранить баннер
              </Button>
            </div>
          </TabsContent>

          {/* Extended Statistics Tab */}
          <TabsContent value="stats" className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Расширенная статистика</h2>
                <select
                  value={statsPeriod}
                  onChange={(e) => setStatsPeriod(e.target.value)}
                  className="h-10 px-3 border border-zinc-200 bg-white"
                >
                  <option value="day">За день</option>
                  <option value="week">За неделю</option>
                  <option value="month">За месяц</option>
                  <option value="year">За год</option>
                </select>
              </div>

              {extendedStats && (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-50 border border-zinc-200 p-4">
                      <p className="text-sm text-zinc-500">Заказов</p>
                      <p className="text-2xl font-bold">{extendedStats.total_orders}</p>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 p-4">
                      <p className="text-sm text-zinc-500">Выручка</p>
                      <p className="text-2xl font-bold">{formatPrice(extendedStats.total_revenue)} ₽</p>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 p-4">
                      <p className="text-sm text-zinc-500">Средний чек</p>
                      <p className="text-2xl font-bold">{formatPrice(extendedStats.avg_order_value)} ₽</p>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 p-4">
                      <p className="text-sm text-zinc-500">Статусы</p>
                      <div className="text-xs space-y-1 mt-1">
                        {Object.entries(extendedStats.status_distribution || {}).map(([status, count]) => (
                          <div key={status} className="flex justify-between">
                            <span>{STATUS_OPTIONS.find(s => s.value === status)?.label || status}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Daily sales chart */}
                  {extendedStats.daily_sales?.length > 0 && (
                    <div className="border border-zinc-200 p-4">
                      <h3 className="font-semibold mb-4">Продажи по дням</h3>
                      <div className="overflow-x-auto">
                        <div className="flex items-end gap-2 h-40 min-w-max">
                          {extendedStats.daily_sales.map((day, idx) => {
                            const maxValue = Math.max(...extendedStats.daily_sales.map(d => d.total));
                            const height = maxValue > 0 ? (day.total / maxValue) * 100 : 0;
                            return (
                              <div key={idx} className="flex flex-col items-center gap-1">
                                <div 
                                  className="w-8 bg-orange-500 hover:bg-orange-600 transition-colors"
                                  style={{ height: `${Math.max(height, 2)}%` }}
                                  title={`${formatPrice(day.total)} ₽`}
                                />
                                <span className="text-[10px] text-zinc-500 transform -rotate-45 origin-top-left whitespace-nowrap">
                                  {day.date.slice(5)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top products */}
                  {extendedStats.top_products?.length > 0 && (
                    <div className="border border-zinc-200 p-4">
                      <h3 className="font-semibold mb-3">Топ товаров</h3>
                      <div className="space-y-2">
                        {extendedStats.top_products.map((product, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                                {idx + 1}
                              </span>
                              <span className="line-clamp-1">{product.name}</span>
                            </span>
                            <span className="font-semibold">{product.count} шт.</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top customers */}
                  {extendedStats.top_customers?.length > 0 && (
                    <div className="border border-zinc-200 p-4">
                      <h3 className="font-semibold mb-3">Топ клиентов</h3>
                      <div className="space-y-2">
                        {extendedStats.top_customers.map((customer, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-6 h-6 bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                {idx + 1}
                              </span>
                              <span>{customer.name}</span>
                              <span className="text-zinc-400 text-xs">{customer.email}</span>
                            </span>
                            <span className="font-semibold">{customer.order_count} заказов</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[500px]">
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
                        className={`relative group ${selectedChat?.id === chat.id ? 'bg-orange-50' : 'hover:bg-zinc-50'}`}
                      >
                        <button
                          onClick={() => handleSelectChat(chat)}
                          className="w-full text-left p-3 border-b border-zinc-100 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {chat.pinned && <Pin className="w-3 h-3 text-orange-500 flex-shrink-0" />}
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
                            className={`p-1 rounded hover:bg-zinc-100 ${chat.pinned ? 'text-orange-500' : 'text-zinc-400'}`}
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
                                ? 'bg-orange-500 text-white'
                                : 'bg-white border border-zinc-200'
                            }`}
                          >
                            {/* Media content */}
                            {msg.message_type === 'image' && msg.file_url && (
                              <img 
                                src={`${BACKEND_URL}${msg.file_url}`} 
                                alt="Изображение" 
                                className="max-w-full rounded mb-2 cursor-pointer"
                                onClick={() => window.open(`${BACKEND_URL}${msg.file_url}`, '_blank')}
                              />
                            )}
                            {msg.message_type === 'file' && msg.file_url && (
                              <a 
                                href={`${BACKEND_URL}${msg.file_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-zinc-100 rounded mb-2 hover:bg-zinc-200"
                              >
                                <Download className="w-4 h-4" />
                                <span className="text-xs truncate">{msg.filename || 'Файл'}</span>
                              </a>
                            )}
                            
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <div className={`flex items-center gap-1 text-[10px] mt-1 ${msg.sender_type === 'admin' ? 'text-orange-200' : 'text-zinc-400'}`}>
                              {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                              {msg.edited && <span>(ред.)</span>}
                            </div>
                            
                            {/* Message actions */}
                            {msg.sender_type === 'admin' && (
                              <div className="absolute -left-16 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1">
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
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
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
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-zinc-200 bg-white">
                      <div className="flex gap-2">
                        <Input
                          value={newAdminMessage}
                          onChange={(e) => setNewAdminMessage(e.target.value)}
                          placeholder="Введите ответ..."
                          onKeyPress={(e) => e.key === 'Enter' && handleSendAdminMessage()}
                        />
                        <Button onClick={handleSendAdminMessage} className="bg-orange-500 hover:bg-orange-600">
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
            </div>
          </TabsContent>

          {/* Telegram Tab */}
          <TabsContent value="telegram" className="p-6">
            <div className="max-w-xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">Уведомления в Telegram</h2>
                <p className="text-sm text-zinc-500 mb-4">
                  Получайте уведомления о новых заказах в Telegram. Создайте бота через @BotFather и получите токен.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={telegramSettings.enabled}
                  onCheckedChange={(checked) => setTelegramSettings({ ...telegramSettings, enabled: checked })}
                />
                <Label>Включить уведомления</Label>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Bot Token</Label>
                <Input
                  value={telegramSettings.bot_token}
                  onChange={(e) => setTelegramSettings({ ...telegramSettings, bot_token: e.target.value })}
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-zinc-400 mt-1">Получите токен у @BotFather в Telegram</p>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Chat ID</Label>
                <Input
                  value={telegramSettings.chat_id}
                  onChange={(e) => setTelegramSettings({ ...telegramSettings, chat_id: e.target.value })}
                  placeholder="-1001234567890"
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-zinc-400 mt-1">ID чата или канала для уведомлений. Узнайте его через @userinfobot</p>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSaveTelegram} className="bg-orange-500 hover:bg-orange-600">
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleTestTelegram}
                  disabled={!telegramSettings.enabled || !telegramSettings.bot_token || !telegramSettings.chat_id}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Тест
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="p-6">
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">Импорт/Экспорт товаров</h2>
                <p className="text-sm text-zinc-500">
                  Загружайте товары из CSV файла или экспортируйте текущий каталог.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Import */}
                <div className="border border-zinc-200 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Импорт товаров
                  </h3>
                  <p className="text-sm text-zinc-500 mb-4">
                    CSV файл с разделителем ; (точка с запятой)
                  </p>
                  <input
                    type="file"
                    ref={importFileRef}
                    onChange={handleImportProducts}
                    accept=".csv"
                    className="hidden"
                  />
                  <Button 
                    onClick={() => importFileRef.current?.click()}
                    disabled={uploading}
                    className="w-full"
                    variant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Загрузка...' : 'Выбрать CSV файл'}
                  </Button>

                  {importResult && (
                    <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 text-sm">
                      <p className="text-green-600">✓ Импортировано: {importResult.imported}</p>
                      <p className="text-blue-600">↻ Обновлено: {importResult.updated}</p>
                      {importResult.total_errors > 0 && (
                        <>
                          <p className="text-red-600 mt-2">✕ Ошибок: {importResult.total_errors}</p>
                          <ul className="text-xs text-red-500 mt-1">
                            {importResult.errors.slice(0, 5).map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Export */}
                <div className="border border-zinc-200 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Экспорт товаров
                  </h3>
                  <p className="text-sm text-zinc-500 mb-4">
                    Скачать все товары в формате CSV
                  </p>
                  <Button onClick={handleExportProducts} variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Скачать CSV ({products.length} товаров)
                  </Button>
                </div>
              </div>

              {/* CSV format help */}
              <div className="border border-zinc-200 p-4 bg-zinc-50">
                <h3 className="font-semibold mb-2">Формат CSV файла</h3>
                <p className="text-xs text-zinc-500 mb-2">Обязательные колонки: article, name. Разделитель: ; (точка с запятой)</p>
                <div className="bg-white border border-zinc-200 p-2 font-mono text-xs overflow-x-auto">
                  <p>article;name;price;stock;delivery_days;description;category_id;image_url</p>
                  <p className="text-zinc-400">MAN-PG-001;Поршневая группа MAN;45000;10;3;Описание;id-категории;https://...</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Bonus Program Tab */}
          <TabsContent value="bonus" className="p-6">
            <div className="space-y-6">
              {/* Settings Section */}
              <div className="border border-zinc-200 bg-white">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-white">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    Настройки бонусной программы
                  </h2>
                </div>
                <div className="p-4 space-y-4">
                  {/* Title and Description */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-bold uppercase text-zinc-500">Заголовок</Label>
                      <Input
                        value={bonusSettings.title || ''}
                        onChange={(e) => setBonusSettings({...bonusSettings, title: e.target.value})}
                        placeholder="Бонусная программа"
                        className="mt-1"
                        data-testid="bonus-title-input"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase text-zinc-500">Описание</Label>
                      <Input
                        value={bonusSettings.description || ''}
                        onChange={(e) => setBonusSettings({...bonusSettings, description: e.target.value})}
                        placeholder="Накопите сумму заказов и получите бонус!"
                        className="mt-1"
                        data-testid="bonus-description-input"
                      />
                    </div>
                  </div>
                  
                  {/* Image Upload */}
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Изображение</Label>
                    <div className="mt-1 flex items-center gap-4">
                      <input
                        type="file"
                        ref={bonusImageFileRef}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = await handleFileUpload(file, 'bonus');
                            if (url) {
                              setBonusSettings({...bonusSettings, image_url: url});
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
                      {bonusSettings.image_url && (
                        <div className="flex items-center gap-2">
                          <img src={bonusSettings.image_url} alt="Bonus" className="h-12 object-contain rounded" />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setBonusSettings({...bonusSettings, image_url: ''})}
                            className="text-red-500 h-8 px-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Numeric Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs font-bold uppercase text-zinc-500">Цель прогресс-бара (₽)</Label>
                      <Input
                        type="number"
                        value={bonusSettings.max_amount || 50000}
                        onChange={(e) => setBonusSettings({...bonusSettings, max_amount: parseFloat(e.target.value) || 50000})}
                        className="mt-1"
                        data-testid="bonus-max-amount-input"
                      />
                      <p className="text-xs text-zinc-400 mt-1">Максимальное значение шкалы</p>
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase text-zinc-500">Мин. порог для запроса (₽)</Label>
                      <Input
                        type="number"
                        value={bonusSettings.min_threshold || 5000}
                        onChange={(e) => setBonusSettings({...bonusSettings, min_threshold: parseFloat(e.target.value) || 5000})}
                        className="mt-1"
                        data-testid="bonus-min-threshold-input"
                      />
                      <p className="text-xs text-zinc-400 mt-1">Минимум для кнопки «Запросить бонус»</p>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs font-bold uppercase text-zinc-500">Статус</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Switch
                            checked={bonusSettings.enabled}
                            onCheckedChange={(checked) => setBonusSettings({...bonusSettings, enabled: checked})}
                            data-testid="bonus-enabled-switch"
                          />
                          <span className={`text-sm ${bonusSettings.enabled ? 'text-green-600' : 'text-zinc-400'}`}>
                            {bonusSettings.enabled ? 'Активна' : 'Отключена'}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={async () => {
                          try {
                            await axios.put(`${API}/admin/bonus/settings`, bonusSettings);
                            toast.success('Настройки сохранены');
                          } catch (err) {
                            toast.error('Ошибка сохранения');
                          }
                        }}
                        className="bg-orange-500 hover:bg-orange-600"
                        data-testid="save-bonus-settings-btn"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Сохранить
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Users Progress Section */}
              <div className="border border-zinc-200 bg-white">
                <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5 text-zinc-500" />
                    Прогресс пользователей ({bonusUsers.length})
                    {pendingBonusRequests > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full ml-2">
                        {pendingBonusRequests} запросов
                      </span>
                    )}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        <th className="text-left py-3 px-4">Пользователь</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-center py-3 px-4">Прогресс</th>
                        <th className="text-right py-3 px-4">Сумма заказов (доставлено)</th>
                        <th className="text-center py-3 px-4">Статус</th>
                        <th className="text-right py-3 px-4">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bonusUsers.map((bu) => (
                        <tr 
                          key={bu.id} 
                          className={`border-b border-zinc-100 hover:bg-zinc-50 ${bu.bonus_requested ? 'bg-orange-50' : ''}`}
                          data-testid={`bonus-user-row-${bu.id}`}
                        >
                          <td className="py-3 px-4 font-medium">
                            {bu.name}
                            {bu.bonus_requested && (
                              <span className="ml-2 inline-flex items-center" title="Запросил бонус">
                                <Gift className="w-4 h-4 text-orange-500 animate-pulse" />
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-zinc-500">{bu.email}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${bu.bonus_requested ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-orange-400 to-orange-600'}`}
                                  style={{width: `${bu.percentage}%`}}
                                />
                              </div>
                              <span className="text-xs font-mono text-zinc-500 w-12 text-right">{bu.percentage.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            <span className={bu.bonus_requested ? 'text-green-600 font-bold' : ''}>
                              {bu.current_amount.toFixed(0)} ₽
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {bu.bonus_requested ? (
                              <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-xs font-bold">
                                Ожидает бонус
                              </span>
                            ) : bu.current_amount >= (bonusSettings.min_threshold || 5000) ? (
                              <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-bold">
                                Готов к запросу
                              </span>
                            ) : (
                              <span className="bg-zinc-100 text-zinc-500 px-2 py-1 rounded text-xs">
                                Накапливает
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {bu.bonus_requested && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setIssueBonusModal({ userId: bu.id, userName: bu.name, amount: bu.current_amount });
                                  setBonusCodeInput('');
                                }}
                                className="bg-green-500 hover:bg-green-600 text-white"
                                data-testid={`issue-bonus-btn-${bu.id}`}
                              >
                                <Gift className="w-4 h-4 mr-1" />
                                Выдать бонус
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {bonusUsers.length === 0 && (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-zinc-400">
                            Нет пользователей
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bonus History Section */}
              <div className="border border-zinc-200 bg-white">
                <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Award className="w-5 h-5 text-zinc-500" />
                    История выдачи бонусов ({bonusHistory.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {bonusHistory.length === 0 ? (
                    <p className="text-center text-zinc-400 py-8">История пуста</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          <th className="text-left py-3 px-4">Дата</th>
                          <th className="text-left py-3 px-4">Пользователь</th>
                          <th className="text-left py-3 px-4">Промокод</th>
                          <th className="text-right py-3 px-4">Сумма на момент выдачи</th>
                          <th className="text-left py-3 px-4">Выдал</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bonusHistory.map((item) => (
                          <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                            <td className="py-3 px-4 text-zinc-500 text-xs">
                              {formatDate(item.created_at)}
                            </td>
                            <td className="py-3 px-4 font-medium">{item.user_name}</td>
                            <td className="py-3 px-4">
                              <span className="font-mono bg-zinc-100 px-2 py-1 rounded text-sm">
                                {item.bonus_code}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-zinc-500">
                              {(item.amount_at_issue || 0).toFixed(0)} ₽
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-sm">
                              {item.issued_by || 'Администратор'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Issue Bonus Modal */}
          <Dialog open={!!issueBonusModal} onOpenChange={() => setIssueBonusModal(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-orange-500" />
                  Выдать бонус пользователю
                </DialogTitle>
              </DialogHeader>
              {issueBonusModal && (
                <div className="space-y-4">
                  <div className="bg-zinc-50 p-4 rounded-lg">
                    <p className="font-medium">{issueBonusModal.userName}</p>
                    <p className="text-sm text-zinc-500">
                      Накоплено: <span className="font-mono font-bold text-green-600">{issueBonusModal.amount?.toFixed(0)} ₽</span>
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Промокод для выдачи</Label>
                    <Input
                      value={bonusCodeInput}
                      onChange={(e) => setBonusCodeInput(e.target.value)}
                      placeholder="Введите промокод (например: BONUS500)"
                      className="mt-1 font-mono"
                      data-testid="bonus-code-input"
                    />
                    <p className="text-xs text-zinc-400 mt-1">
                      Этот код будет отправлен пользователю
                    </p>
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIssueBonusModal(null)}
                    >
                      Отмена
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!bonusCodeInput.trim()) {
                          toast.error('Введите промокод');
                          return;
                        }
                        setIssuingBonus(true);
                        try {
                          await axios.post(`${API}/admin/bonus/issue/${issueBonusModal.userId}?bonus_code=${encodeURIComponent(bonusCodeInput.trim())}`);
                          toast.success(`Бонус выдан: ${bonusCodeInput}`);
                          setIssueBonusModal(null);
                          setBonusCodeInput('');
                          fetchData();
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Ошибка выдачи бонуса');
                        } finally {
                          setIssuingBonus(false);
                        }
                      }}
                      disabled={issuingBonus || !bonusCodeInput.trim()}
                      className="bg-green-500 hover:bg-green-600"
                      data-testid="confirm-issue-bonus-btn"
                    >
                      <Gift className="w-4 h-4 mr-2" />
                      {issuingBonus ? 'Выдача...' : 'Выдать бонус'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Partners Tab */}
          <TabsContent value="partners" className="p-6">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Партнёры на главной странице</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await axios.post(`${API}/admin/partners/seed`);
                        toast.success('Партнёры по умолчанию добавлены');
                        fetchData();
                      } catch (err) {
                        toast.error('Ошибка');
                      }
                    }}
                  >
                    Добавить стандартные
                  </Button>
                  <Button 
                    onClick={() => {
                      setIsNewPartner(true);
                      setEditingPartner({ name: '', description: '', image_url: '', link: '', order: partners.length });
                    }}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить партнёра
                  </Button>
                </div>
              </div>

              {partners.length === 0 ? (
                <div className="text-center py-12 border border-zinc-200 bg-white">
                  <Image className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
                  <p className="text-zinc-500">Нет партнёров. Добавьте первого или нажмите &quot;Добавить стандартные&quot;.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...partners].sort((a, b) => a.order - b.order).map((partner) => (
                    <div key={partner.id} className="border border-zinc-200 bg-white p-4 group relative">
                      {/* Partner image */}
                      <div className="h-20 mb-3 flex items-center justify-center bg-zinc-50 overflow-hidden">
                        {partner.image_url ? (
                          <img src={partner.image_url} alt={partner.name} className="max-w-full max-h-full object-contain" />
                        ) : (
                          <Image className="w-8 h-8 text-zinc-300" />
                        )}
                      </div>
                      
                      {/* Partner info */}
                      <h3 className="font-semibold text-zinc-900">{partner.name}</h3>
                      <p className="text-sm text-zinc-500 truncate">{partner.description}</p>
                      {partner.link && (
                        <a href={partner.link} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:underline truncate block">
                          {partner.link}
                        </a>
                      )}
                      <p className="text-xs text-zinc-400 mt-1">Порядок: {partner.order}</p>
                      
                      {/* Actions */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setIsNewPartner(false);
                            setEditingPartner({ ...partner });
                          }}
                          className="p-1.5 bg-white border border-zinc-200 rounded hover:bg-zinc-100"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Удалить партнёра?')) {
                              try {
                                await axios.delete(`${API}/admin/partners/${partner.id}`);
                                setPartners(prev => prev.filter(p => p.id !== partner.id));
                                toast.success('Партнёр удалён');
                              } catch (err) {
                                toast.error('Ошибка удаления');
                              }
                            }
                          }}
                          className="p-1.5 bg-white border border-zinc-200 rounded hover:bg-red-100 text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Product Modal */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="product-edit-modal">
          <DialogHeader>
            <DialogTitle>{isNewProduct ? 'Добавить товар' : 'Редактировать товар'}</DialogTitle>
          </DialogHeader>
          
          {editingProduct && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Название *</Label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="mt-1"
                  data-testid="product-name-input"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Артикул *</Label>
                <Input
                  value={editingProduct.article}
                  onChange={(e) => setEditingProduct({ ...editingProduct, article: e.target.value })}
                  className="mt-1"
                  data-testid="product-article-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Производитель</Label>
                <Input
                  value={editingProduct.manufacturer || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, manufacturer: e.target.value })}
                  placeholder="Например: SACHS, BPW, MAN"
                  className="mt-1"
                  data-testid="product-manufacturer-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Категория</Label>
                <select
                  value={editingProduct.category_id || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value || null })}
                  className="mt-1 w-full h-10 px-3 border border-zinc-200 bg-white"
                  data-testid="product-category-select"
                >
                  <option value="">Без категории</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Цена *</Label>
                  <Input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                    data-testid="product-price-input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Наличие</Label>
                  <Input
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                    data-testid="product-stock-input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Доставка (дней)</Label>
                  <Input
                    type="number"
                    value={editingProduct.delivery_days}
                    onChange={(e) => setEditingProduct({ ...editingProduct, delivery_days: parseInt(e.target.value) || 3 })}
                    className="mt-1"
                    data-testid="product-delivery-input"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Изображения</Label>
                <div className="mt-1 space-y-3">
                  <input
                    type="file"
                    ref={productFileRef}
                    onChange={(e) => handleMultipleImageUpload(Array.from(e.target.files || []))}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => productFileRef.current?.click()}
                      disabled={uploading}
                      className="flex-1"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Загрузка...' : 'Загрузить изображения'}
                    </Button>
                  </div>
                  
                  {/* Image gallery */}
                  {(editingProduct.images?.length > 0 || editingProduct.image_url) && (
                    <div className="grid grid-cols-4 gap-2">
                      {/* Main image first */}
                      {editingProduct.image_url && (
                        <div className="relative group">
                          <div className="aspect-square bg-zinc-100 overflow-hidden border-2 border-orange-500">
                            <img src={editingProduct.image_url} alt="Main" className="w-full h-full object-cover" />
                          </div>
                          <span className="absolute top-1 left-1 bg-orange-500 text-white text-[10px] px-1 py-0.5">
                            Главное
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(editingProduct.image_url)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
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
                            <div className="aspect-square bg-zinc-100 overflow-hidden border border-zinc-200 hover:border-zinc-400">
                              <img src={img} alt={`Product ${idx + 2}`} className="w-full h-full object-cover" />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSetMainImage(img)}
                              className="absolute bottom-1 left-1 bg-blue-500 text-white text-[10px] px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Сделать главным
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(img)}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                  
                  <Input
                    placeholder="Или вставьте URL и нажмите Enter..."
                    className="text-sm"
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
                  <p className="text-xs text-zinc-400">Загрузите несколько изображений или добавьте URL. Первое изображение будет главным.</p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Описание</Label>
                <Textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="mt-1"
                  rows={3}
                  data-testid="product-description-input"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Кросс-номера (аналоги)</Label>
                <Textarea
                  value={editingProduct.cross_articles || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, cross_articles: e.target.value })}
                  placeholder="Артикулы аналогов через запятую или с новой строки. Например: MAN-001, SACHS-002"
                  className="mt-1 font-mono text-sm"
                  rows={3}
                  data-testid="product-cross-articles-input"
                />
                <p className="text-xs text-zinc-400 mt-1">Позволяет находить товар по артикулам аналогов в поиске</p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingProduct(null)}>
                  Отмена
                </Button>
                <Button onClick={handleSaveProduct} className="bg-orange-500 hover:bg-orange-600" data-testid="save-product-btn">
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
                <Button onClick={handleSaveCategory} className="bg-orange-500 hover:bg-orange-600" data-testid="save-category-btn">
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
                  <p className="font-medium">Наличными при получении</p>
                </div>
              </div>

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
                <select
                  value={viewingOrder.status}
                  onChange={(e) => handleUpdateOrderStatus(viewingOrder.id, e.target.value)}
                  className={`w-full mt-2 h-10 px-3 border border-zinc-200 font-semibold ${STATUS_OPTIONS.find(s => s.value === viewingOrder.status)?.color || 'bg-zinc-50'}`}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
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
                  className="bg-orange-500 hover:bg-orange-600" 
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

              <div className="bg-zinc-50 p-3 border border-zinc-200">
                <p className="text-sm text-zinc-500">Сумма заказа:</p>
                <p className="text-xl font-bold font-mono">{formatPrice(editingOrder.total)} ₽</p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingOrder(null)}>
                  Отмена
                </Button>
                <Button 
                  onClick={handleSaveOrder} 
                  className="bg-orange-500 hover:bg-orange-600" 
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
        <DialogContent className="max-w-lg" data-testid="partner-edit-modal">
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
                <Label className="text-xs font-bold uppercase text-zinc-500">URL изображения (логотип)</Label>
                <Input
                  value={editingPartner.image_url}
                  onChange={(e) => setEditingPartner({ ...editingPartner, image_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="mt-1"
                />
                {editingPartner.image_url && (
                  <div className="mt-2 h-16 bg-zinc-100 flex items-center justify-center">
                    <img src={editingPartner.image_url} alt="Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
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
                  className="bg-orange-500 hover:bg-orange-600"
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
    </div>
  );
}
