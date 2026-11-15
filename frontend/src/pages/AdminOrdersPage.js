import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, Search, Eye, Pencil, Trash2, Save, X, 
  Clock, CheckCircle, Truck, XCircle, ChevronDown,
  User, Phone, MapPin, Calendar, CreditCard, RefreshCw,
  AlertTriangle, Check, RotateCcw, Plus, GitMerge, PackageCheck, CircleDashed, Gift, FileSpreadsheet
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import AdminCardPayment from '../components/AdminCardPayment';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ORDER_STATUSES = [
  { value: 'pending', label: 'Ожидает', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  { value: 'processing', label: 'Обработка', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Package },
  { value: 'partially_fulfilled', label: 'Частично выполнен', color: 'bg-violet-100 text-violet-700 border-violet-200', icon: CircleDashed },
  { value: 'completed', label: 'Выполнен', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  { value: 'cancelled', label: 'Отменён', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle }
];

const MERGEABLE_STATUSES = new Set(['pending', 'processing', 'partially_fulfilled']);

export default function AdminOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editData, setEditData] = useState({});
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  // Selection + merge state
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [merging, setMerging] = useState(false);
  // Partial fulfillment state
  const [fulfillModal, setFulfillModal] = useState(null); // { order, draft: [{product_id, name, quantity, quantity_fulfilled, price}] }
  const [fulfilling, setFulfilling] = useState(false);

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
    fetchOrders();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/admin/orders`);
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price);
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusInfo = (status) => ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await axios.put(`${API}/admin/orders/${orderId}`, { status: newStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success('Статус обновлён');
    } catch (err) {
      toast.error('Ошибка обновления статуса');
    }
  };

  const toggleOzonCertificate = async (order) => {
    const next = !order.ozon_certificate_issued;
    try {
      await axios.patch(`${API}/admin/orders/${order.id}/ozon-certificate`, { issued: next });
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ozon_certificate_issued: next } : o));
      toast.success(next ? 'Сертификат Ozon отмечен как выданный' : 'Отметка о выдаче снята');
    } catch (err) {
      toast.error('Не удалось обновить статус сертификата');
    }
  };

  const downloadReturnDoc = async (orderId) => {
    try {
      const res = await axios.get(`${API}/admin/orders/${orderId}/return-document`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Акт_возврата_${orderId.slice(0, 8)}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Ошибка скачивания документа на возврат');
    }
  };

  const downloadInvoice = async (orderId) => {
    try {
      const res = await axios.get(`${API}/admin/orders/${orderId}/invoice`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Счет_${orderId.slice(0, 8)}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Ошибка скачивания счёта');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Удалить заказ? Это действие нельзя отменить.')) return;
    try {
      await axios.delete(`${API}/admin/orders/${orderId}`);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast.success('Заказ удалён');
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const handleRollbackStatus = async (orderId) => {
    try {
      const res = await axios.put(`${API}/admin/orders/${orderId}/rollback-status`);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: res.data.status, previous_status: res.data.previous_status } : o));
      toast.success(`Статус откачен на: ${ORDER_STATUSES.find(s => s.value === res.data.status)?.label || res.data.status}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Нет предыдущего статуса для отката');
    }
  };

  const startEditing = (order) => {
    setEditingOrderId(order.id);
    setEditData({
      full_name: order.full_name || '',
      phone: order.phone || '',
      address: order.address || '',
      comment: order.comment || '',
      status: order.status,
      created_at: order.created_at || '',
      items: order.items?.map(item => ({ ...item })) || []
    });
    setExpandedOrders(prev => ({ ...prev, [order.id]: true }));
  };

  const cancelEditing = () => {
    setEditingOrderId(null);
    setEditData({});
  };

  const handleSaveOrder = async (orderId) => {
    try {
      const res = await axios.put(`${API}/admin/orders/${orderId}`, {
        status: editData.status,
        full_name: editData.full_name,
        address: editData.address,
        phone: editData.phone,
        comment: editData.comment,
        items: editData.items,
        created_at: editData.created_at
      });
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
      setEditingOrderId(null);
      setEditData({});
      toast.success('Заказ сохранён');
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...editData.items];
    newItems[index] = { ...newItems[index], [field]: field === 'price' || field === 'quantity' ? Number(value) : value };
    setEditData({ ...editData, items: newItems });
  };

  const handleRemoveItem = (index) => {
    const newItems = editData.items.filter((_, i) => i !== index);
    setEditData({ ...editData, items: newItems });
  };

  const handleSearchProducts = async (query) => {
    setProductSearch(query);
    if (query.length < 2) { setProductResults([]); return; }
    setSearchingProducts(true);
    try {
      const res = await axios.get(`${API}/products?search=${encodeURIComponent(query)}&limit=5`);
      const products = res.data.products || res.data || [];
      setProductResults(products);
    } catch { setProductResults([]); }
    setSearchingProducts(false);
  };

  const handleAddProduct = (product) => {
    const newItem = {
      product_id: product.id,
      name: product.name,
      article: product.article || '',
      price: product.price,
      quantity: 1,
      image_url: product.image_url || ''
    };
    setEditData({ ...editData, items: [...editData.items, newItem] });
    setProductSearch('');
    setProductResults([]);
    toast.success(`${product.name} добавлен`);
  };

  const calculateTotal = (items) => items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // ─── Selection + Merge ────────────────────────────────────────────────────
  const toggleSelect = (orderId, e) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Selected orders that are mergeable + share the same user
  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const selectedUserIds = new Set(selectedOrders.map((o) => o.user_id));
  const allMergeable = selectedOrders.every((o) => MERGEABLE_STATUSES.has(o.status));
  const sameUser = selectedUserIds.size === 1;
  const canMerge = selectedOrders.length >= 2 && sameUser && allMergeable;

  const handleMerge = async () => {
    if (!canMerge || merging) return;
    if (!window.confirm(`Объединить ${selectedOrders.length} заказов в один? Исходные заказы будут удалены.`)) return;
    setMerging(true);
    try {
      const res = await axios.post(`${API}/admin/orders/merge`, {
        order_ids: Array.from(selectedIds),
      });
      toast.success(`Заказы объединены → #${res.data.order.id.slice(0, 8)}`);
      clearSelection();
      await fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Не удалось объединить заказы');
    } finally {
      setMerging(false);
    }
  };

  // ─── Partial Fulfillment ──────────────────────────────────────────────────
  const openFulfillModal = (order) => {
    const draft = (order.items || []).map((it) => ({
      product_id: it.product_id,
      name: it.name,
      article: it.article,
      image_url: it.image_url,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 0,
      quantity_fulfilled: Number(it.quantity_fulfilled) || 0,
    }));
    setFulfillModal({ order, draft });
  };

  const updateFulfillQty = (idx, value) => {
    const v = Math.max(0, Math.min(Number(value) || 0, fulfillModal.draft[idx].quantity));
    setFulfillModal((prev) => {
      if (!prev) return prev;
      const next = prev.draft.slice();
      next[idx] = { ...next[idx], quantity_fulfilled: v };
      return { ...prev, draft: next };
    });
  };

  const fulfillAllItems = () => {
    setFulfillModal((prev) => {
      if (!prev) return prev;
      return { ...prev, draft: prev.draft.map((it) => ({ ...it, quantity_fulfilled: it.quantity })) };
    });
  };

  const fulfilledTotal = fulfillModal
    ? fulfillModal.draft.reduce((s, it) => s + it.price * it.quantity_fulfilled, 0)
    : 0;
  const orderTotal = fulfillModal
    ? fulfillModal.draft.reduce((s, it) => s + it.price * it.quantity, 0)
    : 0;

  const handleFulfill = async () => {
    if (!fulfillModal || fulfilling) return;
    setFulfilling(true);
    try {
      const payload = {
        items: fulfillModal.draft.map((it) => ({
          product_id: it.product_id,
          quantity_fulfilled: it.quantity_fulfilled,
        })),
      };
      const res = await axios.patch(
        `${API}/admin/orders/${fulfillModal.order.id}/fulfill`,
        payload
      );
      toast.success(
        res.data.status === 'completed'
          ? 'Заказ полностью выполнен'
          : `Частичная отгрузка сохранена (${formatPrice(res.data.fulfilled_total)} ₽)`
      );
      setFulfillModal(null);
      await fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Не удалось сохранить отгрузку');
    } finally {
      setFulfilling(false);
    }
  };

  const toggleExpand = (orderId) => {
    if (editingOrderId === orderId) return;
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.phone?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    completed: orders.filter(o => o.status === 'completed').length,
    totalRevenue: orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total, 0)
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 flex items-center justify-center">
        <motion.div className="flex flex-col items-center gap-3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500">Загрузка заказов...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20" data-testid="admin-orders-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div className="flex items-center justify-between mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Управление заказами
              </h1>
              <p className="text-sm text-slate-500">Всего {orders.length} заказов</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOrders} className="border-teal-200 text-teal-600 hover:bg-teal-50 hover:border-teal-300 rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Package className="w-5 h-5 text-slate-600" /></div>
              <div>
                <p className="text-slate-500 text-xs uppercase font-medium">Всего</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-amber-50/80 backdrop-blur-sm rounded-2xl border border-amber-200/50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-amber-600 text-xs uppercase font-medium">Ожидают</p>
                <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50/80 backdrop-blur-sm rounded-2xl border border-blue-200/50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Package className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-blue-600 text-xs uppercase font-medium">В обработке</p>
                <p className="text-2xl font-bold text-blue-700">{stats.processing}</p>
              </div>
            </div>
          </div>
          <div className="bg-emerald-50/80 backdrop-blur-sm rounded-2xl border border-emerald-200/50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-emerald-600 text-xs uppercase font-medium">Доставлено</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.completed}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 backdrop-blur-sm rounded-2xl border border-teal-200/50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center"><CreditCard className="w-5 h-5 text-white" /></div>
              <div>
                <p className="text-teal-600 text-xs uppercase font-medium">Выручка</p>
                <p className="text-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">{formatPrice(stats.totalRevenue)} ₽</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="p-4 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Поиск по номеру, имени, телефону..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl border-slate-200 focus:border-teal-400" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')} className={`rounded-xl ${statusFilter === 'all' ? 'bg-gradient-to-r from-teal-500 to-emerald-500 border-0' : 'border-slate-200'}`}>
                Все
              </Button>
              {ORDER_STATUSES.map(status => (
                <Button key={status.value} variant={statusFilter === status.value ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(status.value)} className={`rounded-xl ${statusFilter === status.value ? status.color : 'border-slate-200'}`}>
                  {status.label}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Orders List */}
        <div className="space-y-4">
          <AnimatePresence>
            {filteredOrders.length === 0 ? (
              <motion.div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-12 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500">Заказы не найдены</p>
              </motion.div>
            ) : (
              filteredOrders.map((order, index) => {
                const statusInfo = getStatusInfo(order.status);
                const StatusIcon = statusInfo.icon;
                const isExpanded = expandedOrders[order.id];
                const isEditing = editingOrderId === order.id;
                const currentItems = isEditing ? editData.items : order.items;
                const currentTotal = isEditing ? calculateTotal(editData.items) : order.total;
                
                return (
                  <motion.div 
                    key={order.id} 
                    className={`bg-white/80 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden transition-shadow ${isEditing ? 'border-teal-400 shadow-lg shadow-teal-500/10' : selectedIds.has(order.id) ? 'border-teal-500 ring-2 ring-teal-300/60 shadow-md' : 'border-slate-200/50 hover:shadow-md'}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    {/* Order Header */}
                    <div className={`p-4 cursor-pointer transition-colors ${isEditing ? 'bg-teal-50/50' : 'hover:bg-slate-50/50'}`} onClick={() => toggleExpand(order.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Selection checkbox — only for mergeable statuses */}
                          {MERGEABLE_STATUSES.has(order.status) && !isEditing && (
                            <button
                              type="button"
                              onClick={(e) => toggleSelect(order.id, e)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${selectedIds.has(order.id) ? 'bg-teal-500 border-teal-500' : 'bg-white border-slate-300 hover:border-teal-400'}`}
                              data-testid={`select-order-${order.id}`}
                              aria-label="Выбрать для объединения"
                              title="Выбрать для объединения"
                            >
                              {selectedIds.has(order.id) && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                            </button>
                          )}
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${statusInfo.color}`}>
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-800">#{order.id?.slice(0, 8)}</span>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${statusInfo.color}`}>{statusInfo.label}</span>
                              {order.awaiting_confirmation && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Ожидает подтверждения
                                </span>
                              )}
                              {order.ozon_certificate > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleOzonCertificate(order); }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors ${order.ozon_certificate_issued ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'}`}
                                  data-testid={`ozon-cert-badge-${order.id}`}
                                  title={order.ozon_certificate_issued ? 'Сертификат выдан (нажмите чтобы отменить)' : 'Нажмите, когда выдадите сертификат'}
                                >
                                  <Gift className="w-3 h-3" />
                                  {order.ozon_certificate_issued ? `Серт. Ozon выдан: ${formatPrice(order.ozon_certificate)} ₽` : `Выдать серт. Ozon: ${formatPrice(order.ozon_certificate)} ₽`}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{order.customer_name || order.full_name}{order.customer_email ? ` (${order.customer_email})` : ''}</span>
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(order.created_at)}</span>
                              {order.manager_name && <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-semibold" data-testid={`order-manager-${order.id}`}>Менеджер: {order.manager_name}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-lg text-slate-800">{formatPrice(currentTotal)} ₽</p>
                            <p className="text-xs text-slate-400">{currentItems?.length || 0} товаров</p>
                          </div>
                          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          </motion.div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          className="border-t border-slate-200/50"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Customer Info */}
                          <div className="p-4 bg-gradient-to-r from-slate-50 to-teal-50/30">
                            {isEditing ? (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-xs font-bold uppercase text-teal-600 mb-1 block">Получатель</label>
                                  <Input value={editData.full_name} onChange={(e) => setEditData({...editData, full_name: e.target.value})} className="rounded-lg border-slate-200" />
                                </div>
                                <div>
                                  <label className="text-xs font-bold uppercase text-teal-600 mb-1 block">Телефон</label>
                                  <Input value={editData.phone} onChange={(e) => setEditData({...editData, phone: e.target.value})} className="rounded-lg border-slate-200" />
                                </div>
                                <div>
                                  <label className="text-xs font-bold uppercase text-teal-600 mb-1 block">Адрес</label>
                                  <Input value={editData.address} onChange={(e) => setEditData({...editData, address: e.target.value})} className="rounded-lg border-slate-200" />
                                </div>
                                <div>
                                  <label className="text-xs font-bold uppercase text-teal-600 mb-1 block">Дата и время заказа</label>
                                  <Input 
                                    type="datetime-local" 
                                    value={editData.created_at ? editData.created_at.slice(0, 16) : ''} 
                                    onChange={(e) => setEditData({...editData, created_at: e.target.value ? e.target.value + ':00' : editData.created_at})} 
                                    className="rounded-lg border-slate-200"
                                    data-testid="order-date-input"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center"><User className="w-4 h-4 text-teal-500" /></div>
                                  <span className="text-sm text-slate-700">{order.full_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center"><Phone className="w-4 h-4 text-teal-500" /></div>
                                  <span className="text-sm text-slate-700">{order.phone}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center"><MapPin className="w-4 h-4 text-teal-500" /></div>
                                  <span className="text-sm truncate max-w-xs text-slate-700">{order.address}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Items */}
                          <div className="p-4">
                            <p className="text-xs font-bold uppercase text-teal-600 mb-3">Товары</p>
                            <div className="space-y-2">
                              {currentItems?.map((item, idx) => (
                                <div key={idx} className={`flex items-center justify-between py-3 border-b border-slate-100 last:border-0 ${isEditing ? 'bg-slate-50 rounded-lg px-3 -mx-3' : ''}`}>
                                  <div className="flex items-center gap-3">
                                    {item.image_url && (
                                      <img src={item.image_url} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                                    )}
                                    <div>
                                      <p className="font-medium text-sm text-slate-800">{item.name}</p>
                                      <p className="text-xs text-slate-400">{item.article}</p>
                                    </div>
                                  </div>
                                  {isEditing ? (
                                    <div className="flex items-center gap-3">
                                      <div>
                                        <label className="text-xs text-slate-500">Цена</label>
                                        <Input type="number" value={item.price} onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)} className="w-24 h-8 text-sm rounded-lg" min={0} />
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-500">Кол-во</label>
                                        <Input type="number" value={item.quantity} onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)} className="w-20 h-8 text-sm rounded-lg" min={1} />
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-500">Сумма</label>
                                        <p className="h-8 flex items-center text-sm font-bold text-teal-600">{formatPrice(item.price * item.quantity)} ₽</p>
                                      </div>
                                      <button
                                        onClick={() => handleRemoveItem(idx)}
                                        className="mt-4 p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        title="Удалить товар"
                                        data-testid={`remove-item-${idx}`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="text-right">
                                      <p className="font-medium text-slate-700">{formatPrice(item.price)} ₽ × {item.quantity}</p>
                                      <p className="text-sm font-bold text-teal-600">{formatPrice(item.price * item.quantity)} ₽</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Add Product (only when editing) */}
                            {isEditing && (
                              <div className="mt-3 border-2 border-dashed border-teal-200 rounded-xl p-3" data-testid="add-product-section">
                                <label className="text-xs font-bold uppercase text-teal-600 mb-2 block">Добавить товар</label>
                                <div className="relative">
                                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                  <Input
                                    value={productSearch}
                                    onChange={(e) => handleSearchProducts(e.target.value)}
                                    placeholder="Поиск по названию или артикулу..."
                                    className="pl-9 rounded-lg border-slate-200"
                                    data-testid="add-product-search"
                                  />
                                  {productResults.length > 0 && (
                                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                      {productResults.map(p => (
                                        <button
                                          key={p.id}
                                          onClick={() => handleAddProduct(p)}
                                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-teal-50 transition-colors text-left"
                                          data-testid={`add-product-${p.id}`}
                                        >
                                          {p.image_url ? (
                                            <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                          ) : (
                                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center"><Package className="w-4 h-4 text-slate-400" /></div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                                            <p className="text-xs text-slate-400">{p.article} — {formatPrice(p.price)} ₽</p>
                                          </div>
                                          <Plus className="w-4 h-4 text-teal-500 flex-shrink-0" />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {searchingProducts && <p className="text-xs text-slate-400 mt-1">Поиск...</p>}
                                </div>
                              </div>
                            )}
                            
                            {/* Total */}
                            <div className="mt-4 p-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-teal-700">Итого:</span>
                                <span className="text-xl font-bold text-teal-700">{formatPrice(currentTotal)} ₽</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="p-4 bg-gradient-to-r from-slate-50 to-teal-50/30 border-t border-slate-200/50">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={cancelEditing} className="rounded-xl border-slate-200">
                                  <X className="w-4 h-4 mr-1" /> Отмена
                                </Button>
                                <Button size="sm" onClick={() => handleSaveOrder(order.id)} className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500">
                                  <Save className="w-4 h-4 mr-1" /> Сохранить
                                </Button>
                              </div>
                            ) : (
                              <>
                              <AdminCardPayment order={order} onUpdate={fetchOrders} />
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2" data-testid={`order-status-actions-${order.id}`}>                                  {order.status === 'pending' && (
                                    <Button size="sm" onClick={() => handleStatusChange(order.id, 'processing')} className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white" data-testid={`accept-order-${order.id}`}>
                                      <Check className="w-4 h-4 mr-1" /> Принять
                                    </Button>
                                  )}
                                  {order.status === 'processing' && (
                                    <Button size="sm" onClick={() => handleStatusChange(order.id, 'completed')} className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white" data-testid={`complete-order-${order.id}`}>
                                      <CheckCircle className="w-4 h-4 mr-1" /> Выполнен
                                    </Button>
                                  )}
                                  {order.status !== 'cancelled' && order.status !== 'completed' && (
                                    <Button variant="outline" size="sm" onClick={() => handleStatusChange(order.id, 'cancelled')} className="rounded-xl text-rose-500 border-rose-200 hover:bg-rose-50" data-testid={`cancel-order-${order.id}`}>
                                      <XCircle className="w-4 h-4 mr-1" /> Отменить
                                    </Button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {MERGEABLE_STATUSES.has(order.status) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); openFulfillModal(order); }}
                                      className="rounded-xl border-violet-200 text-violet-600 hover:bg-violet-50"
                                      data-testid={`fulfill-order-${order.id}`}
                                      title="Отгрузить (полностью или частично)"
                                    >
                                      <PackageCheck className="w-4 h-4 mr-1" /> Отгрузить
                                    </Button>
                                  )}
                                  {['completed', 'processing', 'cancelled', 'partially_fulfilled'].includes(order.status) && (
                                    <Button variant="outline" size="sm" onClick={() => handleRollbackStatus(order.id)} className="rounded-xl text-amber-500 border-amber-200 hover:bg-amber-50" data-testid={`rollback-order-${order.id}`} title="Откатить статус">
                                      <RotateCcw className="w-4 h-4 mr-1" /> Откатить
                                    </Button>
                                  )}
                                  {order.status !== 'cancelled' && order.status !== 'completed' && (
                                    <Button variant="outline" size="sm" onClick={() => startEditing(order)} className="rounded-xl border-teal-200 text-teal-600 hover:bg-teal-50">
                                      <Pencil className="w-4 h-4 mr-1" /> Редактировать
                                    </Button>
                                  )}
                                  <Button variant="outline" size="sm" onClick={() => downloadInvoice(order.id)} className="rounded-xl border-teal-200 text-teal-600 hover:bg-teal-50" data-testid="download-invoice-word" title="Скачать счёт в Word">
                                    <FileSpreadsheet className="w-4 h-4 mr-1" /> Счёт (Word)
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => downloadReturnDoc(order.id)} className="rounded-xl border-amber-200 text-amber-600 hover:bg-amber-50" data-testid={`download-return-doc-${order.id}`} title="Скачать акт возврата в Word для печати">
                                    <FileSpreadsheet className="w-4 h-4 mr-1" /> Документ на возврат
                                  </Button>
                                  <Button variant="outline" size="sm" className="rounded-xl text-rose-500 border-rose-200 hover:bg-rose-50" onClick={() => handleDeleteOrder(order.id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ───── Sticky bar: Merge selected orders ───── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            key="merge-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(640px,calc(100vw-2rem))]"
            data-testid="merge-bar"
          >
            <div className="bg-white border border-teal-200 rounded-2xl shadow-2xl shadow-teal-500/20 px-5 py-3 flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                  <GitMerge className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    Выбрано: {selectedIds.size}
                  </p>
                  <p className="text-xs truncate">
                    {!sameUser ? (
                      <span className="text-rose-500">Заказы разных клиентов — объединение недоступно</span>
                    ) : !allMergeable ? (
                      <span className="text-rose-500">Есть завершённые/отменённые — объединение недоступно</span>
                    ) : selectedIds.size < 2 ? (
                      <span className="text-slate-400">Выберите минимум 2 заказа одного клиента</span>
                    ) : (
                      <span className="text-slate-500">
                        Клиент: {selectedOrders[0]?.customer_name || selectedOrders[0]?.full_name || '—'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                className="rounded-xl border-slate-200 flex-shrink-0"
                data-testid="merge-clear-btn"
              >
                Сбросить
              </Button>
              <Button
                size="sm"
                onClick={handleMerge}
                disabled={!canMerge || merging}
                className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                data-testid="merge-orders-btn"
              >
                <GitMerge className="w-4 h-4 mr-1.5" />
                {merging ? 'Объединение…' : 'Объединить'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Fulfill Modal ───── */}
      <AnimatePresence>
        {fulfillModal && (
          <motion.div
            key="fulfill-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !fulfilling && setFulfillModal(null)}
            data-testid="fulfill-modal"
          >
            <motion.div
              initial={{ y: 30, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <PackageCheck className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Отгрузка заказа</h3>
                    <p className="text-xs text-slate-500">
                      #{fulfillModal.order.id.slice(0, 8)} • {fulfillModal.order.full_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !fulfilling && setFulfillModal(null)}
                  className="p-2 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-700 transition-colors"
                  data-testid="fulfill-close-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <p className="text-xs text-slate-500 mb-2">
                  Укажите количество фактически отгруженных позиций. Если все позиции отгружены полностью — заказ автоматически перейдёт в статус «Выполнен», иначе «Частично выполнен».
                </p>
                {fulfillModal.draft.map((it, idx) => {
                  const full = it.quantity_fulfilled === it.quantity;
                  return (
                    <div
                      key={`${it.product_id}-${idx}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${full ? 'border-emerald-200 bg-emerald-50/40' : it.quantity_fulfilled > 0 ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200 bg-slate-50/60'}`}
                      data-testid={`fulfill-item-${idx}`}
                    >
                      {it.image_url ? (
                        <img src={it.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{it.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{it.article}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Input
                          type="number"
                          min={0}
                          max={it.quantity}
                          value={it.quantity_fulfilled}
                          onChange={(e) => updateFulfillQty(idx, e.target.value)}
                          className="w-20 h-9 text-center rounded-lg border-slate-200"
                          data-testid={`fulfill-input-${idx}`}
                        />
                        <span className="text-sm text-slate-400 font-medium whitespace-nowrap">/ {it.quantity}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-slate-500">К оплате (отгружено)</p>
                    <p className="text-xl font-bold text-violet-600" data-testid="fulfill-total">
                      {formatPrice(fulfilledTotal)} ₽
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">из {formatPrice(orderTotal)} ₽</p>
                    <p className="text-xs text-slate-400">
                      {Math.round((fulfilledTotal / Math.max(orderTotal, 1)) * 100)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fulfillAllItems}
                    className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 flex-1"
                    data-testid="fulfill-all-btn"
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" /> Отгрузить всё
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => !fulfilling && setFulfillModal(null)}
                    className="rounded-xl border-slate-200"
                  >
                    Отмена
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleFulfill}
                    disabled={fulfilling}
                    className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50"
                    data-testid="fulfill-save-btn"
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    {fulfilling ? 'Сохранение…' : 'Сохранить'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
