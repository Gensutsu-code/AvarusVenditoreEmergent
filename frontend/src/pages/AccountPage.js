import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Package, Pencil, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

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

export default function AccountPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [expandedOrders, setExpandedOrders] = useState({});

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    setProfileForm({
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || ''
    });
    fetchOrders();
  }, [user, navigate]);

  const toggleOrderExpanded = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

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

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/auth/profile`, profileForm);
      toast.success('Профиль обновлён');
      setIsEditing(false);
      // Refresh user data in context
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setProfileForm({
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || ''
    });
    setIsEditing(false);
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen" data-testid="account-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900">
            Личный кабинет
          </h1>
        </div>

        {/* User info */}
        <div className="border border-zinc-200 p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-100 flex items-center justify-center">
                <User className="w-6 h-6 text-zinc-400" />
              </div>
              {!isEditing && (
                <div>
                  <h2 className="font-semibold text-zinc-900" data-testid="user-name">{user.name}</h2>
                  <p className="text-sm text-zinc-500" data-testid="user-email">{user.email}</p>
                  {user.phone && <p className="text-sm text-zinc-500">{user.phone}</p>}
                  {user.address && <p className="text-sm text-zinc-500">{user.address}</p>}
                </div>
              )}
            </div>
            {!isEditing && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsEditing(true)}
                data-testid="edit-profile-btn"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Редактировать
              </Button>
            )}
          </div>

          {isEditing && (
            <div className="space-y-4" data-testid="profile-edit-form">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Имя</Label>
                <Input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Ваше имя"
                  className="mt-1"
                  data-testid="profile-name-input"
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Телефон</Label>
                <Input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+7 (___) ___-__-__"
                  className="mt-1"
                  data-testid="profile-phone-input"
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Адрес доставки</Label>
                <Input
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  placeholder="Город, улица, дом, квартира"
                  className="mt-1"
                  data-testid="profile-address-input"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={saving}
                  className="bg-orange-500 hover:bg-orange-600"
                  data-testid="save-profile-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </Button>
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Orders */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
            История заказов
          </h2>

          {loading ? (
            <div className="text-center py-12 text-zinc-500">Загрузка...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 border border-zinc-200" data-testid="no-orders">
              <Package className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
              <p className="text-zinc-500 mb-4">У вас пока нет заказов</p>
              <Link to="/catalog">
                <span className="text-orange-500 hover:text-orange-600 font-semibold">
                  Перейти в каталог
                </span>
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
    </div>
  );
}
