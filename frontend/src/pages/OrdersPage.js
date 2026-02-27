import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, ChevronDown, ChevronUp, TrendingUp, ShoppingBag, 
  Wallet, BarChart3, Star, CalendarDays
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = {
  pending: 'Ожидает обработки',
  processing: 'В обработке',
  shipped: 'Отправлен',
  delivered: 'Доставлен',
  cancelled: 'Отменён'
};

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700'
};

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [user, authLoading, navigate]);

  const fetchData = async () => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        axios.get(`${API}/orders`),
        axios.get(`${API}/orders/stats`)
      ]);
      setOrders(ordersRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
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

                            {/* Order items */}
                            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex gap-4 p-4 bg-white">
                                  {/* Product image */}
                                  <div className="w-16 h-16 flex-shrink-0 bg-slate-100 rounded-xl overflow-hidden">
                                    {item.image_url ? (
                                      <img 
                                        src={item.image_url.startsWith('http') ? item.image_url : `${BACKEND_URL}${item.image_url}`} 
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                                        <Package className="w-6 h-6" />
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Product info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800">{item.name}</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                      {item.manufacturer && (
                                        <p className="text-sm font-semibold text-teal-600">{item.manufacturer}</p>
                                      )}
                                      {item.article && (
                                        <p className="text-sm font-mono text-slate-500">Арт: {item.article}</p>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-400 mt-1">
                                      {formatPrice(item.price)} ₽ × {item.quantity} шт.
                                    </p>
                                  </div>
                                  
                                  {/* Item total */}
                                  <div className="text-right">
                                    <p className="font-mono font-bold text-teal-600">
                                      {formatPrice(item.price * item.quantity)} ₽
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Order total */}
                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200/50">
                              <span className="text-slate-500 text-sm">Оплата: наличными при получении</span>
                              <div className="text-right">
                                <span className="text-sm text-slate-400">Итого: </span>
                                <span className="font-mono text-2xl font-bold text-teal-600">
                                  {formatPrice(order.total)} ₽
                                </span>
                              </div>
                            </div>
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
    </div>
  );
}
