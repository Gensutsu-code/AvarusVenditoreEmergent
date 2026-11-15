import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MessageCircle, Send, Paperclip, User, Clock, CheckCheck, Search, X, Play, Tag, Check, XCircle, Loader2, Package, Pin, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Media lightbox components
const ImageLightbox = ({ src, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
    <button className="absolute top-4 right-4 text-white hover:text-zinc-300" onClick={onClose}>
      <X className="w-8 h-8" />
    </button>
    <img src={src} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
  </div>
);

const VideoLightbox = ({ src, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
    <button className="absolute top-4 right-4 text-white hover:text-zinc-300" onClick={onClose}>
      <X className="w-8 h-8" />
    </button>
    <div className="max-w-4xl w-full aspect-video" onClick={(e) => e.stopPropagation()}>
      <video src={src} controls autoPlay className="w-full h-full rounded-lg bg-black">
        Ваш браузер не поддерживает видео
      </video>
    </div>
  </div>
);

export default function AdminChatsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'discounts'
  const [discountRequests, setDiscountRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [adminPrice, setAdminPrice] = useState('');
  const [processing, setProcessing] = useState(false);
  const [productRequests, setProductRequests] = useState([]);
  const [selectedProductReq, setSelectedProductReq] = useState(null);
  const [productReqResponse, setProductReqResponse] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQty, setOfferQty] = useState('');
  const [offerDelivery, setOfferDelivery] = useState('');
  const [cartDiscountRequests, setCartDiscountRequests] = useState([]);
  const [cartApproveInputs, setCartApproveInputs] = useState({});
  
  // Lightbox states
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxVideo, setLightboxVideo] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchChats();
    fetchDiscountRequests();
    fetchProductRequests();
    fetchCartDiscountRequests();
  }, [user, authLoading, navigate]);

  // Polling for new messages
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    
    const interval = setInterval(() => {
      fetchChats();
      if (selectedChat) {
        fetchMessages(selectedChat.id, false);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [user, selectedChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChats = async () => {
    try {
      const res = await axios.get(`${API}/admin/chats`);
      setChats(res.data);
    } catch (err) {
      console.error('Failed to fetch chats', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscountRequests = async () => {
    try {
      const res = await axios.get(`${API}/admin/discount-requests`);
      setDiscountRequests(res.data);
    } catch (err) {
      console.error('Failed to fetch discount requests', err);
    }
  };

  const handleApproveRequest = async (reqId) => {
    if (!adminPrice || parseFloat(adminPrice) <= 0) {
      toast.error('Укажите индивидуальную цену');
      return;
    }
    setProcessing(true);
    try {
      await axios.put(`${API}/admin/discount-requests/${reqId}/approve`, {
        individual_price: parseFloat(adminPrice),
        response_message: adminResponse
      });
      toast.success('Скидка одобрена');
      setSelectedRequest(null);
      setAdminResponse('');
      setAdminPrice('');
      fetchDiscountRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally {
      setProcessing(false);
    }
  };

  const handleAccountDiscount = async (reqId, mode) => {
    if (!adminPrice || parseFloat(adminPrice) <= 0 || parseFloat(adminPrice) > 90) {
      toast.error('Укажите процент скидки (1–90)');
      return;
    }
    setProcessing(true);
    try {
      const ep = mode === 'offer' ? 'offer-discount' : 'approve-discount';
      await axios.put(`${API}/admin/discount-requests/${reqId}/${ep}`, {
        discount_percent: parseFloat(adminPrice),
        response_message: adminResponse,
      });
      toast.success(mode === 'offer' ? 'Предложение отправлено' : 'Скидка применена');
      setSelectedRequest(null); setAdminResponse(''); setAdminPrice('');
      fetchDiscountRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally { setProcessing(false); }
  };

  const handleRejectRequest = async (reqId) => {
    setProcessing(true);
    try {
      await axios.put(`${API}/admin/discount-requests/${reqId}/reject`, {
        response_message: adminResponse
      });
      toast.success('Запрос отклонён');
      setSelectedRequest(null);
      setAdminResponse('');
      setAdminPrice('');
      fetchDiscountRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally {
      setProcessing(false);
    }
  };

  const fetchProductRequests = async () => {
    try {
      const res = await axios.get(`${API}/admin/product-requests`);
      setProductRequests(res.data);
    } catch (err) {
      console.error('Failed to fetch product requests', err);
    }
  };

  const fetchCartDiscountRequests = async () => {
    try {
      const res = await axios.get(`${API}/admin/cart-discount-requests`);
      setCartDiscountRequests(res.data || []);
    } catch (err) {
      console.error('Failed to fetch cart discount requests', err);
    }
  };

  const approveCartDiscount = async (id) => {
    const pct = Number(cartApproveInputs[id]);
    if (!pct || pct <= 0 || pct > 90) { toast.error('Введите процент от 1 до 90'); return; }
    setProcessing(true);
    try {
      await axios.put(`${API}/admin/cart-discount-requests/${id}/approve`, { admin_percent: pct });
      toast.success('Скидка на корзину одобрена');
      fetchCartDiscountRequests();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setProcessing(false); }
  };

  const rejectCartDiscount = async (id) => {
    setProcessing(true);
    try {
      await axios.put(`${API}/admin/cart-discount-requests/${id}/reject`, { response_message: '' });
      toast.success('Запрос отклонён');
      fetchCartDiscountRequests();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setProcessing(false); }
  };

  const [aiDrafting, setAiDrafting] = useState(false);
  const generateAiDraft = async () => {
    if (!selectedChat || aiDrafting) return;
    if (newMessage.trim() && !window.confirm('Заменить набранный текст черновиком от ИИ?')) return;
    setAiDrafting(true);
    try {
      const res = await axios.post(`${API}/admin/ai/chat-draft`, { chat_id: selectedChat.id });
      setNewMessage(res.data.draft || '');
      toast.success('Черновик готов — проверьте и отправьте');
    } catch (e) { toast.error(e.response?.data?.detail || 'Не удалось получить черновик'); }
    finally { setAiDrafting(false); }
  };

  const handleSendOffer = async (reqId) => {
    if (!offerPrice || Number(offerPrice) <= 0) {
      toast.error('Укажите цену предложения');
      return;
    }
    setProcessing(true);
    try {
      await axios.put(`${API}/admin/product-requests/${reqId}/respond`, {
        response_message: productReqResponse,
        status: 'offered',
        offer_price: Number(offerPrice),
        offer_quantity: offerQty ? parseInt(offerQty, 10) : null,
        offer_delivery_days: offerDelivery !== '' ? parseInt(offerDelivery, 10) : null,
      });
      toast.success('Предложение отправлено клиенту');
      setSelectedProductReq({
        ...selectedProductReq,
        status: 'offered',
        admin_response: productReqResponse,
        offer_price: Number(offerPrice),
        offer_quantity: offerQty ? parseInt(offerQty, 10) : null,
        offer_delivery_days: offerDelivery !== '' ? parseInt(offerDelivery, 10) : null,
      });
      fetchProductRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally {
      setProcessing(false);
    }
  };

  const handleRespondProductReq = async (reqId, status) => {
    if ((status === 'completed' || status === 'rejected') && !productReqResponse.trim()) {
      toast.error('Напишите ответ клиенту');
      return;
    }
    setProcessing(true);
    try {
      await axios.put(`${API}/admin/product-requests/${reqId}/respond`, {
        response_message: productReqResponse,
        status
      });
      toast.success(status === 'completed' ? 'Запрос выполнен' : status === 'rejected' ? 'Запрос отклонён' : status === 'processing' ? 'Запрос взят в обработку' : 'Статус обновлён');
      setSelectedProductReq(null);
      setProductReqResponse('');
      fetchProductRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally {
      setProcessing(false);
    }
  };

  const fetchMessages = async (chatId, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/chats/${chatId}/messages`);
      const msgs = Array.isArray(res.data) ? res.data : (res.data.messages || []);
      setMessages(msgs);
      // Mark as read via client endpoint  
      fetchChats(); // Refresh unread count
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const selectChat = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || sending) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/admin/chats/${selectedChat.id}/send`, {
        text: newMessage.trim()
      });
      setNewMessage('');
      fetchMessages(selectedChat.id, false);
    } catch (err) {
      toast.error('Ошибка отправки сообщения');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    toast.info('Загрузка файлов в чат пока не поддерживается');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  const togglePin = async (chatId) => {
    try {
      await axios.put(`${API}/admin/chats/${chatId}/pin`);
      fetchChats();
    } catch { toast.error('Ошибка'); }
  };

  const deleteChat = async (chatId) => {
    if (!window.confirm('Удалить чат?')) return;
    try {
      await axios.delete(`${API}/admin/chats/${chatId}`);
      if (selectedChat?.id === chatId) setSelectedChat(null);
      fetchChats();
      toast.success('Чат удалён');
    } catch { toast.error('Ошибка'); }
  };

  const updateLabel = async (chatId, label) => {
    try {
      await axios.put(`${API}/admin/chats/${chatId}/label?label=${encodeURIComponent(label)}`);
      fetchChats();
    } catch { toast.error('Ошибка'); }
  };

  const LABELS = [
    { value: '', label: 'Без метки', color: '' },
    { value: 'important', label: 'Важный', color: 'bg-red-500' },
    { value: 'vip', label: 'VIP', color: 'bg-yellow-500' },
    { value: 'resolved', label: 'Решён', color: 'bg-green-500' },
    { value: 'waiting', label: 'Ожидание', color: 'bg-blue-500' },
  ];


  const filteredChats = chats.filter(chat => 
    !searchQuery || 
    chat.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
  const pendingDiscounts = discountRequests.filter(r => r.status === 'pending').length;
  const pendingProductReqs = productRequests.filter(r => r.status === 'pending').length;
  const pendingCartDiscounts = cartDiscountRequests.filter(r => r.status === 'pending').length;

  if (authLoading || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-950' : ''}`}>
        <motion.div 
          className={`w-8 h-8 border-2 ${isDark ? 'border-orange-500' : 'border-teal-500'} border-t-transparent rounded-full`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : ''}`} data-testid="admin-chats-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with tabs */}
        <div className="mb-6">
          <h1 className={`text-2xl md:text-3xl font-bold tracking-tight uppercase mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <span className={`bg-gradient-to-r ${isDark ? 'from-orange-400 to-orange-600' : 'from-teal-500 to-emerald-500'} bg-clip-text text-transparent`}>
              Коммуникации
            </span>
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'chats'
                  ? isDark ? 'bg-orange-500 text-white' : 'bg-teal-500 text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
              data-testid="tab-chats"
            >
              <MessageCircle className="w-4 h-4" />
              Чаты
              {totalUnread > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">{totalUnread}</span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('discounts'); fetchDiscountRequests(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'discounts'
                  ? 'bg-rose-500 text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
              data-testid="tab-discounts"
            >
              <Tag className="w-4 h-4" />
              Запросы на скидку
              {pendingDiscounts > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">{pendingDiscounts}</span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('products'); fetchProductRequests(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'products'
                  ? 'bg-blue-500 text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
              data-testid="tab-product-requests"
            >
              <Package className="w-4 h-4" />
              Запросы товара
              {pendingProductReqs > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">{pendingProductReqs}</span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('cart-discounts'); fetchCartDiscountRequests(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'cart-discounts'
                  ? 'bg-teal-500 text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
              data-testid="tab-cart-discounts"
            >
              <ShoppingCart className="w-4 h-4" />
              Скидка на корзину
              {pendingCartDiscounts > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">{pendingCartDiscounts}</span>
              )}
            </button>
          </div>
        </div>

        {/* Discount Requests Tab */}
        {activeTab === 'discounts' && (
          <div className="glass-card overflow-hidden flex h-[calc(100vh-240px)] min-h-[500px]" data-testid="discount-requests-panel">
            {/* Requests List */}
            <div className={`w-96 flex-shrink-0 border-r ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex flex-col overflow-y-auto`}>
              {discountRequests.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Нет запросов</p>
                </div>
              ) : (
                discountRequests.map(req => (
                  <div
                    key={req.id}
                    onClick={() => { setSelectedRequest(req); setAdminResponse(req.admin_response || ''); setAdminPrice(req.product_id ? (req.individual_price ? String(req.individual_price) : '') : String(req.offered_discount ?? req.requested_discount ?? '')); }}
                    className={`p-4 border-b cursor-pointer transition-colors ${
                      selectedRequest?.id === req.id
                        ? isDark ? 'bg-zinc-800' : 'bg-teal-50'
                        : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-slate-50'
                    } ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}
                    data-testid={`discount-request-${req.id}`}
                  >
                    <div className="flex items-start gap-3">
                      {req.product_image_url ? (
                        <img src={req.product_image_url} alt="" className="w-10 h-10 rounded-lg object-cover border flex-shrink-0" />
                      ) : (
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-zinc-700' : 'bg-slate-100'}`}>
                          <Tag className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>
                          {req.user_name || req.user_email}
                        </p>
                        <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                          {req.product_name}
                        </p>
                        <p className={`text-xs font-mono ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>
                          {req.product_article} · {new Intl.NumberFormat('ru-RU').format(req.current_price)} ₽
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        req.status === 'approved' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {req.status === 'pending' ? 'Ожидает' : req.status === 'approved' ? 'Одобрен' : 'Отклонён'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Request Detail */}
            <div className="flex-1 flex flex-col">
              {selectedRequest ? (
                <>
                  <div className={`p-5 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                    <div className="flex items-center gap-4">
                      {selectedRequest.product_image_url && (
                        <img src={selectedRequest.product_image_url} alt="" className="w-16 h-16 rounded-xl object-cover border" />
                      )}
                      <div>
                        <h3 className={`font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{selectedRequest.product_name}</h3>
                        <p className={`text-sm font-mono ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>{selectedRequest.product_article}</p>
                        <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                          Текущая цена: <span className="font-bold">{new Intl.NumberFormat('ru-RU').format(selectedRequest.current_price)} ₽</span>
                        </p>
                      </div>
                    </div>
                    <div className={`mt-3 flex items-center gap-3 text-sm ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                      <User className="w-4 h-4" />
                      <span>{selectedRequest.user_name} ({selectedRequest.user_email})</span>
                      <Clock className="w-4 h-4 ml-2" />
                      <span>{new Date(selectedRequest.created_at).toLocaleString('ru-RU')}</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Client message */}
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Сообщение клиента</p>
                      <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{selectedRequest.message}</p>
                    </div>

                    {/* Attached image */}
                    {selectedRequest.image_url && (
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Прикреплённое фото</p>
                        <img
                          src={selectedRequest.image_url}
                          alt="Скриншот"
                          className="max-w-sm rounded-xl border cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightboxImage(selectedRequest.image_url)}
                        />
                      </div>
                    )}

                    {/* Already processed */}
                    {!['pending', 'offered'].includes(selectedRequest.status) && (
                      <div className={`p-4 rounded-xl ${
                        ['approved', 'accepted'].includes(selectedRequest.status)
                          ? isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'
                          : isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'
                      }`}>
                        <p className={`text-sm font-bold ${
                          ['approved', 'accepted'].includes(selectedRequest.status)
                            ? isDark ? 'text-green-400' : 'text-green-700'
                            : isDark ? 'text-red-400' : 'text-red-700'
                        }`}>
                          {selectedRequest.product_id
                            ? (selectedRequest.status === 'approved' ? `Одобрено — индивидуальная цена: ${new Intl.NumberFormat('ru-RU').format(selectedRequest.individual_price)} ₽` : 'Отклонено')
                            : (selectedRequest.status === 'approved' ? `Скидка применена: ${selectedRequest.approved_discount}%`
                              : selectedRequest.status === 'accepted' ? `Клиент принял: ${selectedRequest.approved_discount || selectedRequest.offered_discount}%`
                              : selectedRequest.status === 'rejected_by_client' ? 'Клиент отклонил предложение'
                              : 'Отклонено')}
                        </p>
                        {selectedRequest.admin_response && (
                          <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>{selectedRequest.admin_response}</p>
                        )}
                      </div>
                    )}

                    {/* Admin action area */}
                    {(selectedRequest.status === 'pending' || selectedRequest.status === 'offered') && (
                      selectedRequest.product_id ? (
                      <div className={`p-4 rounded-xl space-y-3 ${isDark ? 'bg-zinc-800/30 border border-zinc-700/50' : 'bg-white border border-slate-200'}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Ваш ответ</p>
                        <div>
                          <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>Индивидуальная цена (₽)</label>
                          <Input type="number" value={adminPrice} onChange={(e) => setAdminPrice(e.target.value)} placeholder="Укажите цену..." className={`${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}`} data-testid="admin-price-input" />
                        </div>
                        <div>
                          <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>Сообщение клиенту (необязательно)</label>
                          <Textarea value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} placeholder="Ваш комментарий..." className={`min-h-[60px] ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}`} data-testid="admin-response-input" />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleApproveRequest(selectedRequest.id)} disabled={processing || !adminPrice} className="flex-1 bg-green-500 hover:bg-green-600 text-white" data-testid="approve-discount-btn">
                            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}Одобрить
                          </Button>
                          <Button onClick={() => handleRejectRequest(selectedRequest.id)} disabled={processing} variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50" data-testid="reject-discount-btn">
                            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}Отклонить
                          </Button>
                        </div>
                      </div>
                      ) : (
                      <div className={`p-4 rounded-xl space-y-3 ${isDark ? 'bg-zinc-800/30 border border-zinc-700/50' : 'bg-white border border-slate-200'}`} data-testid="account-discount-actions">
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Индивидуальная скидка на все заказы{selectedRequest.status === 'offered' ? ' (предложено, ждём клиента)' : ''}</p>
                        <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Клиент запросил: <b>{selectedRequest.requested_discount}%</b>{selectedRequest.reason ? ` · «${selectedRequest.reason}»` : ''}</p>
                        <div>
                          <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>Ваш процент скидки, %</label>
                          <Input type="number" min="1" max="90" value={adminPrice} onChange={(e) => setAdminPrice(e.target.value)} placeholder="например, 5" className={`${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}`} data-testid="account-discount-input" />
                        </div>
                        <div>
                          <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>Комментарий / обоснование (необязательно)</label>
                          <Textarea value={adminResponse} onChange={(e) => setAdminResponse(e.target.value)} placeholder="Ваш комментарий..." className={`min-h-[60px] ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}`} data-testid="account-discount-response" />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button onClick={() => handleAccountDiscount(selectedRequest.id, 'approve')} disabled={processing || !adminPrice} className="flex-1 bg-green-500 hover:bg-green-600 text-white" data-testid="account-discount-approve-btn">
                            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}Применить сразу
                          </Button>
                          <Button onClick={() => handleAccountDiscount(selectedRequest.id, 'offer')} disabled={processing || !adminPrice} className="flex-1 bg-teal-500 hover:bg-teal-600 text-white" data-testid="account-discount-offer-btn">
                            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}Предложить
                          </Button>
                          <Button onClick={() => handleRejectRequest(selectedRequest.id)} disabled={processing} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" data-testid="account-discount-reject-btn">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      )
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Tag className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-zinc-700' : 'text-slate-300'}`} />
                    <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Выберите запрос для просмотра</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Product Requests Tab */}
        {activeTab === 'products' && (
          <div className="glass-card overflow-hidden flex h-[calc(100vh-240px)] min-h-[500px]" data-testid="product-requests-panel">
            {/* Requests List */}
            <div className={`w-96 flex-shrink-0 border-r ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex flex-col overflow-y-auto`}>
              {productRequests.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Нет запросов</p>
                </div>
              ) : (
                productRequests.map(req => (
                  <div
                    key={req.id}
                    onClick={() => { setSelectedProductReq(req); setProductReqResponse(req.admin_response || ''); setOfferPrice(req.offer_price != null ? String(req.offer_price) : ''); setOfferQty(req.offer_quantity != null ? String(req.offer_quantity) : ''); setOfferDelivery(req.offer_delivery_days != null ? String(req.offer_delivery_days) : ''); }}
                    className={`p-4 border-b cursor-pointer transition-colors ${
                      selectedProductReq?.id === req.id
                        ? isDark ? 'bg-zinc-800' : 'bg-blue-50'
                        : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-slate-50'
                    } ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}
                    data-testid={`product-request-${req.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-zinc-700' : 'bg-blue-100'}`}>
                        <Package className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>
                          {req.user_name || req.user_email}
                        </p>
                        <p className={`text-xs font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                          {req.article}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>
                          Кол-во: {req.quantity} {req.product_name ? `· ${req.product_name.substring(0, 25)}...` : ''}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        req.status === 'completed' ? 'bg-green-100 text-green-700' :
                        req.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        req.status === 'offered' ? 'bg-teal-100 text-teal-700' :
                        req.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {req.status === 'pending' ? 'На рассмотрении' : req.status === 'completed' ? 'Выполнен' : req.status === 'processing' ? 'В обработке' : req.status === 'offered' ? 'Предложение' : req.status === 'accepted' ? 'Принято' : req.status === 'rejected_by_client' ? 'Отклонён клиентом' : 'Отклонён'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Request Detail */}
            <div className="flex-1 flex flex-col">
              {selectedProductReq ? (
                <>
                  <div className={`p-5 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-100'}`}>
                        <Package className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <h3 className={`font-bold font-mono text-lg ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{selectedProductReq.article}</h3>
                        {selectedProductReq.product_name && (
                          <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{selectedProductReq.product_name}</p>
                        )}
                        <p className={`text-sm font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                          Количество: {selectedProductReq.quantity} шт.
                        </p>
                      </div>
                    </div>
                    <div className={`mt-3 flex items-center gap-3 text-sm ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                      <User className="w-4 h-4" />
                      <span>{selectedProductReq.user_name} ({selectedProductReq.user_email})</span>
                      <Clock className="w-4 h-4 ml-2" />
                      <span>{new Date(selectedProductReq.created_at).toLocaleString('ru-RU')}</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {selectedProductReq.comment && (
                      <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-slate-50 border border-slate-200'}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Комментарий клиента</p>
                        <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{selectedProductReq.comment}</p>
                      </div>
                    )}

                    {(selectedProductReq.status === 'completed' || selectedProductReq.status === 'rejected') && (
                      <div className={`p-4 rounded-xl ${
                        selectedProductReq.status === 'completed'
                          ? isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'
                          : isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'
                      }`}>
                        <p className={`text-sm font-bold ${
                          selectedProductReq.status === 'completed' ? isDark ? 'text-green-400' : 'text-green-700'
                          : isDark ? 'text-red-400' : 'text-red-700'
                        }`}>
                          {selectedProductReq.status === 'completed' ? 'Запрос выполнен' : 'Запрос отклонён'}
                        </p>
                        {selectedProductReq.admin_response && (
                          <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>{selectedProductReq.admin_response}</p>
                        )}
                      </div>
                    )}

                    {(selectedProductReq.offer_price != null && ['offered', 'accepted', 'rejected_by_client'].includes(selectedProductReq.status)) && (
                      <div className={`p-4 rounded-xl ${
                        selectedProductReq.status === 'accepted'
                          ? isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'
                          : selectedProductReq.status === 'rejected_by_client'
                          ? isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'
                          : isDark ? 'bg-teal-500/10 border border-teal-500/30' : 'bg-teal-50 border border-teal-200'
                      }`} data-testid="admin-offer-summary">
                        <p className={`text-sm font-bold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                          {selectedProductReq.status === 'accepted' ? '✅ Клиент принял предложение' : selectedProductReq.status === 'rejected_by_client' ? '❌ Клиент отклонил предложение' : '⏳ Предложение отправлено, ждём решения клиента'}
                        </p>
                        <div className={`text-sm mt-2 flex flex-wrap gap-x-4 gap-y-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                          <span>Цена: <b>{new Intl.NumberFormat('ru-RU').format(Math.round(selectedProductReq.offer_price))} ₽/шт</b></span>
                          {selectedProductReq.offer_quantity != null && <span>Кол-во: <b>{selectedProductReq.offer_quantity} шт</b></span>}
                          {selectedProductReq.offer_delivery_days != null && <span>Срок: <b>{selectedProductReq.offer_delivery_days} дн.</b></span>}
                        </div>
                        {selectedProductReq.admin_response && (
                          <p className={`text-sm mt-1 italic ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>«{selectedProductReq.admin_response}»</p>
                        )}
                        {selectedProductReq.client_reject_reason && (
                          <p className={`text-sm mt-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>Причина отказа: {selectedProductReq.client_reject_reason}</p>
                        )}
                      </div>
                    )}

                    {(selectedProductReq.status === 'pending' || selectedProductReq.status === 'processing' || selectedProductReq.status === 'offered') && (
                      <div className={`p-4 rounded-xl space-y-3 ${isDark ? 'bg-zinc-800/30 border border-zinc-700/50' : 'bg-white border border-slate-200'}`}>
                        {selectedProductReq.status === 'processing' && (
                          <p className={`text-xs font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Запрос в обработке</p>
                        )}
                        {selectedProductReq.status === 'offered' && (
                          <p className={`text-xs font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Можно изменить предложение</p>
                        )}
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Ваш ответ / сообщение</p>
                        <Textarea
                          value={productReqResponse}
                          onChange={(e) => setProductReqResponse(e.target.value)}
                          placeholder="Напишите ответ клиенту..."
                          className={`min-h-[60px] ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : ''}`}
                          data-testid="product-req-response-input"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Цена ₽/шт</label>
                            <input type="number" min="0" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="0"
                              className={`w-full h-9 px-2 rounded-md border text-sm ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'border-slate-200'}`} data-testid="offer-price-input" />
                          </div>
                          <div>
                            <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Кол-во</label>
                            <input type="number" min="0" value={offerQty} onChange={(e) => setOfferQty(e.target.value)} placeholder={String(selectedProductReq.quantity || '')}
                              className={`w-full h-9 px-2 rounded-md border text-sm ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'border-slate-200'}`} data-testid="offer-qty-input" />
                          </div>
                          <div>
                            <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Срок, дн.</label>
                            <input type="number" min="0" value={offerDelivery} onChange={(e) => setOfferDelivery(e.target.value)} placeholder="—"
                              className={`w-full h-9 px-2 rounded-md border text-sm ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'border-slate-200'}`} data-testid="offer-delivery-input" />
                          </div>
                        </div>
                        <Button
                          onClick={() => handleSendOffer(selectedProductReq.id)}
                          disabled={processing || !offerPrice}
                          className="w-full bg-teal-500 hover:bg-teal-600 text-white"
                          data-testid="send-offer-btn"
                        >
                          {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Tag className="w-4 h-4 mr-2" />}
                          {selectedProductReq.status === 'offered' ? 'Обновить предложение' : 'Отправить предложение'}
                        </Button>
                        <div className="flex gap-2">
                          {selectedProductReq.status === 'pending' && (
                            <Button
                              onClick={() => handleRespondProductReq(selectedProductReq.id, 'processing')}
                              disabled={processing}
                              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                              data-testid="processing-product-req-btn"
                            >
                              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                              В обработку
                            </Button>
                          )}
                          <Button
                            onClick={() => handleRespondProductReq(selectedProductReq.id, 'completed')}
                            disabled={processing || !productReqResponse.trim()}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                            data-testid="complete-product-req-btn"
                          >
                            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            Выполнен
                          </Button>
                          <Button
                            onClick={() => handleRespondProductReq(selectedProductReq.id, 'rejected')}
                            disabled={processing || !productReqResponse.trim()}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            data-testid="reject-product-req-btn"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Package className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-zinc-700' : 'text-slate-300'}`} />
                    <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Выберите запрос для просмотра</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cart Discount Requests Tab */}
        {activeTab === 'cart-discounts' && (
          <div className="glass-card overflow-hidden p-4 md:p-6 min-h-[500px]" data-testid="cart-discounts-panel">
            {cartDiscountRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShoppingCart className={`w-12 h-12 mb-3 ${isDark ? 'text-zinc-700' : 'text-slate-300'}`} />
                <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Запросов скидки на корзину пока нет</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cartDiscountRequests.map(req => {
                  const st = req.status;
                  const badge = st === 'pending' ? { t: 'На рассмотрении', c: 'bg-amber-100 text-amber-700' }
                    : st === 'approved' ? { t: `Одобрено ${req.admin_percent}%`, c: 'bg-emerald-100 text-emerald-700' }
                    : st === 'used' ? { t: `Использовано ${req.admin_percent}%`, c: 'bg-slate-100 text-slate-500' }
                    : st === 'rejected' ? { t: 'Отклонено', c: 'bg-rose-100 text-rose-700' }
                    : st === 'superseded' ? { t: 'Заменено', c: 'bg-slate-100 text-slate-400' }
                    : { t: 'Отменено клиентом', c: 'bg-slate-100 text-slate-400' };
                  return (
                    <div key={req.id} className={`rounded-xl border p-4 ${isDark ? 'bg-zinc-800/40 border-zinc-700' : 'bg-white border-slate-200'}`} data-testid={`cart-discount-req-${req.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{req.user_name || req.user_email}</p>
                          <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{req.user_email}</p>
                          <p className={`text-sm mt-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Желаемая скидка: <b className="text-teal-600">{req.requested_percent}%</b></p>
                          {req.message && <p className={`text-xs mt-1 italic ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>«{req.message}»</p>}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.c}`}>{badge.t}</span>
                      </div>
                      {st === 'pending' && (
                        <div className="flex flex-wrap items-end gap-2 mt-3">
                          <div>
                            <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Ваш процент, %</label>
                            <input
                              type="number" min="1" max="90"
                              value={cartApproveInputs[req.id] ?? req.requested_percent}
                              onChange={(e) => setCartApproveInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className={`w-24 h-9 px-2 rounded-md border text-sm block mt-1 ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'border-slate-200'}`}
                              data-testid={`cart-discount-approve-input-${req.id}`}
                            />
                          </div>
                          <Button onClick={() => approveCartDiscount(req.id)} disabled={processing} className="bg-emerald-500 hover:bg-emerald-600 text-white h-9" data-testid={`cart-discount-approve-${req.id}`}>
                            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}Одобрить
                          </Button>
                          <Button onClick={() => rejectCartDiscount(req.id)} disabled={processing} variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50 h-9" data-testid={`cart-discount-reject-${req.id}`}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Chats Tab */}
        {activeTab === 'chats' && (
        <div className={`glass-card overflow-hidden flex h-[calc(100vh-240px)] min-h-[500px]`}>
          {/* Chats List */}
          <div className={`w-80 flex-shrink-0 border-r ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex flex-col`}>
            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
                <Input
                  placeholder="Поиск чатов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-input"
                />
              </div>
            </div>
            
            {/* Chats */}
            <div className="flex-1 overflow-y-auto">
              {filteredChats.length === 0 ? (
                <div className={`text-center py-12 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Чатов нет</p>
                </div>
              ) : (
                filteredChats.map(chat => (
                  <motion.button
                    key={chat.id}
                    onClick={() => selectChat(chat)}
                    className={`w-full p-4 flex items-center gap-3 transition-colors text-left ${
                      selectedChat?.id === chat.id 
                        ? isDark ? 'bg-orange-500/10 border-l-2 border-orange-500' : 'bg-teal-500/10 border-l-2 border-teal-500'
                        : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-white/50'
                    }`}
                    whileHover={{ x: 2 }}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                      <User className={`w-5 h-5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {chat.pinned && <Pin className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-orange-400' : 'text-teal-500'}`} />}
                          <span className={`font-medium truncate ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                            {chat.user_name || 'Без имени'}
                          </span>
                          {chat.labels?.map(l => {
                            const labelDef = LABELS.find(lb => lb.value === l);
                            return labelDef ? (
                              <span key={l} className={`w-2 h-2 rounded-full flex-shrink-0 ${labelDef.color}`} title={labelDef.label} />
                            ) : null;
                          })}
                        </div>
                        {chat.unread_count > 0 && (
                          <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                        {chat.last_message || 'Нет сообщений'}
                      </p>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className={`p-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                      <User className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-teal-600'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                          {selectedChat.user_name || 'Без имени'}
                        </h3>
                        {selectedChat.pinned && (
                          <Pin className={`w-3 h-3 ${isDark ? 'text-orange-400' : 'text-teal-500'}`} />
                        )}
                        {selectedChat.labels?.map(l => {
                          const labelDef = LABELS.find(lb => lb.value === l);
                          return labelDef ? (
                            <span key={l} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${labelDef.color}`}>
                              {labelDef.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                        {selectedChat.user_email}
                      </p>
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePin(selectedChat.id)}
                      title={selectedChat.pinned ? 'Открепить' : 'Закрепить'}
                      className={selectedChat.pinned ? (isDark ? 'text-orange-400' : 'text-teal-500') : (isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-400 hover:text-slate-600')}
                      data-testid="chat-pin-btn"
                    >
                      <Pin className="w-4 h-4" />
                    </Button>
                    {/* Label dropdown */}
                    <div className="relative group">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-400 hover:text-slate-600'}
                        data-testid="chat-label-btn"
                      >
                        <Tag className="w-4 h-4" />
                      </Button>
                      <div className={`absolute right-0 top-full mt-1 w-36 rounded-lg shadow-xl border z-50 hidden group-hover:block ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'}`}>
                        {LABELS.map(l => (
                          <button
                            key={l.value}
                            onClick={() => updateLabel(selectedChat.id, l.value)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-50 text-slate-700'}`}
                            data-testid={`chat-label-${l.value || 'none'}`}
                          >
                            {l.color && <span className={`w-2 h-2 rounded-full ${l.color}`} />}
                            {l.label}
                            {selectedChat.labels?.includes(l.value) && <Check className="w-3 h-3 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteChat(selectedChat.id)}
                      className="text-red-400 hover:text-red-500"
                      data-testid="chat-delete-btn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, index) => {
                    const isAdmin = msg.sender_type === 'admin';
                    const showDate = index === 0 || 
                      formatDate(messages[index - 1].created_at) !== formatDate(msg.created_at);
                    
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="text-center my-4">
                            <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-slate-100 text-slate-400'}`}>
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${
                            isAdmin 
                              ? isDark ? 'bg-orange-500/20 text-orange-100' : 'bg-teal-500/20 text-green-900'
                              : isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-white text-slate-700'
                          } rounded-2xl px-4 py-2 shadow-sm`}>
                            {msg.message_type === 'image' ? (
                              <img 
                                src={msg.file_url || msg.text} 
                                alt="" 
                                className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setLightboxImage(msg.file_url || msg.text)}
                              />
                            ) : msg.message_type === 'video' ? (
                              <div 
                                className="relative cursor-pointer group"
                                onClick={() => setLightboxVideo(msg.file_url || msg.text)}
                              >
                                <video src={msg.file_url || msg.text} className="max-w-full rounded-lg" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg group-hover:bg-black/40 transition-colors">
                                  <Play className="w-12 h-12 text-white" />
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                            )}
                            <div className={`flex items-center gap-1 justify-end mt-1`}>
                              <span className={`text-xs ${
                                isAdmin 
                                  ? isDark ? 'text-orange-300/60' : 'text-teal-600/60'
                                  : isDark ? 'text-zinc-500' : 'text-slate-400'
                              }`}>{formatTime(msg.created_at)}</span>
                              {isAdmin && (
                                msg.read 
                                  ? <CheckCheck className="w-3 h-3 text-blue-500" />
                                  : <Check className="w-3 h-3 text-zinc-400" />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*,video/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                      className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-700'}
                    >
                      <Paperclip className="w-5 h-5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={generateAiDraft}
                      disabled={sending || aiDrafting}
                      title="Черновик ответа от ИИ — вы сможете отредактировать его перед отправкой"
                      className={isDark ? 'text-orange-400 hover:text-orange-300' : 'text-teal-600 hover:text-teal-700'}
                      data-testid="ai-draft-btn"
                    >
                      {aiDrafting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-xs font-bold">ИИ</span>}
                    </Button>
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      data-testid="admin-chat-input"
                      placeholder="Напишите сообщение..."
                      className="flex-1 glass-input"
                      disabled={sending}
                    />
                    <Button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className={`${isDark ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Выберите чат для просмотра сообщений</p>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />}
      {lightboxVideo && <VideoLightbox src={lightboxVideo} onClose={() => setLightboxVideo(null)} />}
    </div>
  );
}
