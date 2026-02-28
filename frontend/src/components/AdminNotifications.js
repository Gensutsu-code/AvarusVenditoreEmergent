import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, ShoppingCart, CreditCard, Package, XCircle, MessageCircle, Wallet, ChevronRight } from 'lucide-react';
import { playNotificationSound, showPushNotification, requestNotificationPermission } from '../utils/notifications';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NOTIF_ICONS = {
  new_order: { icon: ShoppingCart, color: 'text-blue-600 bg-blue-50' },
  order: { icon: Package, color: 'text-teal-600 bg-teal-50' },
  order_change: { icon: Package, color: 'text-orange-600 bg-orange-50' },
  balance_topup: { icon: Wallet, color: 'text-green-600 bg-green-50' },
  chat: { icon: MessageCircle, color: 'text-cyan-600 bg-cyan-50' },
  cancelled: { icon: XCircle, color: 'text-red-600 bg-red-50' },
  payment: { icon: CreditCard, color: 'text-purple-600 bg-purple-50' },
};

function getIcon(type) {
  return NOTIF_ICONS[type] || { icon: Bell, color: 'text-zinc-600 bg-zinc-50' };
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

export const AdminNotifications = () => {
  const [notifList, setNotifList] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const lastSeenIdRef = useRef(null);
  const hasInitRef = useRef(false);

  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API}/admin/notifications`);
        const data = res.data;
        const notifs = data.notifications || [];
        const unread = data.unread_count || 0;

        setNotifList(notifs);
        setUnreadCount(unread);

        // On first load, just set the baseline
        if (!hasInitRef.current) {
          lastSeenIdRef.current = notifs[0]?.id || null;
          hasInitRef.current = true;
          return;
        }

        // If there's a new notification we haven't seen
        const latestId = notifs[0]?.id || null;
        if (latestId && latestId !== lastSeenIdRef.current) {
          const latest = notifs[0];
          lastSeenIdRef.current = latestId;

          playNotificationSound();
          toast.info(latest.message || latest.title, { id: `admin-${latestId}`, duration: 5000 });

          if (document.hidden) {
            showPushNotification('AVOPT.STORE — Админ', latest.message || 'Новое уведомление', { tag: 'admin-notif' });
          }
        }
      } catch (err) {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.put(`${API}/admin/notifications/${id}/read`);
      setNotifList(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  return (
    <div className="relative" ref={ref} data-testid="admin-notifications">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-zinc-100 transition-colors"
        data-testid="admin-notifications-bell"
      >
        <Bell className="w-5 h-5 text-zinc-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-zinc-200 rounded-lg shadow-xl z-50" data-testid="notifications-dropdown">
          <div className="p-3 border-b border-zinc-100 flex items-center justify-between">
            <p className="font-semibold text-sm text-zinc-800">Уведомления</p>
            {unreadCount > 0 && <span className="text-xs text-zinc-400">{unreadCount} непрочитанных</span>}
          </div>
          {notifList.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-400">
              Нет уведомлений
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-50">
              {notifList.slice(0, 15).map((n) => {
                const { icon: Icon, color } = getIcon(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={(e) => { if (!n.read) handleMarkRead(n.id, e); setOpen(false); if (n.link) navigate(n.link); }}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 hover:bg-zinc-50 transition-colors text-left ${!n.read ? 'bg-blue-50/40' : ''}`}
                    data-testid={`notification-item-${n.id}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!n.read ? 'font-medium text-zinc-800' : 'text-zinc-600'}`}>{n.message || n.title}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />}
                  </button>
                );
              })}
            </div>
          )}
          <div className="p-2 border-t border-zinc-100">
            <button
              onClick={() => { setOpen(false); navigate('/admin/notifications'); }}
              className="w-full flex items-center justify-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium py-1.5 rounded-lg hover:bg-teal-50 transition"
              data-testid="view-all-notifications"
            >
              Все уведомления <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
