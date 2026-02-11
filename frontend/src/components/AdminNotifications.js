import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, ArrowUpCircle, Percent, Gift, Award, ShoppingCart, MessageCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AdminNotifications = () => {
  const [notifications, setNotifications] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API}/admin/notifications`);
        setNotifications(res.data);
      } catch (err) {
        // Not admin or error
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!notifications) return null;

  const total = notifications.total || 0;

  const items = [
    { key: 'new_orders', label: 'Новые заказы', icon: ShoppingCart, count: notifications.new_orders, color: 'text-blue-600 bg-blue-50', path: '/admin', tab: 'orders' },
    { key: 'status_requests', label: 'Запросы на статус', icon: ArrowUpCircle, count: notifications.status_requests, color: 'text-purple-600 bg-purple-50', path: '/admin', tab: 'discounts' },
    { key: 'discount_requests', label: 'Запросы на скидку', icon: Percent, count: notifications.discount_requests, color: 'text-green-600 bg-green-50', path: '/admin', tab: 'discounts' },
    { key: 'bonus_requests', label: 'Запросы на бонус', icon: Gift, count: notifications.bonus_requests, color: 'text-orange-600 bg-orange-50', path: '/admin', tab: 'bonus' },
    { key: 'prize_requests', label: 'Запросы на приз', icon: Award, count: notifications.prize_requests, color: 'text-amber-600 bg-amber-50', path: '/admin', tab: 'bonus' },
    { key: 'unread_chats', label: 'Сообщения в чате', icon: MessageCircle, count: notifications.unread_chats, color: 'text-cyan-600 bg-cyan-50', path: '/admin', tab: 'chat' },
  ];

  const activeItems = items.filter(i => i.count > 0);

  const handleItemClick = (item) => {
    setOpen(false);
    navigate(`${item.path}?tab=${item.tab}`);
  };

  return (
    <div className="relative" ref={ref} data-testid="admin-notifications">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-zinc-100 transition-colors"
        data-testid="admin-notifications-bell"
      >
        <Bell className="w-5 h-5 text-zinc-600" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center font-bold rounded-full px-1">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-zinc-200 rounded-lg shadow-xl z-50" data-testid="notifications-dropdown">
          <div className="p-3 border-b border-zinc-100">
            <p className="font-semibold text-sm text-zinc-800">Уведомления</p>
          </div>
          {activeItems.length === 0 ? (
            <div className="p-4 text-center text-sm text-zinc-400">
              Нет новых уведомлений
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {activeItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleItemClick(item)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 transition-colors text-left"
                  data-testid={`notification-${item.key}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.color}`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{item.label}</p>
                  </div>
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
