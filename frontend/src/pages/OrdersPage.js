import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState({});

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchOrders();
  }, [user, navigate]);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/orders`);
      setOrders(res.data);
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

  if (!user) return null;

  return (
    <div className="min-h-screen" data-testid="orders-page">
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
          <div className="text-center py-16 border border-zinc-200" data-testid="no-orders">
            <Package className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 text-lg mb-4">У вас пока нет заказов</p>
            <Link to="/catalog">
              <Button className="bg-orange-500 hover:bg-orange-600">
                Перейти в каталог
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4" data-testid="orders-list">
            {orders.map((order) => (
              <div 
                key={order.id} 
                className="border border-zinc-200 overflow-hidden"
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
        )}
      </div>
    </div>
  );
}
