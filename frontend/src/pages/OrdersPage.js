import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, ChevronDown, ChevronUp, TrendingUp, ShoppingBag, 
  DollarSign, BarChart3, Star, ArrowLeft, Wallet, Award, CalendarDays
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';

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
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState({});

  useEffect(() => {
    // Wait for auth loading to complete
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

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
    <div className="min-h-screen bg-zinc-50" data-testid="orders-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900">
            Мои заказы
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-500">Загрузка...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 border border-zinc-200 bg-white" data-testid="no-orders">
            <Package className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 text-lg mb-4">У вас пока нет заказов</p>
            <Link to="/catalog">
              <Button className="bg-orange-500 hover:bg-orange-600">
                Перейти в каталог
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Extended Statistics Summary */}
            {stats && stats.total_orders > 0 && (
              <div className="border border-zinc-200 bg-white" data-testid="orders-stats">
                {/* Stats Header */}
                <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-6 py-4">
                  <h2 className="text-white font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Статистика заказов
                  </h2>
                </div>
                
                <div className="p-6">
                  {/* Main Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
                      <ShoppingBag className="w-5 h-5 text-orange-500 mb-2" />
                      <p className="text-2xl font-bold text-zinc-900">{stats.total_orders}</p>
                      <p className="text-xs text-zinc-500">Всего заказов</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                      <Wallet className="w-5 h-5 text-green-500 mb-2" />
                      <p className="text-2xl font-bold text-zinc-900">{formatPrice(stats.total_spent)} ₽</p>
                      <p className="text-xs text-zinc-500">Общая сумма</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-blue-500 mb-2" />
                      <p className="text-2xl font-bold text-zinc-900">{formatPrice(stats.avg_order_value)} ₽</p>
                      <p className="text-xs text-zinc-500">Средний чек</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                      <Package className="w-5 h-5 text-purple-500 mb-2" />
                      <p className="text-2xl font-bold text-zinc-900">{stats.total_items}</p>
                      <p className="text-xs text-zinc-500">Товаров куплено</p>
                    </div>
                  </div>
                  
                  {/* Secondary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-400 mb-1">Доставлено</p>
                      <p className="font-bold text-green-600">{formatPrice(stats.delivered_total || 0)} ₽</p>
                    </div>
                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-400 mb-1">В работе</p>
                      <p className="font-bold text-orange-600">{formatPrice(stats.pending_total || 0)} ₽</p>
                    </div>
                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-400 mb-1">Видов товаров</p>
                      <p className="font-bold text-zinc-700">{stats.total_products_types || 0}</p>
                    </div>
                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                      <p className="text-xs text-zinc-400 mb-1">Клиент с</p>
                      <p className="font-bold text-zinc-700">
                        {stats.first_order_date ? new Date(stats.first_order_date).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Status breakdown */}
                  {Object.keys(stats.by_status || {}).length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-bold uppercase text-zinc-400 mb-2">По статусу</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.by_status).map(([status, count]) => (
                          <span 
                            key={status} 
                            className={`px-3 py-1 text-xs font-bold ${STATUS_COLORS[status] || 'bg-zinc-100'}`}
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
                      <p className="text-xs font-bold uppercase text-zinc-400 mb-3 flex items-center gap-1">
                        <Star className="w-3 h-3" /> Часто заказываемые товары
                      </p>
                      <div className="space-y-2">
                        {stats.favorite_products.slice(0, 3).map((product, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-zinc-50 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                                {product.article}
                              </span>
                              <span className="text-sm text-zinc-700 truncate max-w-[200px]">{product.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-zinc-900">{product.count} шт.</span>
                              <span className="text-xs text-zinc-400 ml-2">({formatPrice(product.total_spent)} ₽)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly chart */}
                  {stats.by_month && stats.by_month.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase text-zinc-400 mb-3 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> Динамика по месяцам
                      </p>
                      <div className="flex items-end gap-1 sm:gap-2 h-28 bg-zinc-50 p-3 rounded-lg">
                        {stats.by_month.map((month, idx) => {
                          const maxTotal = Math.max(...stats.by_month.map(m => m.total));
                          const heightPercent = maxTotal > 0 ? (month.total / maxTotal) * 100 : 0;
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center">
                              <p className="text-[9px] text-zinc-500 mb-1">{formatPrice(month.total)}</p>
                              <div 
                                className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t transition-all hover:from-orange-600 hover:to-orange-500 cursor-pointer"
                                style={{ height: `${Math.max(heightPercent, 8)}%`, minHeight: '8px' }}
                                title={`${month.orders} заказов на ${formatPrice(month.total)} ₽`}
                              />
                              <p className="text-[10px] text-zinc-400 mt-1">{formatMonth(month.month)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Orders List */}
            <div className="space-y-4" data-testid="orders-list">
              {orders.map((order) => (
                <div 
                  key={order.id} 
                  className="border border-zinc-200 bg-white overflow-hidden"
                  data-testid={`order-${order.id}`}
                >
                  {/* Order header */}
                  <div 
                    className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-50 cursor-pointer hover:bg-zinc-100 transition-colors"
                    onClick={() => toggleOrderExpanded(order.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-semibold text-zinc-900">
                          Заказ #{order.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-semibold text-zinc-900">
                        {formatPrice(order.total)} ₽
                      </span>
                      <span className={`px-3 py-1 text-xs font-bold uppercase ${STATUS_COLORS[order.status] || 'bg-zinc-100'}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                      {expandedOrders[order.id] ? (
                        <ChevronUp className="w-5 h-5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded order details */}
                  {expandedOrders[order.id] && (
                    <div className="p-4 border-t border-zinc-200">
                      {/* Delivery info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-zinc-500 text-xs uppercase">Получатель</p>
                          <p className="font-medium">{order.full_name}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs uppercase">Телефон</p>
                          <p className="font-medium">{order.phone}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs uppercase">Адрес</p>
                          <p className="font-medium">{order.address}</p>
                        </div>
                      </div>

                      {/* Order items with full details */}
                      <div className="border border-zinc-200 divide-y divide-zinc-100">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex gap-4 p-3">
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
                              <p className="font-medium text-zinc-900">{item.name}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                {item.manufacturer && (
                                  <p className="text-sm font-semibold text-orange-600">{item.manufacturer}</p>
                                )}
                                {item.article && (
                                  <p className="text-sm font-mono font-semibold text-zinc-600">Арт: {item.article}</p>
                                )}
                              </div>
                              <p className="text-sm text-zinc-500 mt-1">
                                {formatPrice(item.price)} ₽ × {item.quantity} шт.
                              </p>
                            </div>
                            
                            {/* Item total */}
                            <div className="text-right">
                              <p className="font-mono font-semibold">
                                {formatPrice(item.price * item.quantity)} ₽
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Order total */}
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-200">
                        <span className="text-zinc-500">Оплата: наличными при получении</span>
                        <div className="text-right">
                          <span className="text-sm text-zinc-500">Итого: </span>
                          <span className="font-mono text-xl font-bold text-zinc-900">
                            {formatPrice(order.total)} ₽
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
