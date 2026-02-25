import { useState } from 'react';
import { Users, BarChart3, TrendingUp, Calendar, UserCheck, Pencil, Trash2, ChevronDown, User, ShoppingBag, Package, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';

// Sub-tab component for CRM section (Analytics + Clients)
export const CRMTab = ({
  users,
  stats,
  extendedStats,
  statsPeriod,
  setStatsPeriod,
  formatPrice,
  handleEditUser,
  handleDeleteUser,
  isDark = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState('clients');
  const [expandedUser, setExpandedUser] = useState(null);

  const subTabs = [
    { id: 'clients', label: 'Клиенты', icon: Users },
    { id: 'analytics', label: 'Аналитика', icon: BarChart3 },
  ];

  // Customer role colors
  const getStatusColor = (role) => {
    if (isDark) {
      return role === 'admin' ? 'bg-orange-500/20 text-orange-400' : 'bg-teal-500/20 text-teal-400';
    }
    return role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700';
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
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                    : 'bg-orange-500 text-white'
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
                              <span className={`text-sm font-medium text-orange-500`}>{user.email}</span>
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
                              <span className={`text-sm font-bold ${isDark ? 'text-zinc-200' : ''}`}>{getStatusLabel(user.customer_status)}</span>
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
                            <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                              <p className="text-2xl font-bold text-orange-500">{user.orders_count || 0}</p>
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
                            <div className={`p-3 rounded-lg text-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                              <p className="text-2xl font-bold text-purple-500">{user.total_items || 0}</p>
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
                                      <span className="text-orange-500 font-mono text-xs">{product.sku || '—'}</span>
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
          <div className="flex items-center gap-3">
            <Calendar className={`w-5 h-5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
            <Select value={statsPeriod} onValueChange={setStatsPeriod}>
              <SelectTrigger className={`w-48 ${isDark ? 'bg-zinc-800/50 border-zinc-700 text-zinc-100' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={isDark ? 'bg-zinc-800 border-zinc-700' : ''}>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="week">Неделя</SelectItem>
                <SelectItem value="month">Месяц</SelectItem>
                <SelectItem value="year">Год</SelectItem>
                <SelectItem value="all">Всё время</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white">
              <p className="text-blue-100 text-sm">Заказов</p>
              <p className="text-3xl font-bold mt-1">{extendedStats?.orders_count || 0}</p>
            </div>
            <div className="p-5 bg-gradient-to-br from-green-500 to-green-600 rounded-xl text-white">
              <p className="text-green-100 text-sm">Выручка</p>
              <p className="text-2xl font-bold mt-1">{formatPrice(extendedStats?.revenue || 0)} ₽</p>
            </div>
            <div className="p-5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-white">
              <p className="text-purple-100 text-sm">Средний чек</p>
              <p className="text-2xl font-bold mt-1">{formatPrice(extendedStats?.avg_order || 0)} ₽</p>
            </div>
            <div className="p-5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl text-white">
              <p className="text-orange-100 text-sm">Новых клиентов</p>
              <p className="text-3xl font-bold mt-1">{extendedStats?.new_users || 0}</p>
            </div>
          </div>

          {/* Top products */}
          {extendedStats?.top_products && extendedStats.top_products.length > 0 && (
            <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'border border-zinc-200 bg-white'}`}>
              <h3 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-100' : ''}`}>
                <TrendingUp className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
                Топ товаров
              </h3>
              <div className="space-y-3">
                {extendedStats.top_products.slice(0, 5).map((product, index) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
                      {index + 1}
                    </span>
                    <span className={`flex-1 truncate ${isDark ? 'text-zinc-300' : ''}`}>{product.name}</span>
                    <span className={`font-medium ${isDark ? 'text-zinc-100' : ''}`}>{product.sold} шт.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default CRMTab;
