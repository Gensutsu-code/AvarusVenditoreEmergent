import { useState } from 'react';
import { Users, BarChart3, TrendingUp, Calendar, UserCheck, Pencil, Trash2, ChevronDown } from 'lucide-react';
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

  // Customer status colors
  const getStatusColor = (status) => {
    if (isDark) {
      switch (status) {
        case 'vip': return 'bg-purple-500/20 text-purple-400';
        case 'wholesale': return 'bg-blue-500/20 text-blue-400';
        default: return 'bg-zinc-700/50 text-zinc-400';
      }
    }
    switch (status) {
      case 'vip': return 'bg-purple-100 text-purple-700';
      case 'wholesale': return 'bg-blue-100 text-blue-700';
      default: return 'bg-zinc-100 text-zinc-700';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'vip': return 'VIP';
      case 'wholesale': return 'Оптовик';
      default: return 'Пользователь';
    }
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
              <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                <UserCheck className="w-4 h-4" />
                <span className="text-xs font-medium">Активные</span>
              </div>
              <p className={`text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>{users.filter(u => u.role !== 'admin').length}</p>
            </div>
            <div className={`p-4 rounded-xl ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-100'}`}>
              <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">VIP</span>
              </div>
              <p className={`text-2xl font-bold ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>{users.filter(u => u.customer_status === 'vip').length}</p>
            </div>
            <div className={`p-4 rounded-xl ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
              <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                <Users className="w-4 h-4" />
                <span className="text-xs font-medium">Оптовики</span>
              </div>
              <p className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{users.filter(u => u.customer_status === 'wholesale').length}</p>
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
                      ? isDark ? 'bg-orange-500/10 border-b border-orange-500/20' : 'bg-orange-50 border-b border-orange-200'
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
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${getStatusColor(user.customer_status)}`}>
                          {getStatusLabel(user.customer_status)}
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
                
                {/* Expanded details */}
                <AnimatePresence>
                  {expandedUser === user.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`overflow-hidden ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-50'}`}
                    >
                      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Телефон</p>
                          <p className={`font-medium ${isDark ? 'text-zinc-200' : ''}`}>{user.phone || '—'}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Баланс</p>
                          <p className={`font-medium ${isDark ? 'text-zinc-200' : ''}`}>{formatPrice(user.balance || 0)} ₽</p>
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Бонусы</p>
                          <p className={`font-medium ${isDark ? 'text-zinc-200' : ''}`}>{user.bonus_balance || 0} бонусов</p>
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Дата регистрации</p>
                          <p className={`font-medium ${isDark ? 'text-zinc-200' : ''}`}>
                            {user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : '—'}
                          </p>
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
