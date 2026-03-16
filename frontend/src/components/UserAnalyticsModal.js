import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { X, Eye, Search, MousePointerClick, Clock, Activity, BarChart3, Globe, Monitor, Smartphone, Wifi, MapPin, Shield } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatDuration = (seconds) => {
  if (!seconds || seconds < 1) return '0с';
  if (seconds < 60) return `${seconds}с`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}м ${s}с` : `${m}м`;
  const h = Math.floor(m / 60);
  return `${h}ч ${m % 60}м`;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const PAGE_LABELS = {
  '/': 'Главная', '/catalog': 'Каталог', '/cart': 'Корзина', '/checkout': 'Оформление',
  '/orders': 'Заказы', '/favorites': 'Избранное', '/account': 'Профиль',
  '/bonus': 'Бонусы', '/news': 'Новости', '/chat': 'Чат', '/notifications': 'Уведомления',
};
const getPageLabel = (page) => PAGE_LABELS[page] || page;

const DeviceIcon = ({ device }) => {
  if (device === 'Mobile') return <Smartphone className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

const SessionCard = ({ session }) => {
  const geo = session.geo || {};
  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
      {/* Device & Browser row */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
          <DeviceIcon device={session.device} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-800 text-sm">{session.browser} {session.browser_version}</p>
          <p className="text-xs text-slate-500">{session.os} {session.os_version} · {session.device}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-600">{session.visit_count || 1} визитов</p>
          <p className="text-xs text-slate-400">{formatTime(session.last_seen)}</p>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
          <Globe className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
          <div>
            <p className="text-slate-400">IP</p>
            <p className="font-mono text-slate-700">{session.ip}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
          <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          <div>
            <p className="text-slate-400">Местоположение</p>
            <p className="text-slate-700">{geo.city ? `${geo.city}, ${geo.country}` : 'Неизвестно'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
          <Monitor className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-slate-400">Экран</p>
            <p className="text-slate-700">{session.screen_resolution || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
          <Eye className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
          <div>
            <p className="text-slate-400">Viewport</p>
            <p className="text-slate-700">{session.viewport || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
          <Globe className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-slate-400">Язык / Зона</p>
            <p className="text-slate-700">{session.language} · {session.timezone || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
          <Wifi className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          <div>
            <p className="text-slate-400">Сеть / Память</p>
            <p className="text-slate-700">{session.connection_type || '—'} · {session.memory ? `${session.memory}GB` : '—'} · {session.cores || '—'} ядер</p>
          </div>
        </div>
      </div>

      {/* Extra details */}
      <div className="flex flex-wrap gap-1.5">
        {session.touch_support && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-xs">Тач</span>}
        {session.cookie_enabled && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-xs">Cookies</span>}
        {session.do_not_track && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs">DNT</span>}
        {session.platform && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{session.platform}</span>}
        {geo.isp && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">{geo.isp}</span>}
      </div>

      {session.referer && (
        <p className="text-xs text-slate-400">Referer: <span className="text-slate-600">{session.referer}</span></p>
      )}
    </div>
  );
};

export default function UserAnalyticsModal({ userId, userName, open, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('sessions');

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    axios.get(`${API}/admin/users/${userId}/analytics`)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, userId]);

  if (!open) return null;

  const tabs = [
    { id: 'sessions', label: 'Устройства', icon: Shield },
    { id: 'pages', label: 'Страницы', icon: Eye },
    { id: 'searches', label: 'Поиск', icon: Search },
    { id: 'clicks', label: 'Клики', icon: MousePointerClick },
    { id: 'recent', label: 'Последние', icon: Activity },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
          data-testid="user-analytics-modal"
        >
          <div className="p-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{userName || 'Клиент'}</h2>
                <p className="text-slate-300 text-sm">Аналитика и данные</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data ? (
            <div className="flex-1 flex items-center justify-center p-12 text-slate-400">Нет данных</div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2 p-4 bg-slate-50 border-b border-slate-200 flex-shrink-0">
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
                  <p className="text-lg font-bold text-blue-600">{data.sessions?.length || 0}</p>
                  <p className="text-xs text-slate-400">Сессий</p>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
                  <p className="text-lg font-bold text-indigo-600">{data.summary.total_page_views}</p>
                  <p className="text-xs text-slate-400">Просмотров</p>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
                  <p className="text-lg font-bold text-teal-600">{formatDuration(data.summary.total_time_seconds)}</p>
                  <p className="text-xs text-slate-400">На сайте</p>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
                  <p className="text-lg font-bold text-violet-600">{data.summary.total_searches}</p>
                  <p className="text-xs text-slate-400">Запросов</p>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
                  <p className="text-lg font-bold text-orange-600">{data.summary.total_clicks}</p>
                  <p className="text-xs text-slate-400">Кликов</p>
                </div>
              </div>

              <div className="flex gap-1 px-4 pt-3 flex-shrink-0 overflow-x-auto">
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${tab === t.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {tab === 'sessions' && (
                  <div className="space-y-3">
                    {(!data.sessions || data.sessions.length === 0) ? (
                      <p className="text-slate-400 text-sm text-center py-6">Нет данных о сессиях. Данные появятся после следующего визита пользователя.</p>
                    ) : data.sessions.map((s, i) => <SessionCard key={i} session={s} />)}
                  </div>
                )}

                {tab === 'pages' && (
                  <div className="space-y-2">
                    {data.pages.length === 0 ? <p className="text-slate-400 text-sm text-center py-6">Нет данных</p> :
                      data.pages.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                          <Eye className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700 text-sm truncate">{getPageLabel(p.page)}</p>
                            <p className="text-xs text-slate-400">{formatTime(p.last_visit)}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-right flex-shrink-0">
                            <span className="text-blue-600 font-semibold">{p.visits}x</span>
                            <span className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(p.avg_duration)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {tab === 'searches' && (
                  <div className="space-y-2">
                    {data.searches.length === 0 ? <p className="text-slate-400 text-sm text-center py-6">Нет поисковых запросов</p> :
                      data.searches.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                          <Search className="w-4 h-4 text-violet-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700 text-sm">{s.query}</p>
                            <p className="text-xs text-slate-400">{formatTime(s.last_searched)}</p>
                          </div>
                          <span className="text-violet-600 font-semibold text-sm">{s.count}x</span>
                        </div>
                      ))}
                  </div>
                )}

                {tab === 'clicks' && (
                  <div className="space-y-2">
                    {data.clicks.length === 0 ? <p className="text-slate-400 text-sm text-center py-6">Нет данных о кликах</p> :
                      data.clicks.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                          <MousePointerClick className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700 text-sm">{c.element}</p>
                            <p className="text-xs text-slate-400">{getPageLabel(c.page)} · {formatTime(c.last_click)}</p>
                          </div>
                          <span className="text-orange-600 font-semibold text-sm">{c.count}x</span>
                        </div>
                      ))}
                  </div>
                )}

                {tab === 'recent' && (
                  <div className="space-y-2">
                    {data.recent_activity.length === 0 ? <p className="text-slate-400 text-sm text-center py-6">Нет активности</p> :
                      data.recent_activity.map((ev, i) => {
                        const typeIcon = { page_view: Eye, search: Search, button_click: MousePointerClick }[ev.event_type] || Activity;
                        const TypeIcon = typeIcon;
                        const typeColor = { page_view: 'text-blue-500', search: 'text-violet-500', button_click: 'text-orange-500' }[ev.event_type] || 'text-slate-400';
                        const label = ev.event_type === 'page_view' ? getPageLabel(ev.page) :
                          ev.event_type === 'search' ? `Поиск: ${ev.query}` : ev.element;
                        return (
                          <div key={i} className="flex items-center gap-3 p-2 rounded-lg text-sm">
                            <TypeIcon className={`w-3.5 h-3.5 flex-shrink-0 ${typeColor}`} />
                            <span className="text-slate-600 flex-1 truncate">{label}</span>
                            {ev.duration > 0 && <span className="text-xs text-slate-400">{formatDuration(ev.duration)}</span>}
                            <span className="text-xs text-slate-400 flex-shrink-0">{formatTime(ev.created_at)}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
