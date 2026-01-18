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
                  className="border border-zinc-200 p-6"
                  data-testid={`order-${order.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-sm text-zinc-500">
                        Заказ от {formatDate(order.created_at)}
                      </p>
                      <p className="text-xs font-mono text-zinc-400">
                        #{order.id.slice(0, 8)}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-bold uppercase ${STATUS_COLORS[order.status] || 'bg-zinc-100'}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-zinc-600">
                          {item.name} × {item.quantity}
                        </span>
                        <span className="font-mono">
                          {formatPrice(item.price * item.quantity)} ₽
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-zinc-200 pt-4 flex justify-between items-center">
                    <span className="font-semibold text-zinc-900">Итого:</span>
                    <span className="price-tag text-lg text-zinc-900">
                      {formatPrice(order.total)} ₽
                    </span>
                  </div>

                  <div className="mt-4 text-sm text-zinc-500">
                    <p>Получатель: {order.full_name}</p>
                    <p>Адрес: {order.address}</p>
                    <p>Телефон: {order.phone}</p>
                    <p>Оплата: наличными при получении</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
