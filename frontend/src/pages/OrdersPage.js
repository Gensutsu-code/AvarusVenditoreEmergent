import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, ChevronDown, ChevronUp, TrendingUp, ShoppingBag, 
  Wallet, BarChart3, Star, CalendarDays, AlertTriangle, Check, XCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { sendNotification, requestNotificationPermission } from '../utils/notifications';
import CryptoPaymentModal from '../components/CryptoPaymentModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = {
  new: 'Новый',
  pending: 'Ожидает обработки',
  processing: 'В обработке',
  shipped: 'Отправлен',
  delivered: 'Доставлен',
  cancelled: 'Отменён'
};

const STATUS_COLORS = {
  new: 'bg-sky-100 text-sky-700',
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700'
};

const PAYMENT_METHOD_LABELS = {
  cash: 'наличными при получении',
  card: 'банковской картой',
  crypto: 'криптовалютой',
  balance: 'с баланса'
};

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [cryptoPaymentOrderId, setCryptoPaymentOrderId] = useState(null);
  const [cryptoPaymentAmount, setCryptoPaymentAmount] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchData();
    // Request notification permission
    requestNotificationPermission();
  }, [user, authLoading, navigate]);

  // Poll for order updates
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchData = async () => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        axios.get(`${API}/orders`),
        axios.get(`${API}/orders/stats`)
      ]);
      
      // Check for new changes requiring attention
      const newOrders = ordersRes.data;
      if (orders.length > 0) {
        newOrders.forEach(newOrder => {
          const oldOrder = orders.find(o => o.id === newOrder.id);
          if (newOrder.awaiting_confirmation && (!oldOrder || !oldOrder.awaiting_confirmation)) {
            // New change notification
            sendNotification(
              'Изменения в заказе',
              `Заказ #${newOrder.id.slice(0, 8)} был изменён. Требуется подтверждение.`,
              { tag: `order-change-${newOrder.id}`, onClick: () => navigate('/orders') }
            );
            toast.warning(`Заказ #${newOrder.id.slice(0, 8)} был изменён администратором`, { duration: 10000 });
          }
        });
      }
      
      setOrders(newOrders);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptChanges = async (orderId) => {
    try {
      const res = await axios.post(`${API}/orders/${orderId}/accept-changes`);
      const data = res.data;
      
      if (data.action === 'payment_required') {
        const amount = data.amount;
        const method = data.payment_method;
        
        if (method === 'crypto') {
          // Open crypto payment modal for surcharge
          setCryptoPaymentOrderId(orderId);
          setCryptoPaymentAmount(amount);
          setShowCryptoModal(true);
          return;
        } else if (method === 'card') {
          // Redirect to card payment (ЮKassa)
          toast.info(`Требуется доплата ${amount.toFixed(2)} ₽ картой`);
          navigate(`/checkout?order_id=${orderId}&additional_payment=${amount}&method=card`);
          return;
        } else if (method === 'balance') {
          toast.error(`Недостаточно средств на балансе. Требуется: ${amount.toFixed(2)} ₽`);
          return;
        }
      } else if (data.action === 'balance_deducted') {
        toast.success(`Доплата ${data.amount.toFixed(2)} ₽ списана с баланса`);
      } else if (data.action === 'refund_to_balance') {
        toast.success(`${data.amount.toFixed(2)} ₽ возвращено на ваш баланс`);
      } else {
        toast.success('Изменения приняты');
      }
      
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handleCryptoPaymentSuccess = () => {
    setShowCryptoModal(false);
    setCryptoPaymentOrderId(null);
    setCryptoPaymentAmount(0);
    toast.success('Доплата произведена успешно');
    fetchData();
  };

  const handleCryptoPaymentClose = () => {
    setShowCryptoModal(false);
    toast.info('Оплата не завершена. Изменения ожидают подтверждения.');
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Вы уверены, что хотите отменить заказ?')) return;
    try {
      await axios.post(`${API}/orders/${orderId}/cancel`);
      toast.success('Заказ отменён');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отмены заказа');
    }
  };

  const canCancelOrder = (order) => {
    if (order.status !== 'processing') return false;
    const processingStarted = order.processing_started_at;
    if (!processingStarted) return true;
    const started = new Date(processingStarted);
    const hoursPassed = (Date.now() - started.getTime()) / (1000 * 60 * 60);
    return hoursPassed <= 24;
  };

  const getTimeLeftToCancel = (order) => {
    const processingStarted = order.processing_started_at;
    if (!processingStarted) return '24 часа';
    const started = new Date(processingStarted);
    const hoursLeft = 24 - ((Date.now() - started.getTime()) / (1000 * 60 * 60));
    if (hoursLeft <= 0) return '0 минут';
    if (hoursLeft < 1) return `${Math.round(hoursLeft * 60)} минут`;
    return `${Math.round(hoursLeft)} часов`;
  };

  const toggleOrderExpanded = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen relative" data-testid="orders-page">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-20 right-20 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          className="flex items-center gap-4 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
              Мои заказы
            </h1>
            <p className="text-sm text-slate-500">
              {orders.length > 0 ? `${orders.length} заказов` : 'История покупок'}
            </p>
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500">Загрузка...</p>
          </div>
        ) : orders.length === 0 ? (
          <motion.div 
            className="text-center py-16 glass-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            data-testid="no-orders"
          >
            <Package className="w-20 h-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg mb-6">У вас пока нет заказов</p>
            <Link to="/catalog">
              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/30 rounded-xl">
                Перейти в каталог
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Statistics Summary */}
            {stats && stats.total_orders > 0 && (
              <motion.div 
                className="glass-card overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                data-testid="orders-stats"
              >
                {/* Stats Header */}
                <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-4">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Статистика заказов
                  </h2>
                </div>
                
                <div className="p-6">
                  {/* Main Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200/50">
                      <ShoppingBag className="w-5 h-5 text-teal-600 mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{stats.total_orders}</p>
                      <p className="text-xs text-slate-500">Всего заказов</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200/50">
                      <Wallet className="w-5 h-5 text-emerald-600 mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{formatPrice(stats.total_spent)} ₽</p>
                      <p className="text-xs text-slate-500">Общая сумма</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200/50">
                      <TrendingUp className="w-5 h-5 text-blue-600 mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{formatPrice(stats.avg_order_value)} ₽</p>
                      <p className="text-xs text-slate-500">Средний чек</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200/50">
                      <Package className="w-5 h-5 text-purple-600 mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{stats.total_items}</p>
                      <p className="text-xs text-slate-500">Товаров куплено</p>
                    </div>
                  </div>
                  
                  {/* Status breakdown */}
                  {Object.keys(stats.by_status || {}).length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-bold uppercase text-slate-400 mb-2">По статусу</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.by_status).map(([status, count]) => (
                          <span 
                            key={status} 
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-700'}`}
                          >
                            {STATUS_LABELS[status] || status}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Favorite Products */}
                  {stats.favorite_products && stats.favorite_products.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-1">
                        <Star className="w-3 h-3" /> Часто заказываемые товары
                      </p>
                      <div className="space-y-2">
                        {stats.favorite_products.slice(0, 3).map((product, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">
                                {product.article}
                              </span>
                              <span className="text-sm text-slate-700 truncate max-w-[200px]">{product.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-slate-800">{product.count} шт.</span>
                              <span className="text-xs text-slate-400 ml-2">({formatPrice(product.total_spent)} ₽)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly chart */}
                  {stats.by_month && stats.by_month.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> Динамика по месяцам
                      </p>
                      <div className="flex items-end gap-2 h-28 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        {stats.by_month.map((month, idx) => {
                          const maxTotal = Math.max(...stats.by_month.map(m => m.total));
                          const heightPercent = maxTotal > 0 ? (month.total / maxTotal) * 100 : 0;
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center">
                              <p className="text-[9px] text-slate-400 mb-1">{formatPrice(month.total)}</p>
                              <motion.div 
                                className="w-full bg-gradient-to-t from-teal-500 to-emerald-400 rounded-t-lg cursor-pointer"
                                style={{ height: `${Math.max(heightPercent, 8)}%`, minHeight: '8px' }}
                                title={`${month.orders} заказов на ${formatPrice(month.total)} ₽`}
                                whileHover={{ scale: 1.05 }}
                              />
                              <p className="text-[10px] text-slate-400 mt-1">{formatMonth(month.month)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Orders List */}
            <div className="space-y-4" data-testid="orders-list">
              <AnimatePresence>
                {orders.map((order, index) => (
                  <motion.div 
                    key={order.id} 
                    className="glass-card overflow-hidden"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    data-testid={`order-${order.id}`}
                  >
                    {/* Order header */}
                    <div 
                      className="flex flex-wrap items-center justify-between gap-4 p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => toggleOrderExpanded(order.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-semibold text-slate-800">
                            Заказ #{order.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatDate(order.created_at)}
                          </p>
                          {/* Change labels */}
                          {order.has_changes && order.change_types && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {order.change_types.includes('price') && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 rounded-lg">
                                  Изменилась цена товара
                                </span>
                              )}
                              {order.change_types.includes('quantity') && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-lg">
                                  Изменилось количество товара
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-teal-600 text-lg">
                          {formatPrice(order.total)} ₽
                        </span>
                        <span className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg ${STATUS_COLORS[order.status] || 'bg-slate-100'}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                        {order.awaiting_confirmation && (
                          <span className="px-3 py-1.5 text-xs font-bold uppercase rounded-lg bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
                            Требуется подтверждение
                          </span>
                        )}
                        <motion.div
                          animate={{ rotate: expandedOrders[order.id] ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        </motion.div>
                      </div>
                    </div>

                    {/* Expanded order details */}
                    <AnimatePresence>
                      {expandedOrders[order.id] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-slate-200/50"
                        >
                          <div className="p-4">
                            {/* Delivery info */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
                              <div className="bg-slate-50 p-3 rounded-xl">
                                <p className="text-slate-400 text-xs uppercase mb-1">Получатель</p>
                                <p className="font-medium text-slate-800">{order.full_name}</p>
                              </div>
                              <div className="bg-slate-50 p-3 rounded-xl">
                                <p className="text-slate-400 text-xs uppercase mb-1">Телефон</p>
                                <p className="font-medium text-slate-800">{order.phone}</p>
                              </div>
                              <div className="bg-slate-50 p-3 rounded-xl">
                                <p className="text-slate-400 text-xs uppercase mb-1">Адрес</p>
                                <p className="font-medium text-slate-800">{order.address}</p>
                              </div>
                            </div>

                            {/* Order comment */}
                            {order.comment && (
                              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-amber-700 text-xs uppercase font-bold mb-1">Комментарий к заказу</p>
                                <p className="text-amber-800 text-sm">{order.comment}</p>
                              </div>
                            )}

                            {/* Order items - with comparison if changes pending */}
                            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                              {order.items.map((item, idx) => {
                                const prevItem = order.awaiting_confirmation && order.previous_items ? order.previous_items[idx] : null;
                                const priceChanged = prevItem && prevItem.price !== item.price;
                                const qtyChanged = prevItem && prevItem.quantity !== item.quantity;
                                
                                return (
                                  <div key={idx} className="flex gap-4 p-4 bg-white">
                                    <div className="w-16 h-16 flex-shrink-0 bg-slate-100 rounded-xl overflow-hidden">
                                      {item.image_url ? (
                                        <img src={item.image_url.startsWith('http') ? item.image_url : `${BACKEND_URL}${item.image_url}`} alt={item.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="w-6 h-6" /></div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-800">{item.name}</p>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                        {item.manufacturer && <p className="text-sm font-semibold text-teal-600">{item.manufacturer}</p>}
                                        {item.article && <p className="text-sm font-mono text-slate-500">Арт: {item.article}</p>}
                                      </div>
                                      <div className="text-sm mt-1">
                                        {priceChanged ? (
                                          <span><span className="text-red-500 line-through">{formatPrice(prevItem.price)} ₽</span> <span className="text-emerald-600 font-semibold">{formatPrice(item.price)} ₽</span></span>
                                        ) : (
                                          <span className="text-slate-400">{formatPrice(item.price)} ₽</span>
                                        )}
                                        <span className="text-slate-400"> × </span>
                                        {qtyChanged ? (
                                          <span><span className="text-red-500 line-through">{prevItem.quantity} шт.</span> <span className="text-emerald-600 font-semibold">{item.quantity} шт.</span></span>
                                        ) : (
                                          <span className="text-slate-400">{item.quantity} шт.</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      {(priceChanged || qtyChanged) && prevItem ? (
                                        <div>
                                          <p className="font-mono text-red-500 line-through text-sm">{formatPrice(prevItem.price * prevItem.quantity)} ₽</p>
                                          <p className="font-mono font-bold text-emerald-600">{formatPrice(item.price * item.quantity)} ₽</p>
                                        </div>
                                      ) : (
                                        <p className="font-mono font-bold text-teal-600">{formatPrice(item.price * item.quantity)} ₽</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Order total */}
                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200/50">
                              <span className="text-slate-500 text-sm">Оплата: {PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method || 'не указан'}</span>
                              <div className="text-right">
                                <span className="text-sm text-slate-400">Итого: </span>
                                {order.awaiting_confirmation && order.previous_total && order.previous_total !== order.total ? (
                                  <span>
                                    <span className="font-mono text-lg text-red-500 line-through mr-2">{formatPrice(order.previous_total)} ₽</span>
                                    <span className="font-mono text-2xl font-bold text-emerald-600">{formatPrice(order.total)} ₽</span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-2xl font-bold text-teal-600">{formatPrice(order.total)} ₽</span>
                                )}
                              </div>
                            </div>

                            {/* Action buttons for changes */}
                            {order.awaiting_confirmation && (
                              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-orange-800">Изменения в заказе</p>
                                    {order.paid && order.payment_method !== 'cash' && order.previous_total && (
                                      order.total > order.previous_total ? (
                                        <p className="text-sm text-orange-700 mt-1">
                                          Сумма заказа увеличилась. Требуется доплата <span className="font-bold">{formatPrice(order.total - order.previous_total)} ₽</span>
                                          {order.payment_method === 'balance' ? ' (будет списана с баланса)' : ` (оплата ${order.payment_method === 'crypto' ? 'криптовалютой' : 'картой'})`}
                                        </p>
                                      ) : order.total < order.previous_total ? (
                                        <p className="text-sm text-emerald-700 mt-1">
                                          Сумма заказа уменьшилась. На ваш баланс будет возвращено <span className="font-bold">{formatPrice(order.previous_total - order.total)} ₽</span>
                                        </p>
                                      ) : null
                                    )}
                                    <p className="text-sm text-orange-700 mt-1">
                                      Без подтверждения заказ будет автоматически отменён через 24 часа.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <Button 
                                    onClick={(e) => { e.stopPropagation(); handleAcceptChanges(order.id); }}
                                    className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl"
                                  >
                                    <Check className="w-4 h-4 mr-2" />
                                    {order.paid && order.payment_method !== 'cash' && order.total > order.previous_total 
                                      ? `Принять и доплатить ${formatPrice(order.total - order.previous_total)} ₽`
                                      : 'Принять изменения'
                                    }
                                  </Button>
                                  <Button 
                                    variant="outline"
                                    onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.id); }}
                                    className="border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Отменить заказ
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Cancel button for processing orders within 24 hours */}
                            {order.status === 'processing' && !order.awaiting_confirmation && canCancelOrder(order) && (
                              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-slate-600">Вы можете отменить заказ в течение 24 часов после принятия в обработку</p>
                                    <p className="text-xs text-slate-400 mt-1">Осталось: {getTimeLeftToCancel(order)}</p>
                                  </div>
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.id); }}
                                    className="border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Отменить
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Crypto Payment Modal for surcharges */}
      <CryptoPaymentModal
        open={showCryptoModal}
        onClose={handleCryptoPaymentClose}
        orderId={cryptoPaymentOrderId}
        amountRub={cryptoPaymentAmount}
        onSuccess={handleCryptoPaymentSuccess}
      />
    </div>
  );
}
