import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Check, CheckCheck, Package, Gift, CreditCard, AlertCircle, Megaphone, ArrowLeft, MessageCircle, Wallet, TrendingUp, UserPlus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_CONFIG = {
  order: { icon: Package, color: 'bg-blue-100 text-blue-600', label: 'Заказ' },
  order_change: { icon: TrendingUp, color: 'bg-orange-100 text-orange-600', label: 'Изменение' },
  bonus: { icon: Gift, color: 'bg-purple-100 text-purple-600', label: 'Бонус' },
  payment: { icon: CreditCard, color: 'bg-green-100 text-green-600', label: 'Оплата' },
  balance: { icon: Wallet, color: 'bg-teal-100 text-teal-600', label: 'Баланс' },
  chat: { icon: MessageCircle, color: 'bg-indigo-100 text-indigo-600', label: 'Чат' },
  news: { icon: Megaphone, color: 'bg-pink-100 text-pink-600', label: 'Новость' },
  promo: { icon: Megaphone, color: 'bg-pink-100 text-pink-600', label: 'Акция' },
  status_response: { icon: UserPlus, color: 'bg-cyan-100 text-cyan-600', label: 'Статус' },
  discount_response: { icon: CreditCard, color: 'bg-emerald-100 text-emerald-600', label: 'Скидка' },
  system: { icon: AlertCircle, color: 'bg-amber-100 text-amber-600', label: 'Система' },
};

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Только что';
  if (minutes < 60) return `${minutes} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  if (days < 7) return `${days} дн назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [user, authLoading, navigate]);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/my-notifications`);
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notifId) => {
    try {
      await axios.put(`${API}/my-notifications/${notifId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notifId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API}/my-notifications/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) { console.error(err); }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 flex items-center justify-center">
        <motion.div 
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500">Загрузка уведомлений...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20" data-testid="notifications-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button 
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Назад
          </button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                  Уведомления
                </h1>
                <p className="text-sm text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Все прочитано'}
                </p>
              </div>
            </div>
            
            {unreadCount > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={markAllRead}
                className="border-teal-200 text-teal-600 hover:bg-teal-50 hover:border-teal-300 rounded-xl"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Прочитать все
              </Button>
            )}
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div 
          className="flex gap-2 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className={`rounded-xl ${filter === 'all' ? 'bg-gradient-to-r from-teal-500 to-emerald-500 border-0' : 'border-slate-200'}`}
          >
            Все ({notifications.length})
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('unread')}
            className={`rounded-xl ${filter === 'unread' ? 'bg-gradient-to-r from-teal-500 to-emerald-500 border-0' : 'border-slate-200'}`}
          >
            Непрочитанные ({unreadCount})
          </Button>
        </motion.div>

        {/* Notifications List */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredNotifications.length === 0 ? (
              <motion.div 
                className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-12 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500">
                  {filter === 'unread' ? 'Нет непрочитанных уведомлений' : 'Уведомлений пока нет'}
                </p>
              </motion.div>
            ) : (
              filteredNotifications.map((notif, index) => {
                const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={notif.id}
                    className={`bg-white/80 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md ${
                      !notif.read 
                        ? 'border-teal-200 bg-teal-50/30' 
                        : 'border-slate-200/50'
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onClick={() => handleNotificationClick(notif)}
                    data-testid={`notification-${notif.id}`}
                  >
                    <div className="p-4 flex items-start gap-4">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold text-slate-800 ${!notif.read ? 'font-bold' : ''}`}>
                                {notif.title}
                              </h3>
                              {!notif.read && (
                                <span className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{notif.message}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-lg flex-shrink-0 ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-slate-400">{formatTime(notif.created_at)}</span>
                          {!notif.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notif.id);
                              }}
                              className="text-xs text-teal-500 hover:text-teal-600 flex items-center gap-1 transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              Прочитано
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
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
