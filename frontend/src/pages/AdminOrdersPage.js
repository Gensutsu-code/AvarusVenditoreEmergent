import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, Search, Eye, Pencil, Trash2, Save, X, 
  Clock, CheckCircle, Truck, XCircle, ChevronDown,
  User, Phone, MapPin, Calendar, CreditCard, RefreshCw,
  AlertTriangle, Check, RotateCcw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ORDER_STATUSES = [
  { value: 'pending', label: 'Ожидает', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  { value: 'processing', label: 'Обработка', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Package },
  { value: 'completed', label: 'Выполнен', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  { value: 'cancelled', label: 'Отменён', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle }
];

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
        items: editData.items
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

  const calculateTotal = (items) => items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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
                    className={`bg-white/80 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden transition-shadow ${isEditing ? 'border-teal-400 shadow-lg shadow-teal-500/10' : 'border-slate-200/50 hover:shadow-md'}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    {/* Order Header */}
                    <div className={`p-4 cursor-pointer transition-colors ${isEditing ? 'bg-teal-50/50' : 'hover:bg-slate-50/50'}`} onClick={() => toggleExpand(order.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
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
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{order.customer_name || order.full_name}{order.customer_email ? ` (${order.customer_email})` : ''}</span>
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(order.created_at)}</span>
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
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2" data-testid={`order-status-actions-${order.id}`}>
                                  {order.status === 'pending' && (
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
                                  <Button variant="outline" size="sm" onClick={() => handleRollbackStatus(order.id)} className="rounded-xl text-amber-500 border-amber-200 hover:bg-amber-50" data-testid={`rollback-order-${order.id}`} title="Откатить статус">
                                    <RotateCcw className="w-4 h-4 mr-1" /> Откатить
                                  </Button>
                                  {order.status !== 'cancelled' && order.status !== 'completed' && (
                                    <Button variant="outline" size="sm" onClick={() => startEditing(order)} className="rounded-xl border-teal-200 text-teal-600 hover:bg-teal-50">
                                      <Pencil className="w-4 h-4 mr-1" /> Редактировать
                                    </Button>
                                  )}
                                  <Button variant="outline" size="sm" className="rounded-xl text-rose-500 border-rose-200 hover:bg-rose-50" onClick={() => handleDeleteOrder(order.id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
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
    </div>
  );
}
