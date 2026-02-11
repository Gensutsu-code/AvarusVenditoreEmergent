import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Pencil, Trash2, FileDown, ChevronDown, ChevronUp, Eye } from 'lucide-react';

const formatPrice = (num) => num?.toLocaleString('ru-RU') || '0';
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusLabels = {
  pending: 'Новый',
  processing: 'В обработке',
  shipped: 'Отправлен',
  delivered: 'Доставлен',
  cancelled: 'Отменён'
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

export default function OrdersTab({ 
  orders,
  orderSearch,
  setOrderSearch,
  orderStatusFilter,
  setOrderStatusFilter,
  expandedOrderId,
  setExpandedOrderId,
  openViewOrderDetails,
  handleStatusChange,
  handleDeleteOrder,
  downloadInvoice,
  downloadReceipt
}) {
  const filteredOrders = orders.filter(order => {
    const matchesSearch = !orderSearch || 
      order.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
      order.full_name?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      order.phone?.includes(orderSearch);
    const matchesStatus = !orderStatusFilter || order.status === orderStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h2 className="text-lg font-semibold">Управление заказами</h2>
        <div className="flex gap-2">
          <Input 
            placeholder="Поиск по ID, имени, телефону..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="w-64"
          />
          <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Все статусы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Все статусы</SelectItem>
              <SelectItem value="pending">Новые</SelectItem>
              <SelectItem value="processing">В обработке</SelectItem>
              <SelectItem value="shipped">Отправлены</SelectItem>
              <SelectItem value="delivered">Доставлены</SelectItem>
              <SelectItem value="cancelled">Отменены</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredOrders.map((order) => (
          <div key={order.id} className="border border-zinc-200 rounded-lg overflow-hidden">
            {/* Order Header */}
            <div 
              className="p-4 bg-zinc-50 flex items-center justify-between cursor-pointer hover:bg-zinc-100"
              onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
            >
              <div className="flex items-center gap-4">
                <div>
                  <span className="font-mono text-sm font-bold">#{order.id.slice(0, 8)}</span>
                  <span className={`ml-2 text-xs px-2 py-1 rounded-full ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                </div>
                <div className="text-sm text-zinc-500">
                  {order.full_name} • {order.phone}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold">{formatPrice(order.total)} ₽</span>
                <span className="text-xs text-zinc-500">{formatDate(order.created_at)}</span>
                {expandedOrderId === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {/* Expanded Order Details */}
            {expandedOrderId === order.id && (
              <div className="p-4 border-t border-zinc-200">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-zinc-500">Адрес доставки</Label>
                    <p className="text-sm">{order.address}</p>
                    {order.comment && (
                      <>
                        <Label className="text-xs text-zinc-500 mt-2 block">Комментарий</Label>
                        <p className="text-sm">{order.comment}</p>
                      </>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-500">Товары</Label>
                    <div className="space-y-1 mt-1">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="text-sm flex justify-between">
                          <span>{item.name} × {item.quantity}</span>
                          <span className="text-zinc-600">{formatPrice(item.price * item.quantity)} ₽</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-200">
                  <div className="flex gap-2">
                    <Select value={order.status} onValueChange={(value) => handleStatusChange(order.id, value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Новый</SelectItem>
                        <SelectItem value="processing">В обработке</SelectItem>
                        <SelectItem value="shipped">Отправлен</SelectItem>
                        <SelectItem value="delivered">Доставлен</SelectItem>
                        <SelectItem value="cancelled">Отменён</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button variant="outline" size="sm" onClick={() => openViewOrderDetails(order)}>
                      <Eye className="w-4 h-4 mr-1" /> Подробнее
                    </Button>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadInvoice(order.id, 'docx')}>
                      <FileDown className="w-4 h-4 mr-1" /> Накладная
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadReceipt(order.id, 'pdf')}>
                      <FileDown className="w-4 h-4 mr-1" /> Чек
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteOrder(order.id)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          Заказы не найдены
        </div>
      )}
    </div>
  );
}
