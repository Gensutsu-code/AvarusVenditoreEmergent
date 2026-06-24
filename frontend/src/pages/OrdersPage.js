import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, ChevronDown, ChevronUp, TrendingUp, ShoppingBag, 
  Wallet, BarChart3, Star, CalendarDays, AlertTriangle, Check, XCircle, CreditCard, X, RefreshCw, Clock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { sendNotification, requestNotificationPermission } from '../utils/notifications';
import CryptoPaymentModal from '../components/CryptoPaymentModal';
import ReturnModal from '../components/ReturnModal';
import CardPaymentBlock from '../components/CardPaymentBlock';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = {
  pending: 'Ожидает',
  processing: 'Обработка',
  partially_fulfilled: 'Частично выполнен',
  completed: 'Выполнен',
  cancelled: 'Отменён'
};

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  partially_fulfilled: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
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
  const [nowTs, setNowTs] = useState(Date.now());
  const [surchargeModal, setSurchargeModal] = useState(null); // { orderId, amount, userBalance }
  const [returnOrder, setReturnOrder] = useState(null);
  const [returnSettings, setReturnSettings] = useState(null);
  const [periodFilter, setPeriodFilter] = useState('month'); // week | month | year | all (default last month)

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchData();
    axios.get(`${API}/return-settings`).then((r) => setReturnSettings(r.data)).catch(() => {});
    // Request notification permission
    requestNotificationPermission();
  }, [user, authLoading, navigate]);

  // Compute return-window eligibility for a completed order
  const getReturnWindow = (order) => {
    if (order.status !== 'completed') return null;
    const windowDays = returnSettings?.return_window_days ?? 0;
    if (!windowDays || windowDays <= 0) return { allowed: true, expired: false, windowDays: 0, daysLeft: null };
    const refStr = order.completed_at || order.created_at;
    const ref = refStr ? new Date(refStr) : null;
    if (!ref || isNaN(ref.getTime())) return { allowed: true, expired: false, windowDays, daysLeft: null };
    const daysPassed = Math.floor((Date.now() - ref.getTime()) / 86400000);
    const daysLeft = windowDays - daysPassed;
    return { allowed: daysLeft >= 0, expired: daysLeft < 0, windowDays, daysLeft };
  };

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
      
      // Always display orders newest-first by order date
      const sortedOrders = [...newOrders].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setOrders(sortedOrders);
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
        // Show payment method picker
        setSurchargeModal({
          orderId,
          amount: data.amount,
          userBalance: data.user_balance ?? 0
        });
        return;
      } else if (data.action === 'refund_to_balance') {
        toast.success(`${data.amount.toFixed(2)} ₽ возвращено на ваш баланс`);
      } else {
        toast.success('Изменения приняты');
      }
      window.__lastToastTime = Date.now();
      
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handlePaySurcharge = async (method) => {
    if (!surchargeModal) return;
    const { orderId, amount } = surchargeModal;
    
    if (method === 'balance') {
      try {
        const res = await axios.post(`${API}/orders/${orderId}/pay-additional`, { payment_method: 'balance' });
        toast.success(`Доплата ${amount.toFixed(2)} ₽ списана с баланса`);
        setSurchargeModal(null);
        fetchData();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Ошибка оплаты');
      }
    } else if (method === 'crypto') {
      setSurchargeModal(null);
      setCryptoPaymentOrderId(orderId);
      setCryptoPaymentAmount(amount);
      setShowCryptoModal(true);
    } else if (method === 'card') {
      setSurchargeModal(null);
      toast.info(`Требуется доплата ${amount.toFixed(2)} ₽ картой`);
      navigate(`/checkout?order_id=${orderId}&additional_payment=${amount}&method=card`);
    }
  };

  const handleCryptoPaymentSuccess = () => {
    setShowCryptoModal(false);
    setCryptoPaymentOrderId(null);
    setCryptoPaymentAmount(0);
    toast.success('Оплата прошла успешно');
    window.__lastToastTime = Date.now();
    fetchData();
  };

  const handleCryptoPaymentClose = () => {
    setShowCryptoModal(false);
    toast.info('Оплата не завершена.');
  };

  // Live ticker for payment-due countdowns
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatCountdown = (dueIso) => {
    const diff = new Date(dueIso).getTime() - nowTs;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}ч ${String(m).padStart(2, '0')}м ${String(s).padStart(2, '0')}с`;
  };

  const handlePayNowCrypto = (order, e) => {
    if (e) e.stopPropagation();
    setCryptoPaymentOrderId(order.id);
    setCryptoPaymentAmount(order.total);
    setShowCryptoModal(true);
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Вы уверены, что хотите отменить заказ?')) return;
    try {
      await axios.post(`${API}/orders/${orderId}/cancel`);
      toast.success('Заказ отменён');
      window.__lastToastTime = Date.now();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отмены заказа');
    }
  };

  const canCancelOrder = (order) => {
    if (order.status === 'pending') return true;
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
          <Link
            to="/returns"
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/70 border border-slate-200 text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition"
            data-testid="my-returns-link"
          >
            <RefreshCw className="w-4 h-4" />
            Мои возвраты
          </Link>
        </motion.div>

        {loading ? (
          <div className="space-y-4" data-testid="orders-loading">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-100 bg-white">
                  <div className="animate-pulse bg-slate-200/70 rounded-lg w-5 h-5 mb-2" />
                  <div className="animate-pulse bg-slate-200/70 rounded-lg h-6 w-20 mb-1.5" />
                  <div className="animate-pulse bg-slate-200/70 rounded-lg h-3 w-16" />
                </div>
              ))}
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass-card p-5">
                <div className="flex items-center gap-4">
                  <div className="animate-pulse bg-slate-200/70 rounded-xl w-12 h-12" />
                  <div className="flex-1 space-y-2">
                    <div className="animate-pulse bg-slate-200/70 rounded-lg h-4 w-1/3" />
                    <div className="animate-pulse bg-slate-200/70 rounded-lg h-3 w-1/4" />
                  </div>
                  <div className="animate-pulse bg-slate-200/70 rounded-lg h-6 w-24" />
                </div>
              </div>
            ))}
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
                <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Статистика заказов
                  </h2>
                  <div className="flex items-center gap-1.5 bg-white/15 rounded-xl p-1" data-testid="stats-period-filter">
                    {[{ id: 'week', label: 'Неделя' }, { id: 'month', label: 'Месяц' }, { id: 'year', label: 'Год' }, { id: 'all', label: 'Всё время' }].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPeriodFilter(p.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${periodFilter === p.id ? 'bg-white text-teal-600 shadow-sm' : 'text-white/80 hover:bg-white/15'}`}
                        data-testid={`stats-period-${p.id}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="p-6">
                  {(() => {
                    const days = { week: 7, month: 30, year: 365, all: null }[periodFilter];
                    const cutoff = days != null ? Date.now() - days * 86400000 : null;
                    const periodOrders = cutoff == null ? orders : orders.filter((o) => {
                      const t = new Date(o.created_at || 0).getTime();
                      return !isNaN(t) && t >= cutoff;
                    });
                    const ps = {
                      total_orders: periodOrders.length,
                      total_spent: periodOrders.reduce((s, o) => s + (o.total || 0), 0),
                      total_items: periodOrders.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + (i.quantity || 0), 0), 0),
                      by_status: periodOrders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {}),
                    };
                    ps.avg_order_value = ps.total_orders ? Math.round(ps.total_spent / ps.total_orders) : 0;
                    return (
                  <>
                  {/* Main Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="stats-cards">
                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200/50">
                      <ShoppingBag className="w-5 h-5 text-teal-600 mb-2" />
                      <p className="text-2xl font-bold text-slate-800" data-testid="stat-total-orders">{ps.total_orders}</p>
                      <p className="text-xs text-slate-500">Всего заказов</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200/50">
                      <Wallet className="w-5 h-5 text-emerald-600 mb-2" />
                      <p className="text-2xl font-bold text-slate-800" data-testid="stat-total-spent">{formatPrice(ps.total_spent)} ₽</p>
                      <p className="text-xs text-slate-500">Общая сумма</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200/50">
                      <TrendingUp className="w-5 h-5 text-blue-600 mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{formatPrice(ps.avg_order_value)} ₽</p>
                      <p className="text-xs text-slate-500">Средний чек</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200/50">
                      <Package className="w-5 h-5 text-purple-600 mb-2" />
                      <p className="text-2xl font-bold text-slate-800">{ps.total_items}</p>
                      <p className="text-xs text-slate-500">Товаров куплено</p>
                    </div>
                  </div>

                  {ps.total_orders === 0 && (
                    <p className="text-sm text-slate-400 text-center mb-6" data-testid="stats-period-empty">За выбранный период заказов нет</p>
                  )}

                  {/* Status breakdown */}
                  {Object.keys(ps.by_status || {}).length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-bold uppercase text-slate-400 mb-2">По статусу</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ps.by_status).map(([status, count]) => (
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
                  </>
                    );
                  })()}
                  
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
                        {order.status === 'completed' && (() => {
                          const rw = getReturnWindow(order);
                          if (rw && rw.expired) {
                            return (
                              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-400" data-testid={`return-expired-badge-${order.id}`}>
                                <Clock className="w-3.5 h-3.5" />
                                Срок возврата истёк
                              </span>
                            );
                          }
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); setReturnOrder(order); }}
                              className="border-teal-300 text-teal-600 hover:bg-teal-50 rounded-xl"
                              data-testid={`header-return-btn-${order.id}`}
                            >
                              <RefreshCw className="w-4 h-4 mr-1.5" />
                              Возврат
                            </Button>
                          );
                        })()}
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
                            {/* Order comment */}
                            {order.comment && (
                              <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-amber-800 text-sm"><span className="font-semibold">Комментарий:</span> {order.comment}</p>
                              </div>
                            )}

                            {/* Order items - compact cards */}
                            <div className="space-y-2">
                              {order.items.map((item, idx) => {
                                const prevItem = order.awaiting_confirmation && order.previous_items ? order.previous_items[idx] : null;
                                const priceChanged = prevItem && prevItem.price !== item.price;
                                const qtyChanged = prevItem && prevItem.quantity !== item.quantity;
                                const itemTotal = item.price * item.quantity;
                                const prevTotal = prevItem ? prevItem.price * prevItem.quantity : null;
                                
                                return (
                                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100" data-testid={`order-item-${idx}`}>
                                    <div className="w-12 h-12 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-slate-200">
                                      {item.image_url ? (
                                        <img src={item.image_url.startsWith('http') ? item.image_url : `${BACKEND_URL}${item.image_url}`} alt={item.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="w-5 h-5" /></div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-800 text-sm truncate">{item.name}</p>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                        {item.article && <span className="text-xs font-mono text-slate-400">{item.article}</span>}
                                        {item.manufacturer && <span className="text-xs text-teal-600 font-medium">{item.manufacturer}</span>}
                                        {item.warehouse && <span className="text-xs text-slate-400">Склад: {item.warehouse}</span>}
                                        {item.delivery_days && <span className="text-xs text-blue-500">{item.delivery_days} дн.</span>}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      <div className="text-right text-sm">
                                        {priceChanged ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-red-400 line-through text-xs">{formatPrice(prevItem.price)}</span>
                                            <span className="text-emerald-600 font-semibold">{formatPrice(item.price)} ₽</span>
                                          </div>
                                        ) : (
                                          <span className="text-slate-500">{formatPrice(item.price)} ₽</span>
                                        )}
                                      </div>
                                      <div className="text-center min-w-[40px]">
                                        {qtyChanged ? (
                                          <div className="flex items-center gap-1 text-sm">
                                            <span className="text-red-400 line-through text-xs">{prevItem.quantity}</span>
                                            <span className="text-emerald-600 font-semibold">×{item.quantity}</span>
                                          </div>
                                        ) : (
                                          <span className="text-slate-400 text-sm">×{item.quantity}</span>
                                        )}
                                        {Number(item.quantity_fulfilled || 0) > 0 && Number(item.quantity_fulfilled || 0) < Number(item.quantity || 0) && (
                                          <p className="text-[10px] font-semibold text-amber-600 mt-0.5" data-testid={`fulfilled-${item.product_id}`}>
                                            отгружено {item.quantity_fulfilled} из {item.quantity}
                                          </p>
                                        )}
                                        {Number(item.quantity_fulfilled || 0) === Number(item.quantity || 0) && Number(item.quantity || 0) > 0 && (
                                          <p className="text-[10px] font-semibold text-emerald-600 mt-0.5" data-testid={`fulfilled-${item.product_id}`}>
                                            ✓ отгружено
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right min-w-[70px]">
                                        {(priceChanged || qtyChanged) && prevTotal ? (
                                          <div>
                                            <p className="text-red-400 line-through text-xs">{formatPrice(prevTotal)} ₽</p>
                                            <p className="font-bold text-emerald-600 text-sm">{formatPrice(itemTotal)} ₽</p>
                                          </div>
                                        ) : (
                                          <p className="font-bold text-teal-700 text-sm">{formatPrice(itemTotal)} ₽</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Order total */}
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200/50">
                              <span className="text-slate-400 text-sm">Оплата: {PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method || 'не указан'}</span>
                              <div className="text-right">
                                {order.awaiting_confirmation && order.previous_total && order.previous_total !== order.total ? (
                                  <span className="flex items-center gap-2">
                                    <span className="font-mono text-red-400 line-through">{formatPrice(order.previous_total)} ₽</span>
                                    <span className="font-mono text-xl font-bold text-emerald-600">{formatPrice(order.total)} ₽</span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-xl font-bold text-teal-600">{formatPrice(order.total)} ₽</span>
                                )}
                              </div>
                            </div>

                            {/* Payment due countdown (deferred card/crypto) */}
                            {order.payment_due_date && order.payment_status !== 'paid' && !['cancelled', 'completed', 'delivered'].includes(order.status) && !order.card_receipt_url && (() => {
                              const cd = formatCountdown(order.payment_due_date);
                              const isCrypto = order.payment_method === 'crypto';
                              return (
                                <div className={`mt-3 rounded-xl border p-4 ${cd ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`} data-testid={`payment-due-block-${order.id}`}>
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-start gap-3">
                                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cd ? 'bg-amber-100' : 'bg-rose-100'}`}>
                                        <Clock className={`w-4 h-4 ${cd ? 'text-amber-600' : 'text-rose-600'}`} />
                                      </div>
                                      <div>
                                        <p className={`font-semibold ${cd ? 'text-amber-800' : 'text-rose-800'}`}>{cd ? 'Ожидает оплаты' : 'Срок оплаты истёк'}</p>
                                        {cd ? (
                                          <p className="text-sm text-amber-700 mt-0.5">Оплатите в течение <span className="font-bold tabular-nums" data-testid={`payment-countdown-${order.id}`}>{cd}</span>, иначе заказ будет автоматически отменён.</p>
                                        ) : (
                                          <p className="text-sm text-rose-700 mt-0.5">Заказ будет отменён автоматически. {isCrypto ? 'Вы ещё можете оплатить.' : 'Загрузите чек ниже.'}</p>
                                        )}
                                      </div>
                                    </div>
                                    {isCrypto && (
                                      <Button onClick={(e) => handlePayNowCrypto(order, e)} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl" data-testid={`pay-now-btn-${order.id}`}>
                                        <Wallet className="w-4 h-4 mr-2" />Оплатить сейчас
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            <CardPaymentBlock order={order} onUpdate={fetchData} />

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

                            {/* Cancel button for pending orders */}
                            {order.status === 'pending' && !order.awaiting_confirmation && (
                              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-slate-600">Заказ ещё не принят в обработку — вы можете его отменить</p>
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.id); }}
                                    className="border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl"
                                    data-testid={`cancel-pending-order-${order.id}`}
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Отменить заказ
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Return button for completed orders */}
                            {order.status === 'completed' && (() => {
                              const rw = getReturnWindow(order);
                              if (rw && rw.expired) {
                                return (
                                  <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl" data-testid={`return-expired-${order.id}`}>
                                    <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                      <Clock className="w-4 h-4" />
                                      Срок возврата истёк (возврат был доступен в течение {rw.windowDays} дн. после выполнения заказа)
                                    </p>
                                  </div>
                                );
                              }
                              return (
                                <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                      <p className="text-sm font-medium text-teal-800">
                                        Нужен возврат или замена по гарантии?
                                      </p>
                                      <p className="text-xs text-teal-600 mt-0.5">
                                        {rw && rw.windowDays > 0 && rw.daysLeft != null
                                          ? `Возврат доступен ещё ${rw.daysLeft} дн.`
                                          : 'Вы можете оформить заявку на возврат средств или замену товара.'}
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReturnOrder(order);
                                      }}
                                      className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl shadow"
                                      data-testid={`create-return-btn-${order.id}`}
                                    >
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                      Оформить возврат
                                    </Button>
                                  </div>
                                </div>
                              );
                            })()}
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

      {/* Surcharge Payment Method Picker */}
      <AnimatePresence>
        {surchargeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSurchargeModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              data-testid="surcharge-modal"
            >
              <div className="p-5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Доплата за изменения</h3>
                  <p className="text-teal-100 text-sm mt-0.5">Выберите способ оплаты</p>
                </div>
                <button onClick={() => setSurchargeModal(null)} className="p-1 rounded-lg hover:bg-white/20 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5">
                <div className="text-center mb-5">
                  <p className="text-3xl font-bold text-slate-800">{surchargeModal.amount.toFixed(2)} ₽</p>
                  <p className="text-sm text-slate-500 mt-1">Сумма доплаты</p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => handlePaySurcharge('balance')}
                    disabled={surchargeModal.userBalance < surchargeModal.amount}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition ${
                      surchargeModal.userBalance >= surchargeModal.amount
                        ? 'border-teal-200 hover:border-teal-400 hover:bg-teal-50 cursor-pointer'
                        : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                    }`}
                    data-testid="pay-with-balance"
                  >
                    <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800">С баланса</p>
                      <p className="text-sm text-slate-500">
                        Доступно: {surchargeModal.userBalance.toFixed(2)} ₽
                        {surchargeModal.userBalance < surchargeModal.amount && ' (недостаточно)'}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handlePaySurcharge('crypto')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer"
                    data-testid="pay-with-crypto"
                  >
                    <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A7.5 7.5 0 0 0 2 9.5 7.5 7.5 0 0 0 9.5 17H12v5l5-7h-3V9.5A7.5 7.5 0 0 0 6.5 2"/><circle cx="14.5" cy="9.5" r="7.5"/></svg>
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800">Криптовалютой</p>
                      <p className="text-sm text-slate-500">USDT, USDC (BSC, Base, Polygon)</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handlePaySurcharge('card')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50 transition cursor-pointer"
                    data-testid="pay-with-card"
                  >
                    <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-semibold text-slate-800">Банковской картой</p>
                      <p className="text-sm text-slate-500">Visa, MasterCard, МИР</p>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crypto Payment Modal for surcharges */}
      <CryptoPaymentModal
        open={showCryptoModal}
        onClose={handleCryptoPaymentClose}
        orderId={cryptoPaymentOrderId}
        amountRub={cryptoPaymentAmount}
        onSuccess={handleCryptoPaymentSuccess}
      />

      {/* Return Modal */}
      {returnOrder && (
        <ReturnModal
          order={returnOrder}
          onClose={() => setReturnOrder(null)}
          onSuccess={() => {
            toast.success('Перейдите в раздел «Мои возвраты», чтобы отслеживать статус');
            fetchData();
          }}
        />
      )}
    </div>
  );
}
