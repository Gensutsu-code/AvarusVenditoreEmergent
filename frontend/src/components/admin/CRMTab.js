import { useState, useEffect } from 'react';
import { Users, BarChart3, TrendingUp, Calendar, UserCheck, Pencil, Trash2, ChevronDown, User, ShoppingBag, Package, Clock, DollarSign, Target, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Sub-tab component for CRM section (Analytics + Clients)
export const CRMTab = ({
  users,
  stats,
  formatPrice,
  handleEditUser,
  handleDeleteUser,
  isDark = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState('clients');
  const [expandedUser, setExpandedUser] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('month');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Fetch analytics data
  useEffect(() => {
    if (activeSubTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeSubTab, statsPeriod]);

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await axios.get(`${API}/admin/analytics/detailed?period=${statsPeriod}`);
      setAnalyticsData(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const subTabs = [
    { id: 'clients', label: 'Клиенты', icon: Users },
    { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
  ];

  // Customer role colors
  const getStatusColor = (role) => {
    if (isDark) {
      return role === 'admin' ? 'bg-teal-500/20 text-teal-400' : 'bg-emerald-500/20 text-emerald-400';
    }
    return role === 'admin' ? 'bg-teal-100 text-teal-700' : 'bg-emerald-100 text-emerald-700';
  };

  const getStatusLabel = (role) => {
    return role === 'admin' ? 'Администратор' : 'Клиент';
  };

  const toggleUserExpand = (userId) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className={`flex gap-2 border-b pb-4 ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSubTab === tab.id
                  ? isDark 
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' 
                    : 'bg-teal-500 text-white'
                  : isDark
                    ? 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 border border-zinc-700/50'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'clients' && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${isDark ? 'bg-zinc-700/50' : 'bg-white/20'}`}>
                  {users.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Clients List */}
      {activeSubTab === 'clients' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className={`p-4 rounded-xl ${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-100'}`}>
              <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                <UserCheck className="w-4 h-4" />
                <span className="text-xs font-medium">Всего клиентов</span>
              </div>
              <p className={`text-2xl font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>{users.filter(u => u.role !== 'admin').length}</p>
            </div>
          </div>

          {/* Users list - Card style */}
          <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50' : 'border border-zinc-200 bg-white'}`}>
            {users.filter(u => u.role !== 'admin').map((user) => (
              <div key={user.id}>
                {/* User card header */}
                <div 
                  onClick={() => toggleUserExpand(user.id)}
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                    expandedUser === user.id 
                      ? isDark ? 'bg-teal-500/10 border-b border-teal-500/20' : 'bg-teal-50 border-b border-teal-200'
                      : isDark ? 'hover:bg-zinc-700/30 border-b border-zinc-700' : 'hover:bg-zinc-50 border-b border-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isDark ? 'bg-zinc-700' : 'bg-zinc-100'}`}>
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className={`w-5 h-5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                      )}
                    </div>
                    {/* Name and email */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isDark ? 'text-zinc-100' : ''}`}>
                          {user.name || 'Без имени'}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${getStatusColor(user.role)}`}>
                          {getStatusLabel(user.role)}
                        </span>
                      </div>
                      <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                  
                  {/* Right side - orders info and actions */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={`font-mono font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        {user.orders_count || 0} заказов
                      </p>
                      <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        {formatPrice(user.total_spent || 0)} ₽
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleEditUser && handleEditUser(user); }}
                        data-testid={`edit-user-${user.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={(e) => { e.stopPropagation(); handleDeleteUser && handleDeleteUser(user.id); }}
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${expandedUser === user.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>
                
                {/* Expanded details - Full user card */}
                <AnimatePresence>
                  {expandedUser === user.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`overflow-hidden ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-50'}`}
                    >
                      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1 - Personal Data */}
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
                          <h4 className={`text-sm font-bold uppercase mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            <User className="w-4 h-4" />
                            Личные данные
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>ФИО:</span>
                              <span className={`text-sm font-medium text-right ${isDark ? 'text-zinc-200' : ''}`}>{user.name || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Email:</span>
                              <span className={`text-sm font-medium text-teal-500`}>{user.email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Пароль:</span>
                              <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : ''}`}>••••••••</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Телефон:</span>
                              <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : ''}`}>{user.phone || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Адрес:</span>
                              <span className={`text-sm font-medium text-right max-w-[150px] truncate ${isDark ? 'text-zinc-200' : ''}`}>{user.address || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Роль:</span>
                              <span className={`text-sm font-bold ${isDark ? 'text-zinc-200' : ''}`}>{getStatusLabel(user.role)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Дата регистрации:</span>
                              <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : ''}`}>
                                {user.created_at ? new Date(user.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Column 2 - Order Statistics */}
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
                          <h4 className={`text-sm font-bold uppercase mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            <ShoppingBag className="w-4 h-4" />
                            Статистика заказов
                          </h4>
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                              <p className="text-2xl font-bold text-teal-500">{user.orders_count || 0}</p>
                              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Заказов</p>
                            </div>
                            <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                              <p className="text-xl font-bold text-green-500">{formatPrice(user.total_spent || 0)} ₽</p>
                              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Потрачено</p>
                            </div>
                            <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                              <p className="text-xl font-bold text-blue-500">{formatPrice(user.orders_count > 0 ? Math.round((user.total_spent || 0) / user.orders_count) : 0)} ₽</p>
                              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Средний чек</p>
                            </div>
                            <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                              <p className="text-2xl font-bold text-emerald-500">{user.total_items || 0}</p>
                              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Товаров</p>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>Баланс:</span>
                              <span className={`font-medium ${isDark ? 'text-zinc-200' : ''}`}>{formatPrice(user.balance || 0)} ₽</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>Бонусы:</span>
                              <span className={`font-medium ${isDark ? 'text-zinc-200' : ''}`}>{user.bonus_balance || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>Первый заказ:</span>
                              <span className={`font-medium ${isDark ? 'text-zinc-200' : ''}`}>{user.first_order_date ? new Date(user.first_order_date).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>Последний заказ:</span>
                              <span className={`font-medium ${isDark ? 'text-zinc-200' : ''}`}>{user.last_order_date ? new Date(user.last_order_date).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Column 3 - Popular Products & Recent Orders */}
                        <div className="space-y-4">
                          {/* Popular Products */}
                          <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
                            <h4 className={`text-sm font-bold uppercase mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                              <Package className="w-4 h-4" />
                              Популярные товары
                            </h4>
                            {user.popular_products && user.popular_products.length > 0 ? (
                              <div className="space-y-2">
                                {user.popular_products.slice(0, 3).map((product, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-teal-500 font-mono text-xs">{product.sku || '—'}</span>
                                      <span className={`truncate ${isDark ? 'text-zinc-300' : ''}`}>{product.name}</span>
                                    </div>
                                    <span className={`ml-2 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{product.quantity} шт.</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className={`text-sm ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Нет данных</p>
                            )}
                          </div>

                          {/* Recent Orders */}
                          <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
                            <h4 className={`text-sm font-bold uppercase mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                              <Clock className="w-4 h-4" />
                              Последние заказы
                            </h4>
                            {user.recent_orders && user.recent_orders.length > 0 ? (
                              <div className="space-y-2">
                                {user.recent_orders.slice(0, 3).map((order, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>#{order.id?.slice(-8) || '—'}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                        order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {order.status === 'completed' ? 'выполнен' :
                                         order.status === 'cancelled' ? 'отменён' :
                                         order.status === 'processing' ? 'в работе' : 'ожидает'}
                                      </span>
                                    </div>
                                    <span className={isDark ? 'text-zinc-300' : ''}>{formatPrice(order.total || 0)} ₽</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className={`text-sm ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Нет заказов</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            
            {users.filter(u => u.role !== 'admin').length === 0 && (
              <div className={`p-8 text-center ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Клиентов пока нет</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Analytics */}
      {activeSubTab === 'analytics' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Period selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className={`w-5 h-5 ${isDark ? 'text-zinc-500' : 'text-teal-500'}`} />
              <Select value={statsPeriod} onValueChange={setStatsPeriod}>
                <SelectTrigger className={`w-48 ${isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-slate-200'}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Неделя</SelectItem>
                  <SelectItem value="month">Месяц</SelectItem>
                  <SelectItem value="quarter">Квартал</SelectItem>
                  <SelectItem value="year">Год</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalytics}
              disabled={loadingAnalytics}
              className={isDark ? 'border-zinc-700' : ''}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loadingAnalytics ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>

          {loadingAnalytics && !analyticsData ? (
            <div className={`p-12 text-center ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Загрузка аналитики...</p>
            </div>
          ) : analyticsData ? (
            <>
              {/* Main Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div 
                  className={`p-5 rounded-xl ${isDark ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-gradient-to-br from-teal-500/10 to-teal-500/5 border border-teal-100'}`}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingBag className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <p className={`text-sm font-medium ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Заказов</p>
                  </div>
                  <p className={`text-3xl font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{analyticsData.summary?.total_orders || 0}</p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>выполнено: {analyticsData.summary?.completed_orders || 0}</p>
                </motion.div>
                <motion.div 
                  className={`p-5 rounded-xl ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-100'}`}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <p className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Выручка</p>
                  </div>
                  <p className={`text-2xl font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{formatPrice(analyticsData.summary?.total_revenue || 0)} ₽</p>
                </motion.div>
                <motion.div 
                  className={`p-5 rounded-xl ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-100'}`}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Target className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <p className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Средний чек</p>
                  </div>
                  <p className={`text-2xl font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{formatPrice(analyticsData.summary?.avg_order_value || 0)} ₽</p>
                </motion.div>
                <motion.div 
                  className={`p-5 rounded-xl ${isDark ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-100'}`}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Users className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                    <p className={`text-sm font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>Новых клиентов</p>
                  </div>
                  <p className={`text-3xl font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{analyticsData.summary?.new_customers || 0}</p>
                </motion.div>
              </div>

              {/* Conversion Rate */}
              <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                    <TrendingUp className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
                    Конверсия
                  </h3>
                  <span className={`text-2xl font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{analyticsData.summary?.conversion_rate || 0}%</span>
                </div>
                <div className={`w-full rounded-full h-3 ${isDark ? 'bg-zinc-700' : 'bg-slate-200'}`}>
                  <motion.div 
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 h-3 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(analyticsData.summary?.conversion_rate || 0, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                <p className={`text-xs mt-2 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Процент выполненных заказов от общего числа</p>
              </div>

              {/* Orders by Status */}
              <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200'}`}>
                <h3 className={`font-semibold flex items-center gap-2 mb-4 ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                  <BarChart3 className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
                  Заказы по статусам
                </h3>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { key: 'new', label: 'Новые', color: 'bg-yellow-500', count: analyticsData.orders_by_status?.new || 0 },
                    { key: 'processing', label: 'В работе', color: 'bg-blue-500', count: analyticsData.orders_by_status?.processing || 0 },
                    { key: 'shipped', label: 'Отправлен', color: 'bg-purple-500', count: analyticsData.orders_by_status?.shipped || 0 },
                    { key: 'delivered', label: 'Доставлен', color: 'bg-green-500', count: analyticsData.orders_by_status?.delivered || 0 },
                    { key: 'cancelled', label: 'Отменён', color: 'bg-red-500', count: analyticsData.orders_by_status?.cancelled || 0 },
                  ].map(status => (
                    <motion.div 
                      key={status.key}
                      className={`text-center p-3 rounded-xl ${isDark ? 'bg-zinc-700/50' : 'bg-slate-50'}`}
                      whileHover={{ scale: 1.05 }}
                    >
                      <div className={`w-3 h-3 ${status.color} rounded-full mx-auto mb-2`} />
                      <p className={`text-2xl font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{status.count}</p>
                      <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>{status.label}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Top Products */}
                <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200'}`}>
                  <h3 className={`font-semibold flex items-center gap-2 mb-4 ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                    <Package className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
                    Топ товаров
                  </h3>
                  {analyticsData.top_products && analyticsData.top_products.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsData.top_products.slice(0, 5).map((product, index) => (
                        <motion.div 
                          key={product._id || index} 
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700/50' : 'hover:bg-slate-50'}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br from-teal-500 to-emerald-500 text-white">
                            {index + 1}
                          </span>
                          <span className={`flex-1 truncate ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{product.name || '—'}</span>
                          <span className={`font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{product.quantity || 0} шт.</span>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-center py-4 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Нет данных</p>
                  )}
                </div>

                {/* Top Customers */}
                <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200'}`}>
                  <h3 className={`font-semibold flex items-center gap-2 mb-4 ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                    <Users className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
                    Топ клиентов
                  </h3>
                  {analyticsData.top_customers && analyticsData.top_customers.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsData.top_customers.slice(0, 5).map((customer, index) => (
                        <motion.div 
                          key={customer.user_id || index} 
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700/50' : 'hover:bg-slate-50'}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>{customer.name || '—'}</p>
                            <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{customer.email}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatPrice(customer.total_spent || 0)} ₽</p>
                            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{customer.orders_count} заказов</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-center py-4 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Нет данных</p>
                  )}
                </div>
              </div>

              {/* Sales Chart (simple bar representation) */}
              {analyticsData.sales_by_day && analyticsData.sales_by_day.length > 0 && (
                <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200'}`}>
                  <h3 className={`font-semibold flex items-center gap-2 mb-4 ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                    <BarChart3 className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
                    Продажи по дням
                  </h3>
                  <div className="flex items-end gap-1 h-32">
                    {analyticsData.sales_by_day.slice(-14).map((day, index) => {
                      const maxRevenue = Math.max(...analyticsData.sales_by_day.map(d => d.revenue || 0), 1);
                      const height = ((day.revenue || 0) / maxRevenue) * 100;
                      return (
                        <motion.div
                          key={index}
                          className="flex-1 flex flex-col items-center gap-1"
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <motion.div 
                            className="w-full bg-gradient-to-t from-teal-500 to-emerald-400 rounded-t-sm cursor-pointer"
                            style={{ height: `${Math.max(height, 4)}%` }}
                            whileHover={{ scale: 1.1 }}
                            title={`${day.date}: ${formatPrice(day.revenue || 0)} ₽`}
                          />
                          <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{day.date}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={`p-12 text-center ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Нет данных для отображения</p>
              <Button onClick={fetchAnalytics} variant="outline" size="sm" className="mt-4">
                Загрузить аналитику
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default CRMTab;
