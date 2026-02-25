import React from 'react';
import { TrendingUp, ShoppingBag, BarChart3, Users, Package, Award } from 'lucide-react';

const formatPrice = (num) => num?.toLocaleString('ru-RU') || '0';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Ожидает', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'processing', label: 'В обработке', color: 'bg-blue-100 text-blue-800' },
  { value: 'shipped', label: 'Отправлен', color: 'bg-purple-100 text-purple-800' },
  { value: 'delivered', label: 'Доставлен', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Отменён', color: 'bg-red-100 text-red-800' },
];

export default function StatsTab({ statsPeriod, setStatsPeriod, extendedStats }) {
  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header with period selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Аналитика и статистика</h2>
            <p className="text-sm text-zinc-500">Комплексный обзор бизнес-показателей</p>
          </div>
          <select
            value={statsPeriod}
            onChange={(e) => setStatsPeriod(e.target.value)}
            className="h-10 px-4 border border-zinc-200 bg-white rounded-lg font-medium"
          >
            <option value="day">За день</option>
            <option value="week">За неделю</option>
            <option value="month">За месяц</option>
            <option value="year">За год</option>
          </select>
        </div>

        {extendedStats && (
          <>
            {/* Main KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Revenue Card */}
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-xl text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  {extendedStats.revenue_growth !== 0 && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      extendedStats.revenue_growth > 0 ? 'bg-white/20' : 'bg-red-500/50'
                    }`}>
                      {extendedStats.revenue_growth > 0 ? '+' : ''}{extendedStats.revenue_growth}%
                    </span>
                  )}
                </div>
                <p className="text-green-100 text-sm">Выручка</p>
                <p className="text-2xl font-bold">{formatPrice(extendedStats.total_revenue)} ₽</p>
                <p className="text-xs text-green-200 mt-1">
                  Пред. период: {formatPrice(extendedStats.prev_revenue)} ₽
                </p>
              </div>

              {/* Orders Card */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-xl text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  {extendedStats.orders_growth !== 0 && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      extendedStats.orders_growth > 0 ? 'bg-white/20' : 'bg-red-500/50'
                    }`}>
                      {extendedStats.orders_growth > 0 ? '+' : ''}{extendedStats.orders_growth}%
                    </span>
                  )}
                </div>
                <p className="text-blue-100 text-sm">Заказов</p>
                <p className="text-2xl font-bold">{extendedStats.total_orders}</p>
                <p className="text-xs text-blue-200 mt-1">
                  Товаров: {extendedStats.total_items} шт.
                </p>
              </div>

              {/* Average Order Card */}
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-5 rounded-xl text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-purple-100 text-sm">Средний чек</p>
                <p className="text-2xl font-bold">{formatPrice(extendedStats.avg_order_value)} ₽</p>
                <p className="text-xs text-purple-200 mt-1">
                  Уник. клиентов: {extendedStats.unique_customers}
                </p>
              </div>

              {/* Users Card */}
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-xl text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  {extendedStats.new_users > 0 && (
                    <span className="text-xs font-bold px-2 py-1 rounded bg-white/20">
                      +{extendedStats.new_users} новых
                    </span>
                  )}
                </div>
                <p className="text-orange-100 text-sm">Пользователей</p>
                <p className="text-2xl font-bold">{extendedStats.total_users}</p>
                <p className="text-xs text-orange-200 mt-1">
                  Конверсия: {extendedStats.conversion_rate}%
                </p>
              </div>
            </div>

            {/* Secondary Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                <p className="text-xs text-zinc-400 uppercase">Всего товаров</p>
                <p className="text-xl font-bold text-zinc-900">{extendedStats.total_products}</p>
              </div>
              <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                <p className="text-xs text-zinc-400 uppercase">В наличии</p>
                <p className="text-xl font-bold text-green-600">{extendedStats.active_products}</p>
              </div>
              <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                <p className="text-xs text-zinc-400 uppercase">Нет в наличии</p>
                <p className="text-xl font-bold text-red-500">{extendedStats.out_of_stock}</p>
              </div>
              <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                <p className="text-xs text-zinc-400 uppercase">Заказов всего</p>
                <p className="text-xl font-bold text-zinc-900">{extendedStats.all_time_orders}</p>
              </div>
              <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                <p className="text-xs text-zinc-400 uppercase">Выручка всего</p>
                <p className="text-xl font-bold text-zinc-900">{formatPrice(extendedStats.all_time_revenue)} ₽</p>
              </div>
              <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                <p className="text-xs text-zinc-400 uppercase">Заказов/клиент</p>
                <p className="text-xl font-bold text-zinc-900">{extendedStats.avg_orders_per_customer}</p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Sales Chart */}
              {extendedStats.daily_sales?.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Динамика продаж
                  </h3>
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-1 h-48 min-w-max pb-6">
                      {extendedStats.daily_sales.map((day, idx) => {
                        const maxValue = Math.max(...extendedStats.daily_sales.map(d => d.total));
                        const height = maxValue > 0 ? (day.total / maxValue) * 100 : 0;
                        return (
                          <div key={idx} className="flex flex-col items-center gap-1 group relative">
                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              {day.orders} заказов<br/>{formatPrice(day.total)} ₽
                            </div>
                            <div 
                              className="w-6 sm:w-8 bg-gradient-to-t from-green-500 to-green-400 hover:from-green-600 hover:to-green-500 rounded-t transition-all cursor-pointer"
                              style={{ height: `${Math.max(height, 4)}%`, minHeight: '8px' }}
                            />
                            <span className="text-[10px] text-zinc-400 transform -rotate-45 origin-top-left whitespace-nowrap absolute -bottom-6">
                              {day.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Hourly Distribution */}
              {extendedStats.hourly_distribution?.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Активность по часам
                  </h3>
                  <div className="flex items-end gap-[2px] h-32">
                    {extendedStats.hourly_distribution.map((h, idx) => {
                      const maxOrders = Math.max(...extendedStats.hourly_distribution.map(d => d.orders));
                      const height = maxOrders > 0 ? (h.orders / maxOrders) * 100 : 0;
                      return (
                        <div 
                          key={idx} 
                          className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t hover:from-blue-600 hover:to-blue-500 transition-all cursor-pointer relative group"
                          style={{ height: `${Math.max(height, 2)}%`, minHeight: '2px' }}
                        >
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                            {h.hour}:00 - {h.orders}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>23:00</span>
                  </div>
                </div>
              )}
            </div>

            {/* Status Distribution */}
            {Object.keys(extendedStats.status_distribution || {}).length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-500" />
                  Распределение по статусам
                </h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(extendedStats.status_distribution).map(([status, count]) => {
                    const statusInfo = STATUS_OPTIONS.find(s => s.value === status) || { label: status, color: 'bg-zinc-100' };
                    const total = Object.values(extendedStats.status_distribution).reduce((a, b) => a + b, 0);
                    const percent = total > 0 ? (count / total * 100).toFixed(1) : 0;
                    return (
                      <div key={status} className="flex items-center gap-3 bg-zinc-50 px-4 py-3 rounded-lg">
                        <div className={`w-3 h-3 rounded-full ${
                          status === 'delivered' ? 'bg-green-500' :
                          status === 'shipped' ? 'bg-blue-500' :
                          status === 'processing' ? 'bg-yellow-500' :
                          status === 'cancelled' ? 'bg-red-500' :
                          'bg-zinc-400'
                        }`} />
                        <div>
                          <p className="font-medium text-zinc-900">{statusInfo.label}</p>
                          <p className="text-sm text-zinc-500">{count} ({percent}%)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Lists Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Products */}
              {extendedStats.top_products?.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-teal-500" />
                    Топ товаров
                  </h3>
                  <div className="space-y-3">
                    {extendedStats.top_products.slice(0, 5).map((product, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-zinc-200 text-zinc-600' :
                          idx === 2 ? 'bg-teal-100 text-orange-700' :
                          'bg-zinc-100 text-zinc-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate" title={product.name}>
                            {product.name}
                          </p>
                          <p className="text-xs text-zinc-400">{product.article}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900">{product.count} шт.</p>
                          <p className="text-xs text-green-600">{formatPrice(product.revenue)} ₽</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Customers */}
              {extendedStats.top_customers?.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Топ клиентов
                  </h3>
                  <div className="space-y-3">
                    {extendedStats.top_customers.slice(0, 5).map((customer, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-zinc-200 text-zinc-600' :
                          idx === 2 ? 'bg-teal-100 text-orange-700' :
                          'bg-zinc-100 text-zinc-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{customer.name}</p>
                          <p className="text-xs text-zinc-400 truncate">{customer.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900">{formatPrice(customer.total_spent)} ₽</p>
                          <p className="text-xs text-zinc-500">{customer.orders} заказов</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Manufacturers */}
              {extendedStats.top_manufacturers?.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
                  <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-500" />
                    Топ производителей
                  </h3>
                  <div className="space-y-3">
                    {extendedStats.top_manufacturers.slice(0, 5).map((mfr, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-zinc-200 text-zinc-600' :
                          idx === 2 ? 'bg-teal-100 text-orange-700' :
                          'bg-zinc-100 text-zinc-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{mfr.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900">{mfr.count} шт.</p>
                          <p className="text-xs text-green-600">{formatPrice(mfr.revenue)} ₽</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!extendedStats && (
          <div className="text-center py-12 text-zinc-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Загрузка статистики...</p>
          </div>
        )}
      </div>
    </div>
  );
}
