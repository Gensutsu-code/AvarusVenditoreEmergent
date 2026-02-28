import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Check, CheckCheck, Package, MessageCircle, UserPlus, TrendingUp, XCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_CONFIG = {
  new_order: { icon: Package, color: 'bg-blue-100 text-blue-600', label: 'Заказ' },
  chat: { icon: MessageCircle, color: 'bg-indigo-100 text-indigo-600', label: 'Чат' },
  registration: { icon: UserPlus, color: 'bg-green-100 text-green-600', label: 'Регистрация' },
  order_accepted: { icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600', label: 'Принято' },
  order_cancelled: { icon: XCircle, color: 'bg-rose-100 text-rose-600', label: 'Отмена' },
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

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/login'); return; }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/admin/notifications`);
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {} finally { setLoading(false); }
  };

  const markAsRead = async (notifId) => {
    try {
      await axios.put(`${API}/admin/notifications/${notifId}/read`);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const markAllRead = async () => {
    try {
      await axios.post(`${API}/admin/notifications/mark-read`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {}
  };

  const handleClick = (notif) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-notifications-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Панель управления
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight uppercase text-slate-800">Уведомления</h1>
                <p className="text-sm text-slate-500">{unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Все прочитано'}</p>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} className="border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl">
                <CheckCheck className="w-4 h-4 mr-2" /> Прочитать все
              </Button>
            )}
          </div>
        </motion.div>

        <div className="flex gap-2 mb-6">
          {['all', 'unread'].map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}
              className={`rounded-xl ${filter === f ? 'bg-slate-800 border-0' : 'border-slate-200'}`}>
              {f === 'all' ? `Все (${notifications.length})` : `Непрочитанные (${unreadCount})`}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {filtered.length === 0 ? (
              <motion.div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500">{filter === 'unread' ? 'Нет непрочитанных' : 'Уведомлений пока нет'}</p>
              </motion.div>
            ) : (
              filtered.map((notif, index) => {
                const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
                const Icon = config.icon;
                return (
                  <motion.div key={notif.id}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${!notif.read ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200/50'}`}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.03 }}
                    onClick={() => handleClick(notif)} data-testid={`admin-notif-${notif.id}`}>
                    <div className="p-4 flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`text-sm text-slate-800 ${!notif.read ? 'font-bold' : 'font-medium'}`}>{notif.title}</h3>
                              {!notif.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">{notif.message}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-lg flex-shrink-0 ${config.color}`}>{config.label}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-400">{formatTime(notif.created_at)}</span>
                          {!notif.read && (
                            <button onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                              className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Прочитано
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
