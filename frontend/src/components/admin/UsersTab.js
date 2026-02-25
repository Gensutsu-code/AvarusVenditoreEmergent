import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Pencil, Trash2, Eye, User, Crown, Star, Briefcase } from 'lucide-react';

const formatPrice = (num) => num?.toLocaleString('ru-RU') || '0';
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const statusIcons = {
  retail: User,
  wholesale: Briefcase,
  partner: Crown
};

const statusLabels = {
  retail: 'Розница',
  wholesale: 'Опт',
  partner: 'Партнёр'
};

const statusColors = {
  retail: 'text-zinc-600 bg-zinc-100',
  wholesale: 'text-blue-600 bg-blue-100',
  partner: 'text-amber-600 bg-amber-100'
};

export default function UsersTab({ 
  users,
  userSearch,
  setUserSearch,
  openNewUser,
  openEditUser,
  handleDeleteUser,
  openUserDetails
}) {
  const filteredUsers = users.filter(user => {
    if (!userSearch) return true;
    const search = userSearch.toLowerCase();
    return (
      user.email?.toLowerCase().includes(search) ||
      user.name?.toLowerCase().includes(search) ||
      user.phone?.includes(search)
    );
  });

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h2 className="text-lg font-semibold">Управление клиентами</h2>
        <div className="flex gap-2">
          <Input 
            placeholder="Поиск по email, имени, телефону..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={openNewUser} className="bg-teal-500 hover:bg-teal-600" data-testid="add-user-btn">
            <Plus className="w-4 h-4 mr-2" />
            Добавить
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-2">Пользователь</th>
              <th className="text-left py-3 px-2">Email</th>
              <th className="text-left py-3 px-2">Телефон</th>
              <th className="text-left py-3 px-2">Статус</th>
              <th className="text-right py-3 px-2">Скидка</th>
              <th className="text-right py-3 px-2">Заказов</th>
              <th className="text-right py-3 px-2">Сумма</th>
              <th className="text-left py-3 px-2">Регистрация</th>
              <th className="text-right py-3 px-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const StatusIcon = statusIcons[user.customer_status] || User;
              return (
                <tr key={user.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        {user.role === 'admin' && (
                          <span className="text-xs text-teal-600 font-bold">Администратор</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2">{user.email}</td>
                  <td className="py-2 px-2">{user.phone || '—'}</td>
                  <td className="py-2 px-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${statusColors[user.customer_status]}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusLabels[user.customer_status]}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    {user.individual_discount > 0 && (
                      <span className="text-green-600 font-medium">-{user.individual_discount}%</span>
                    )}
                    {!user.individual_discount && '—'}
                  </td>
                  <td className="py-2 px-2 text-right">{user.total_orders || 0}</td>
                  <td className="py-2 px-2 text-right font-mono">{formatPrice(user.total_spent || 0)} ₽</td>
                  <td className="py-2 px-2 text-xs text-zinc-500">{formatDate(user.created_at)}</td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openUserDetails(user)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditUser(user)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {user.role !== 'admin' && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user.id)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          Пользователи не найдены
        </div>
      )}
    </div>
  );
}
