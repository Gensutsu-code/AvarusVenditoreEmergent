import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Package, ShoppingBag, TrendingUp, 
  Plus, Pencil, Trash2, Save, Eye, FolderOpen, Megaphone, Upload, Image,
  MessageCircle, Send, BarChart3, Download, FileSpreadsheet
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
      const [statsRes, productsRes, categoriesRes, usersRes, ordersRes, bannerRes, telegramRes, chatsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/products`),
        axios.get(`${API}/categories`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/orders`),
        axios.get(`${API}/promo-banner`),
        axios.get(`${API}/admin/telegram-settings`),
        axios.get(`${API}/admin/chats`)
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setUsers(usersRes.data);
      setOrders(ordersRes.data);
      setPromoBanner(bannerRes.data);
      setTelegramSettings(telegramRes.data);
      setChats(chatsRes.data);
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
      cross_articles: ''
    });
  };

  const openEditProduct = (product) => {
    setIsNewProduct(false);
    setEditingProduct({ ...product, cross_articles: product.cross_articles || '' });
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
                <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 font-semibold text-sm">
                  Диалоги ({chats.length})
                </div>
                <div className="flex-1 overflow-y-auto">
                  {chats.length === 0 ? (
                    <p className="text-center text-zinc-400 text-sm py-8">Нет диалогов</p>
                  ) : (
                    chats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => handleSelectChat(chat)}
                        className={`w-full text-left p-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
                          selectedChat?.id === chat.id ? 'bg-orange-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{chat.user_name}</span>
                          {chat.unread_count > 0 && (
                            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">{chat.user_email}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Chat messages */}
              <div className="md:col-span-2 border border-zinc-200 overflow-hidden flex flex-col">
                {selectedChat ? (
                  <>
                    <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200">
                      <span className="font-semibold text-sm">{selectedChat.user_name}</span>
                      <span className="text-xs text-zinc-400 ml-2">{selectedChat.user_email}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                              msg.sender_type === 'admin'
                                ? 'bg-orange-500 text-white'
                                : 'bg-white border border-zinc-200'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <p className={`text-[10px] mt-1 ${msg.sender_type === 'admin' ? 'text-orange-200' : 'text-zinc-400'}`}>
                              {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </p>
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
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-zinc-400">
                    <div className="text-center">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Выберите диалог</p>
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
        </Tabs>
      </div>

      {/* Edit Product Modal */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg" data-testid="product-edit-modal">
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
                <Label className="text-xs font-bold uppercase text-zinc-500">Изображение</Label>
                <div className="mt-1 space-y-2">
                  <input
                    type="file"
                    ref={productFileRef}
                    onChange={handleProductImageUpload}
                    accept="image/*"
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
                      {uploading ? 'Загрузка...' : 'Загрузить изображение'}
                    </Button>
                  </div>
                  <Input
                    value={editingProduct.image_url || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                    placeholder="Или вставьте URL: https://..."
                    className="text-sm"
                    data-testid="product-image-input"
                  />
                  {editingProduct.image_url && (
                    <div className="w-24 h-24 bg-zinc-100 overflow-hidden border">
                      <img src={editingProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
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
        <DialogContent className="max-w-lg" data-testid="user-edit-modal">
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
        <DialogContent className="max-w-lg" data-testid="order-edit-modal">
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
    </div>
  );
}
