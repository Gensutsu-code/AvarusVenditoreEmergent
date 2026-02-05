import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Package, ShoppingBag, TrendingUp, User,
  Plus, Pencil, Trash2, Save, Eye, FolderOpen, Megaphone, Upload, Image,
  MessageCircle, Send, BarChart3, Download, FileSpreadsheet, Pin, Tag, X, Copy, Gift, Award, ChevronDown, Paperclip, Play, ZoomIn, ZoomOut
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
  const [issueBonusModal, setIssueBonusModal] = useState(null); // { programId, userId, userName, amount }
  const [bonusCodeInput, setBonusCodeInput] = useState('');
  const [issuingBonus, setIssuingBonus] = useState(false);
  const bonusImageFileRef = useRef(null);
  
  // Partners states
  const [partners, setPartners] = useState([]);
  const [editingPartner, setEditingPartner] = useState(null);
  const [isNewPartner, setIsNewPartner] = useState(false);
  const partnerImageRef = useRef(null);
  const [partnerImageUploading, setPartnerImageUploading] = useState(false);
  
  // User details expansion
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  
  // Admin chat file upload
  const adminChatFileRef = useRef(null);
  const [adminChatUploading, setAdminChatUploading] = useState(false);

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
      const [statsRes, productsRes, categoriesRes, usersRes, ordersRes, bannerRes, telegramRes, chatsRes, bonusProgramsRes, bonusHistoryRes, partnersRes] = await Promise.all([
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
      setBonusPrograms(bonusProgramsRes.data.programs || []);
      setBonusHistory(bonusHistoryRes.data.history || []);
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
      
      const res = await axios.post(`${API}/admin/products/import`, formData, {
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
      
    <div className="min-h-screen bg-zinc-50" data-testid="admin-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-6">
          Панель администратора
        </h1>

        {/* Stats Cards - Modern Design */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Пользователей</p>
                  <p className="text-3xl font-bold mt-1">{stats.total_users}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Товаров</p>
                  <p className="text-3xl font-bold mt-1">{stats.total_products}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6" />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Заказов</p>
                  <p className="text-3xl font-bold mt-1">{stats.total_orders}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6" />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Выручка</p>
                  <p className="text-2xl font-bold mt-1">{formatPrice(stats.total_revenue)} ₽</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs - Compact Horizontal */}
        <Tabs defaultValue="products" className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <TabsList className="w-max min-w-full justify-start border-b border-zinc-200 rounded-none bg-zinc-50 p-0 h-auto">
              <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <Package className="w-3.5 h-3.5 mr-1.5" />
                Товары <span className="ml-1 text-[10px] bg-zinc-200 data-[state=active]:bg-orange-100 px-1.5 py-0.5 rounded-full">{products.length}</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                Категории <span className="ml-1 text-[10px] bg-zinc-200 data-[state=active]:bg-orange-100 px-1.5 py-0.5 rounded-full">{categories.length}</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                Заказы <span className="ml-1 text-[10px] bg-zinc-200 data-[state=active]:bg-orange-100 px-1.5 py-0.5 rounded-full">{orders.length}</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <Users className="w-3.5 h-3.5 mr-1.5" />
                Клиенты <span className="ml-1 text-[10px] bg-zinc-200 data-[state=active]:bg-orange-100 px-1.5 py-0.5 rounded-full">{users.length}</span>
              </TabsTrigger>
              <TabsTrigger value="promo" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <Megaphone className="w-3.5 h-3.5 mr-1.5" />
                Акции
              </TabsTrigger>
              <TabsTrigger value="stats" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                Аналитика
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                Чаты {chats.filter(c => c.unread_count > 0).length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                    {chats.reduce((sum, c) => sum + (c.unread_count || 0), 0)}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="telegram" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <Send className="w-3.5 h-3.5 mr-1.5" />
                TG
              </TabsTrigger>
              <TabsTrigger value="import" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                Импорт
              </TabsTrigger>
              <TabsTrigger value="bonus" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <Gift className="w-3.5 h-3.5 mr-1.5" />
                Бонусы {bonusPrograms.reduce((sum, p) => sum + (p.pending_requests || 0), 0) > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                    {bonusPrograms.reduce((sum, p) => sum + (p.pending_requests || 0), 0)}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="partners" className="rounded-none border-b-2 border-transparent data-[state=active]:bg-white data-[state=active]:border-orange-500 px-3 py-2.5 text-xs font-medium whitespace-nowrap">
                <Image className="w-3.5 h-3.5 mr-1.5" />
                Партнёры
              </TabsTrigger>
            </TabsList>
          </div>

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
              <h2 className="text-lg font-semibold">Управление пользователями ({users.length})</h2>
              <Button onClick={openNewUser} className="bg-orange-500 hover:bg-orange-600" data-testid="add-user-btn">
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
                      expandedUserId === u.id ? 'bg-orange-50 border-b border-orange-200' : ''
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
                            u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500">{u.email}</p>
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
                          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
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
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Пароль:</span>
                                <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded text-xs">
                                  {userDetails.user.plain_password || userDetails.user.password_plain || '***'}
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
                                <span className={`font-bold ${userDetails.user.role === 'admin' ? 'text-purple-600' : 'text-zinc-600'}`}>
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
                              <div className="bg-orange-50 p-3 rounded text-center">
                                <p className="text-2xl font-bold text-orange-600">{userDetails.statistics.total_orders}</p>
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
                              <div className="bg-purple-50 p-3 rounded text-center">
                                <p className="text-lg font-bold text-purple-600">{userDetails.statistics.total_items}</p>
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
                                        <span className="font-mono text-xs text-orange-600 mr-1">{p.article}</span>
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
              {/* Header with period selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">Аналитика и статистика</h2>
                  <p className="text-sm text-zinc-500">Комплексный обзор бизнес-показателей</p>
                </div>
                <select
                  value={statsPeriod}
                  onChange={(e) => setStatsPeriod(e.target.value)}
                  className="h-10 px-4 border border-zinc-200 bg-white rounded-lg font-medium"
                >
                  <option value="day">За день</option>
                  <option value="week">За неделю</option>
                  <option value="month">За месяц</option>
                  <option value="year">За год</option>
                </select>
              </div>

              {extendedStats && (
                <>
                  {/* Main KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Revenue Card */}
                    <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-xl text-white shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        {extendedStats.revenue_growth !== 0 && (
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            extendedStats.revenue_growth > 0 ? 'bg-white/20' : 'bg-red-500/50'
                          }`}>
                            {extendedStats.revenue_growth > 0 ? '+' : ''}{extendedStats.revenue_growth}%
                          </span>
                        )}
                      </div>
                      <p className="text-green-100 text-sm">Выручка</p>
                      <p className="text-2xl font-bold">{formatPrice(extendedStats.total_revenue)} ₽</p>
                      <p className="text-xs text-green-200 mt-1">
                        Пред. период: {formatPrice(extendedStats.prev_revenue)} ₽
                      </p>
                    </div>

                    {/* Orders Card */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-xl text-white shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        {extendedStats.orders_growth !== 0 && (
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            extendedStats.orders_growth > 0 ? 'bg-white/20' : 'bg-red-500/50'
                          }`}>
                            {extendedStats.orders_growth > 0 ? '+' : ''}{extendedStats.orders_growth}%
                          </span>
                        )}
                      </div>
                      <p className="text-blue-100 text-sm">Заказов</p>
                      <p className="text-2xl font-bold">{extendedStats.total_orders}</p>
                      <p className="text-xs text-blue-200 mt-1">
                        Товаров: {extendedStats.total_items} шт.
                      </p>
                    </div>

                    {/* Average Order Card */}
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-5 rounded-xl text-white shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-purple-100 text-sm">Средний чек</p>
                      <p className="text-2xl font-bold">{formatPrice(extendedStats.avg_order_value)} ₽</p>
                      <p className="text-xs text-purple-200 mt-1">
                        Уник. клиентов: {extendedStats.unique_customers}
                      </p>
                    </div>

                    {/* Users Card */}
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-xl text-white shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5" />
                        </div>
                        {extendedStats.new_users > 0 && (
                          <span className="text-xs font-bold px-2 py-1 rounded bg-white/20">
                            +{extendedStats.new_users} новых
                          </span>
                        )}
                      </div>
                      <p className="text-orange-100 text-sm">Пользователей</p>
                      <p className="text-2xl font-bold">{extendedStats.total_users}</p>
                      <p className="text-xs text-orange-200 mt-1">
                        Конверсия: {extendedStats.conversion_rate}%
                      </p>
                    </div>
                  </div>

                  {/* Secondary Stats Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                      <p className="text-xs text-zinc-400 uppercase">Всего товаров</p>
                      <p className="text-xl font-bold text-zinc-900">{extendedStats.total_products}</p>
                    </div>
                    <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                      <p className="text-xs text-zinc-400 uppercase">В наличии</p>
                      <p className="text-xl font-bold text-green-600">{extendedStats.active_products}</p>
                    </div>
                    <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                      <p className="text-xs text-zinc-400 uppercase">Нет в наличии</p>
                      <p className="text-xl font-bold text-red-500">{extendedStats.out_of_stock}</p>
                    </div>
                    <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                      <p className="text-xs text-zinc-400 uppercase">Заказов всего</p>
                      <p className="text-xl font-bold text-zinc-900">{extendedStats.all_time_orders}</p>
                    </div>
                    <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                      <p className="text-xs text-zinc-400 uppercase">Выручка всего</p>
                      <p className="text-xl font-bold text-zinc-900">{formatPrice(extendedStats.all_time_revenue)} ₽</p>
                    </div>
                    <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                      <p className="text-xs text-zinc-400 uppercase">Заказов/клиент</p>
                      <p className="text-xl font-bold text-zinc-900">{extendedStats.avg_orders_per_customer}</p>
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Daily Sales Chart */}
                    {extendedStats.daily_sales?.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-green-500" />
                          Динамика продаж
                        </h3>
                        <div className="overflow-x-auto">
                          <div className="flex items-end gap-1 h-48 min-w-max pb-6">
                            {extendedStats.daily_sales.map((day, idx) => {
                              const maxValue = Math.max(...extendedStats.daily_sales.map(d => d.total));
                              const height = maxValue > 0 ? (day.total / maxValue) * 100 : 0;
                              return (
                                <div key={idx} className="flex flex-col items-center gap-1 group relative">
                                  {/* Tooltip */}
                                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    {day.orders} заказов<br/>{formatPrice(day.total)} ₽
                                  </div>
                                  <div 
                                    className="w-6 sm:w-8 bg-gradient-to-t from-green-500 to-green-400 hover:from-green-600 hover:to-green-500 rounded-t transition-all cursor-pointer"
                                    style={{ height: `${Math.max(height, 4)}%`, minHeight: '8px' }}
                                  />
                                  <span className="text-[10px] text-zinc-400 transform -rotate-45 origin-top-left whitespace-nowrap absolute -bottom-6">
                                    {day.date.slice(5)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hourly Distribution */}
                    {extendedStats.hourly_distribution?.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-blue-500" />
                          Активность по часам
                        </h3>
                        <div className="flex items-end gap-[2px] h-32">
                          {extendedStats.hourly_distribution.map((h, idx) => {
                            const maxOrders = Math.max(...extendedStats.hourly_distribution.map(d => d.orders));
                            const height = maxOrders > 0 ? (h.orders / maxOrders) * 100 : 0;
                            return (
                              <div 
                                key={idx} 
                                className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t hover:from-blue-600 hover:to-blue-500 transition-all cursor-pointer relative group"
                                style={{ height: `${Math.max(height, 2)}%`, minHeight: '2px' }}
                              >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                  {h.hour}:00 - {h.orders}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                          <span>00:00</span>
                          <span>06:00</span>
                          <span>12:00</span>
                          <span>18:00</span>
                          <span>23:00</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Distribution */}
                  {Object.keys(extendedStats.status_distribution || {}).length > 0 && (
                    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                      <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-500" />
                        Распределение по статусам
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(extendedStats.status_distribution).map(([status, count]) => {
                          const statusInfo = STATUS_OPTIONS.find(s => s.value === status) || { label: status, color: 'bg-zinc-100' };
                          const total = Object.values(extendedStats.status_distribution).reduce((a, b) => a + b, 0);
                          const percent = total > 0 ? (count / total * 100).toFixed(1) : 0;
                          return (
                            <div key={status} className="flex items-center gap-3 bg-zinc-50 px-4 py-3 rounded-lg">
                              <div className={`w-3 h-3 rounded-full ${
                                status === 'delivered' ? 'bg-green-500' :
                                status === 'shipped' ? 'bg-blue-500' :
                                status === 'processing' ? 'bg-yellow-500' :
                                status === 'cancelled' ? 'bg-red-500' :
                                'bg-zinc-400'
                              }`} />
                              <div>
                                <p className="font-medium text-zinc-900">{statusInfo.label}</p>
                                <p className="text-sm text-zinc-500">{count} ({percent}%)</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Top Lists Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Top Products */}
                    {extendedStats.top_products?.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                          <Package className="w-5 h-5 text-orange-500" />
                          Топ товаров
                        </h3>
                        <div className="space-y-3">
                          {extendedStats.top_products.slice(0, 5).map((product, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                                idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                idx === 1 ? 'bg-zinc-200 text-zinc-600' :
                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-zinc-100 text-zinc-500'
                              }`}>
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900 truncate" title={product.name}>
                                  {product.name}
                                </p>
                                <p className="text-xs text-zinc-400">{product.article}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-zinc-900">{product.count} шт.</p>
                                <p className="text-xs text-green-600">{formatPrice(product.revenue)} ₽</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Customers */}
                    {extendedStats.top_customers?.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                          <Users className="w-5 h-5 text-blue-500" />
                          Топ клиентов
                        </h3>
                        <div className="space-y-3">
                          {extendedStats.top_customers.slice(0, 5).map((customer, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                                idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                idx === 1 ? 'bg-zinc-200 text-zinc-600' :
                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-zinc-100 text-zinc-500'
                              }`}>
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900 truncate">{customer.name}</p>
                                <p className="text-xs text-zinc-400 truncate">{customer.email}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-zinc-900">{formatPrice(customer.total_spent)} ₽</p>
                                <p className="text-xs text-zinc-500">{customer.orders} заказов</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Manufacturers */}
                    {extendedStats.top_manufacturers?.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                          <Award className="w-5 h-5 text-purple-500" />
                          Топ производителей
                        </h3>
                        <div className="space-y-3">
                          {extendedStats.top_manufacturers.slice(0, 5).map((mfr, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                                idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                idx === 1 ? 'bg-zinc-200 text-zinc-600' :
                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-zinc-100 text-zinc-500'
                              }`}>
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900 truncate">{mfr.name}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-zinc-900">{mfr.count} шт.</p>
                                <p className="text-xs text-green-600">{formatPrice(mfr.revenue)} ₽</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {!extendedStats && (
                <div className="text-center py-12 text-zinc-400">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Загрузка статистики...</p>
                </div>
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
                            <div className={`flex items-center gap-1 text-[10px] mt-1 ${msg.sender_type === 'admin' ? 'text-orange-200' : 'text-zinc-400'}`}>
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
                            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
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

          {/* Bonus Program Tab - Multiple Programs */}
          <TabsContent value="bonus" className="p-6">
            <div className="space-y-6">
              {/* Header with Add Button */}
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Gift className="w-5 h-5 text-orange-500" />
                  Бонусные программы ({bonusPrograms.length})
                </h2>
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
                  className="bg-orange-500 hover:bg-orange-600"
                  data-testid="add-bonus-program-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить программу
                </Button>
              </div>

              {/* Programs List */}
              {bonusPrograms.length === 0 ? (
                <div className="border border-dashed border-zinc-300 rounded-lg p-8 text-center">
                  <Gift className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
                  <p className="text-zinc-500">Нет бонусных программ</p>
                  <p className="text-sm text-zinc-400 mt-1">Создайте первую программу для начала работы</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bonusPrograms.map((program) => (
                    <div key={program.id} className="border border-zinc-200 bg-white rounded-lg overflow-hidden">
                      {/* Program Header */}
                      <div 
                        className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 ${
                          selectedProgramId === program.id ? 'bg-orange-50 border-b border-orange-200' : ''
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
                        <div className="flex items-center gap-3">
                          {program.image_url ? (
                            <img src={program.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center">
                              <Gift className="w-5 h-5 text-orange-500" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-medium flex items-center gap-2">
                              {program.title}
                              {!program.enabled && (
                                <span className="text-xs bg-zinc-200 text-zinc-500 px-2 py-0.5 rounded">Отключена</span>
                              )}
                              {program.pending_requests > 0 && (
                                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                                  {program.pending_requests} запросов
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-zinc-500">
                              {program.levels?.length > 0 
                                ? `${program.levels.length} уровней | Баллы начисляются по % от уровня`
                                : 'Уровни не настроены'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProgram({...program});
                              setIsNewProgram(false);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Удалить программу "${program.title}"?`)) {
                                try {
                                  await axios.delete(`${API}/admin/bonus/programs/${program.id}`);
                                  toast.success('Программа удалена');
                                  // Real-time update: remove from local state
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
                          </Button>
                          <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${
                            selectedProgramId === program.id ? 'rotate-180' : ''
                          }`} />
                        </div>
                      </div>

                      {/* Program Users (Expandable) */}
                      {selectedProgramId === program.id && (
                        <div className="border-t border-zinc-200">
                          <div className="bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-600">
                            Прогресс пользователей ({programUsers.length})
                          </div>
                          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="sticky top-0 bg-white">
                                <tr className="border-b border-zinc-200">
                                  <th className="text-left py-2 px-4">Пользователь</th>
                                  <th className="text-left py-2 px-4">Email</th>
                                  <th className="text-center py-2 px-4">Прогресс</th>
                                  <th className="text-right py-2 px-4">Сумма</th>
                                  <th className="text-center py-2 px-4">Статус</th>
                                  <th className="text-right py-2 px-4">Действия</th>
                                </tr>
                              </thead>
                              <tbody>
                                {programUsers.map((pu) => (
                                  <tr 
                                    key={pu.id} 
                                    className={`border-b border-zinc-100 hover:bg-zinc-50 ${pu.bonus_requested ? 'bg-orange-50' : ''}`}
                                  >
                                    <td className="py-2 px-4 font-medium">
                                      {pu.name}
                                      {pu.bonus_requested && (
                                        <Gift className="w-4 h-4 text-orange-500 inline ml-2 animate-pulse" />
                                      )}
                                    </td>
                                    <td className="py-2 px-4 text-zinc-500">{pu.email}</td>
                                    <td className="py-2 px-4">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full rounded-full ${pu.bonus_requested ? 'bg-green-500' : 'bg-orange-500'}`}
                                            style={{width: `${pu.percentage}%`}}
                                          />
                                        </div>
                                        <span className="text-xs font-mono w-10 text-right">{pu.percentage.toFixed(0)}%</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-4 text-right font-mono">
                                      <span className={pu.bonus_requested ? 'text-green-600 font-bold' : ''}>
                                        {pu.current_amount.toFixed(0)} ₽
                                      </span>
                                    </td>
                                    <td className="py-2 px-4 text-center">
                                      {pu.bonus_requested ? (
                                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-xs font-bold">
                                          Ожидает
                                        </span>
                                      ) : pu.current_amount >= program.min_threshold ? (
                                        <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs">
                                          Готов
                                        </span>
                                      ) : (
                                        <span className="bg-zinc-100 text-zinc-500 px-2 py-1 rounded text-xs">
                                          Копит
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-4 text-right">
                                      {pu.bonus_requested && (
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            setIssueBonusModal({
                                              programId: program.id,
                                              programTitle: program.title,
                                              userId: pu.id,
                                              userName: pu.name,
                                              amount: pu.current_amount
                                            });
                                            setBonusCodeInput('');
                                          }}
                                          className="bg-green-500 hover:bg-green-600 text-white"
                                        >
                                          <Gift className="w-3 h-3 mr-1" />
                                          Выдать
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {programUsers.length === 0 && (
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
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Bonus History Section */}
              <div className="border border-zinc-200 bg-white">
                <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Award className="w-5 h-5 text-zinc-500" />
                    История выдачи бонусов ({bonusHistory.length})
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  {bonusHistory.length === 0 ? (
                    <p className="text-center text-zinc-400 py-8">История пуста</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          <th className="text-left py-3 px-4">Дата</th>
                          <th className="text-left py-3 px-4">Программа</th>
                          <th className="text-left py-3 px-4">Пользователь</th>
                          <th className="text-left py-3 px-4">Промокод</th>
                          <th className="text-right py-3 px-4">Сумма</th>
                          <th className="text-left py-3 px-4">Выдал</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bonusHistory.map((item) => (
                          <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                            <td className="py-3 px-4 text-zinc-500 text-xs">
                              {formatDate(item.created_at)}
                            </td>
                            <td className="py-3 px-4 text-sm">{item.program_title || 'Бонусная программа'}</td>
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

                  {/* Button Text Customization */}
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500">Текст кнопки запроса бонуса</Label>
                    <Input
                      value={editingProgram.request_button_text || ''}
                      onChange={(e) => setEditingProgram({...editingProgram, request_button_text: e.target.value})}
                      placeholder="Запросить бонус"
                      className="mt-1"
                    />
                    <p className="text-xs text-zinc-400 mt-1">Оставьте пустым для текста по умолчанию</p>
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
                            // Real-time update: add to local state
                            setBonusPrograms(prev => [...prev, res.data]);
                          } else {
                            const res = await axios.put(`${API}/admin/bonus/programs/${editingProgram.id}`, editingProgram);
                            toast.success('Программа обновлена');
                            // Real-time update: update in local state
                            setBonusPrograms(prev => prev.map(p => p.id === editingProgram.id ? res.data : p));
                          }
                          setEditingProgram(null);
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Ошибка сохранения');
                        }
                      }}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isNewProgram ? 'Создать' : 'Сохранить'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Issue Bonus Modal */}
          <Dialog open={!!issueBonusModal} onOpenChange={() => setIssueBonusModal(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-orange-500" />
                  Выдать бонус
                </DialogTitle>
              </DialogHeader>
              {issueBonusModal && (
                <div className="space-y-4">
                  <div className="bg-zinc-50 p-4 rounded-lg">
                    <p className="text-sm text-zinc-500">Программа: <span className="font-medium text-zinc-700">{issueBonusModal.programTitle}</span></p>
                    <p className="font-medium mt-1">{issueBonusModal.userName}</p>
                    <p className="text-sm text-zinc-500">
                      Накоплено: <span className="font-mono font-bold text-green-600">{issueBonusModal.amount?.toFixed(0)} баллов</span>
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
                          await axios.post(`${API}/admin/bonus/programs/${issueBonusModal.programId}/issue/${issueBonusModal.userId}?bonus_code=${encodeURIComponent(bonusCodeInput.trim())}`);
                          toast.success(`Бонус выдан: ${bonusCodeInput}`);
                          setIssueBonusModal(null);
                          setBonusCodeInput('');
                          // Refresh program users (only the relevant data)
                          if (selectedProgramId) {
                            const res = await axios.get(`${API}/admin/bonus/programs/${selectedProgramId}/users`);
                            setProgramUsers(res.data.users || []);
                          }
                          // Update bonus history locally
                          const historyRes = await axios.get(`${API}/admin/bonus/history`);
                          setBonusHistory(historyRes.data.history || []);
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
                        const res = await axios.post(`${API}/admin/partners/seed`);
                        toast.success('Партнёры по умолчанию добавлены');
                        // Refresh partners from server
                        const partnersRes = await axios.get(`${API}/partners`);
                        setPartners(partnersRes.data || []);
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
    </>
  );
}
