import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Package, Percent, ArrowUpCircle, Gift, Check } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_CONFIG = {
  order: { icon: Package, color: 'text-blue-600 bg-blue-50' },
  order_status: { icon: Package, color: 'text-green-600 bg-green-50' },
  status_response: { icon: ArrowUpCircle, color: 'text-purple-600 bg-purple-50' },
  discount_response: { icon: Percent, color: 'text-amber-600 bg-amber-50' },
  prize_response: { icon: Gift, color: 'text-pink-600 bg-pink-50' },
};

export const ClientNotifications = ({ onClose }) => {
  const [data, setData] = useState({ notifications: [], unread_count: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/my-notifications`);
      setData(res.data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    try {
      await axios.put(`${API}/my-notifications/read-all`);
      setData(prev => ({
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, read: true })),
        unread_count: 0
      }));
    } catch (err) {}
  };

  const handleClick = async (notif) => {
    // Mark as read if not already
    if (!notif.read) {
      try {
        await axios.put(`${API}/my-notifications/${notif.id}/read`);
        setData(prev => ({
          ...prev,
          notifications: prev.notifications.map(n => 
            n.id === notif.id ? { ...n, read: true } : n
          ),
          unread_count: Math.max(0, prev.unread_count - 1)
        }));
      } catch (err) {}
    }
    setOpen(false);
    if (notif.link) navigate(notif.link);
  };

  const formatTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = (now - d) / 1000;
      if (diff < 60) return 'только что';
      if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
      return d.toLocaleDateString('ru-RU');
    } catch { return ''; }
  };

  return (
    <div className="relative" ref={ref} data-testid="client-notifications">
      <button 
        onClick={() => setOpen(!open)} 
        className="relative p-2.5 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-500 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-110" 
        data-testid="client-notifications-bell"
      >
        <Bell className="w-4 h-4" />
        {data.unread_count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[16px] h-[16px] flex items-center justify-center font-bold rounded-full px-1">
            {data.unread_count > 99 ? '99+' : data.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl z-50" data-testid="client-notifications-dropdown">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <p className="font-semibold text-sm text-slate-800">Уведомления</p>
            {data.unread_count > 0 && (
              <button onClick={markAllRead} className="text-xs text-teal-500 hover:text-teal-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> Прочитать все
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {data.notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">Нет уведомлений</div>
            ) : (
              data.notifications.slice(0, 20).map(notif => {
                const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.order;
                const Icon = config.icon;
                return (
                  <button key={notif.id} onClick={() => handleClick(notif)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left ${!notif.read ? 'bg-teal-50/50' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.read ? 'font-semibold' : 'font-medium'} text-slate-800`}>{notif.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{notif.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{formatTime(notif.created_at)}</p>
                    </div>
                    {!notif.read && <div className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0 mt-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
