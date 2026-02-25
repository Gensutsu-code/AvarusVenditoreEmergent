import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, Search, Filter, Eye, Pencil, Trash2, Save, X, 
  Clock, CheckCircle, Truck, XCircle, ChevronDown, ChevronUp,
  User, Phone, MapPin, Calendar, CreditCard, RefreshCw, Percent
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ORDER_STATUSES = [
  { value: 'pending', label: 'Ожидает', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  { value: 'processing', label: 'В обработке', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Package },
  { value: 'shipped', label: 'Отправлен', color: 'bg-violet-100 text-violet-700 border-violet-200', icon: Truck },
  { value: 'delivered', label: 'Доставлен', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  { value: 'cancelled', label: 'Отменён', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle }
];

export default function AdminOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewingOrder, setViewingOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});

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

  // Real-time polling for orders
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    
    const interval = setInterval(fetchOrders, 10000); // Poll every 10 seconds
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
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusInfo = (status) => {
    return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];
  };

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

  const handleSaveOrder = async () => {
    if (!editingOrder) return;
    
    try {
      const res = await axios.put(`${API}/admin/orders/${editingOrder.id}`, {
        status: editingOrder.status,
        full_name: editingOrder.full_name,
        address: editingOrder.address,
        phone: editingOrder.phone,
        comment: editingOrder.comment,
        created_at: editingOrder.created_at,
        items: editingOrder.items,
        order_discount_percent: editingOrder.order_discount_percent || 0
      });
      setOrders(prev => prev.map(o => o.id === editingOrder.id ? res.data : o));
      setEditingOrder(null);
      toast.success('Заказ обновлён');
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleUpdateOrderItem = (index, field, value) => {
    const newItems = [...editingOrder.items];
    newItems[index] = { ...newItems[index], [field]: field === 'price' || field === 'quantity' || field === 'discount_percent' ? Number(value) : value };
    setEditingOrder({ ...editingOrder, items: newItems });
  };

  const calculateOrderTotal = (items, orderDiscount = 0) => {
    const itemsTotal = items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const itemDiscount = item.discount_percent || 0;
      return sum + (itemTotal * (1 - itemDiscount / 100));
    }, 0);
    return itemsTotal * (1 - orderDiscount / 100);
  };

  const toggleExpand = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone?.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    totalRevenue: orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0)
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 flex items-center justify-center">
        <motion.div 
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
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
        <motion.div 
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchOrders}
            className="border-teal-200 text-teal-600 hover:bg-teal-50 hover:border-teal-300 rounded-xl"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase font-medium">Всего</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-amber-50/80 backdrop-blur-sm rounded-2xl border border-amber-200/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-amber-600 text-xs uppercase font-medium">Ожидают</p>
                <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50/80 backdrop-blur-sm rounded-2xl border border-blue-200/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-blue-600 text-xs uppercase font-medium">В обработке</p>
                <p className="text-2xl font-bold text-blue-700">{stats.processing}</p>
              </div>
            </div>
          </div>
          <div className="bg-emerald-50/80 backdrop-blur-sm rounded-2xl border border-emerald-200/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-emerald-600 text-xs uppercase font-medium">Доставлено</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.delivered}</p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 backdrop-blur-sm rounded-2xl border border-teal-200/50 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-teal-600 text-xs uppercase font-medium">Выручка</p>
                <p className="text-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">{formatPrice(stats.totalRevenue)} ₽</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div 
          className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="p-4 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Поиск по номеру, имени, телефону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl border-slate-200 focus:border-teal-400 focus:ring-teal-200"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className={`rounded-xl ${statusFilter === 'all' ? 'bg-gradient-to-r from-teal-500 to-emerald-500 border-0' : 'border-slate-200 hover:border-teal-300'}`}
              >
                Все
              </Button>
              {ORDER_STATUSES.map(status => (
                <Button
                  key={status.value}
                  variant={statusFilter === status.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status.value)}
                  className={`rounded-xl ${statusFilter === status.value ? status.color : 'border-slate-200 hover:border-slate-300'}`}
                >
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
            <motion.div 
              className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-12 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
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
              
              return (
                <motion.div 
                  key={order.id} 
                  className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  {/* Order Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-zinc-50 transition-colors"
                    onClick={() => toggleExpand(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusInfo.color}`}>
                          <StatusIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">#{order.id?.slice(0, 8)}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-zinc-500 mt-1">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {order.customer_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(order.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatPrice(order.total)} ₽</p>
                          <p className="text-xs text-zinc-400">{order.items?.length || 0} товаров</p>
                        </div>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200">
                      {/* Customer Info */}
                      <div className="p-4 bg-zinc-50 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-zinc-400" />
                          <span className="text-sm">{order.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-zinc-400" />
                          <span className="text-sm">{order.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-zinc-400" />
                          <span className="text-sm truncate max-w-xs">{order.address}</span>
                        </div>
                      </div>
                      
                      {/* Items */}
                      <div className="p-4">
                        <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Товары</p>
                        <div className="space-y-2">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                              <div className="flex items-center gap-3">
                                {item.image_url && (
                                  <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded" />
                                )}
                                <div>
                                  <p className="font-medium text-sm">{item.name}</p>
                                  <p className="text-xs text-zinc-400">{item.article}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatPrice(item.price)} ₽ × {item.quantity}</p>
                                <p className="text-sm text-zinc-500">{formatPrice(item.price * item.quantity)} ₽</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zinc-500">Изменить статус:</span>
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            className="text-sm border border-zinc-200 rounded px-2 py-1 bg-white"
                          >
                            {ORDER_STATUSES.map(status => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setViewingOrder(order)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Подробнее
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditingOrder({...order})}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Редактировать
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteOrder(order.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* View Order Dialog */}
      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Заказ #{viewingOrder?.id?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">Клиент</p>
                  <p className="font-medium">{viewingOrder.full_name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">Телефон</p>
                  <p className="font-medium">{viewingOrder.phone}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold uppercase text-zinc-500">Адрес</p>
                  <p className="font-medium">{viewingOrder.address}</p>
                </div>
                {viewingOrder.comment && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold uppercase text-zinc-500">Комментарий</p>
                    <p className="font-medium text-zinc-600">{viewingOrder.comment}</p>
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Товары</p>
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="text-left py-2 px-3">Товар</th>
                        <th className="text-right py-2 px-3">Цена</th>
                        <th className="text-right py-2 px-3">Кол-во</th>
                        <th className="text-right py-2 px-3">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingOrder.items?.map((item, idx) => (
                        <tr key={idx} className="border-t border-zinc-100">
                          <td className="py-2 px-3">{item.name}</td>
                          <td className="py-2 px-3 text-right">{formatPrice(item.price)} ₽</td>
                          <td className="py-2 px-3 text-right">{item.quantity}</td>
                          <td className="py-2 px-3 text-right font-medium">{formatPrice(item.price * item.quantity)} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50 font-bold">
                      <tr>
                        <td colSpan="3" className="py-2 px-3 text-right">Итого:</td>
                        <td className="py-2 px-3 text-right">{formatPrice(viewingOrder.total)} ₽</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать заказ #{editingOrder?.id?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500">Получатель</label>
                  <Input
                    value={editingOrder.full_name || ''}
                    onChange={(e) => setEditingOrder({...editingOrder, full_name: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500">Телефон</label>
                  <Input
                    value={editingOrder.phone || ''}
                    onChange={(e) => setEditingOrder({...editingOrder, phone: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Адрес</label>
                <Input
                  value={editingOrder.address || ''}
                  onChange={(e) => setEditingOrder({...editingOrder, address: e.target.value})}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Комментарий к заказу</label>
                <Input
                  value={editingOrder.comment || ''}
                  onChange={(e) => setEditingOrder({...editingOrder, comment: e.target.value})}
                  className="mt-1"
                  placeholder="Комментарий от клиента..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500">Дата и время заказа</label>
                  <Input
                    type="datetime-local"
                    value={editingOrder.created_at ? editingOrder.created_at.slice(0, 16) : ''}
                    onChange={(e) => setEditingOrder({...editingOrder, created_at: e.target.value ? new Date(e.target.value).toISOString() : editingOrder.created_at})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500">Статус</label>
                  <select
                    value={editingOrder.status}
                    onChange={(e) => setEditingOrder({...editingOrder, status: e.target.value})}
                    className="mt-1 w-full h-10 px-3 border border-zinc-200 bg-white rounded"
                  >
                    {ORDER_STATUSES.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Order Items with editable prices and discounts */}
              <div className="border-t pt-4">
                <label className="text-xs font-bold uppercase text-zinc-500 mb-3 block">Товары в заказе</label>
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
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        <div>
                          <label className="text-xs text-zinc-400">Цена (₽)</label>
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleUpdateOrderItem(idx, 'price', e.target.value)}
                            className="mt-1 h-8 text-sm"
                            min={0}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400">Кол-во</label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateOrderItem(idx, 'quantity', e.target.value)}
                            className="mt-1 h-8 text-sm"
                            min={1}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 flex items-center gap-1">
                            <Percent className="w-3 h-3" /> Скидка
                          </label>
                          <Input
                            type="number"
                            value={item.discount_percent || 0}
                            onChange={(e) => handleUpdateOrderItem(idx, 'discount_percent', e.target.value)}
                            className="mt-1 h-8 text-sm"
                            min={0}
                            max={100}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400">Сумма</label>
                          <p className="mt-1 h-8 flex items-center text-sm font-bold">
                            {new Intl.NumberFormat('ru-RU').format(
                              item.price * item.quantity * (1 - (item.discount_percent || 0) / 100)
                            )} ₽
                          </p>
                        </div>
                      </div>
                      {(item.discount_percent || 0) > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          Скидка {item.discount_percent}%: -{new Intl.NumberFormat('ru-RU').format(item.price * item.quantity * (item.discount_percent / 100))} ₽
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Order-level discount */}
              <div className="border-t pt-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <Label className="text-xs font-bold uppercase text-orange-600 flex items-center gap-2">
                    <Percent className="w-4 h-4" /> Скидка на весь заказ
                  </Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Input
                      type="number"
                      value={editingOrder.order_discount_percent || 0}
                      onChange={(e) => setEditingOrder({...editingOrder, order_discount_percent: parseFloat(e.target.value) || 0})}
                      className="w-24"
                      min={0}
                      max={100}
                    />
                    <span className="text-zinc-500">%</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 border border-green-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-green-600">Итого со скидками:</p>
                    <p className="text-2xl font-bold font-mono text-green-700">
                      {new Intl.NumberFormat('ru-RU').format(calculateOrderTotal(editingOrder.items || [], editingOrder.order_discount_percent || 0))} ₽
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingOrder(null)} className="flex-1">
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button onClick={handleSaveOrder} className="flex-1 bg-orange-500 hover:bg-orange-600">
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
