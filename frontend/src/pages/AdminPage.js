import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Package, ShoppingBag, TrendingUp, 
  Plus, Pencil, Trash2, X, Save, Eye
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);

  useEffect(() => {
    if (authLoading) {
      return; // Wait for auth to load
    }
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      toast.error('Доступ запрещён');
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, productsRes, usersRes, ordersRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/products`),
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/orders`)
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data);
      setUsers(usersRes.data);
      setOrders(ordersRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data', err);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price);
  
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const handleSaveProduct = async () => {
    if (!editingProduct.name || !editingProduct.article || !editingProduct.price) {
      toast.error('Заполните обязательные поля');
      return;
    }

    try {
      if (isNewProduct) {
        await axios.post(`${API}/products`, editingProduct);
        toast.success('Товар создан');
      } else {
        await axios.put(`${API}/products/${editingProduct.id}`, editingProduct);
        toast.success('Товар обновлён');
      }
      setEditingProduct(null);
      fetchData();
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Удалить товар?')) return;
    
    try {
      await axios.delete(`${API}/products/${productId}`);
      toast.success('Товар удалён');
      fetchData();
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/admin/orders/${orderId}/status?status=${status}`);
      toast.success('Статус обновлён');
      fetchData();
      if (viewingOrder?.id === orderId) {
        setViewingOrder({ ...viewingOrder, status });
      }
    } catch (err) {
      toast.error('Ошибка обновления статуса');
    }
  };

  const openNewProduct = () => {
    setIsNewProduct(true);
    setEditingProduct({
      name: '',
      article: '',
      price: 0,
      stock: 0,
      delivery_days: 3,
      description: '',
      image_url: ''
    });
  };

  const openEditProduct = (product) => {
    setIsNewProduct(false);
    setEditingProduct({ ...product });
  };

  const STATUS_OPTIONS = [
    { value: 'pending', label: 'Ожидает', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'processing', label: 'В обработке', color: 'bg-blue-100 text-blue-800' },
    { value: 'shipped', label: 'Отправлен', color: 'bg-purple-100 text-purple-800' },
    { value: 'delivered', label: 'Доставлен', color: 'bg-green-100 text-green-800' },
    { value: 'cancelled', label: 'Отменён', color: 'bg-red-100 text-red-800' }
  ];

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="admin-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-8">
          Панель администратора
        </h1>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-zinc-200 p-6">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_users}</p>
                  <p className="text-sm text-zinc-500">Пользователей</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 p-6">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_products}</p>
                  <p className="text-sm text-zinc-500">Товаров</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 p-6">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_orders}</p>
                  <p className="text-sm text-zinc-500">Заказов</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{formatPrice(stats.total_revenue)} ₽</p>
                  <p className="text-sm text-zinc-500">Выручка</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="products" className="bg-white border border-zinc-200">
          <TabsList className="w-full justify-start border-b border-zinc-200 rounded-none bg-zinc-50 p-0">
            <TabsTrigger value="products" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Товары ({products.length})
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Заказы ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Пользователи ({users.length})
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Управление товарами</h2>
              <Button onClick={openNewProduct} className="bg-orange-500 hover:bg-orange-600" data-testid="add-product-btn">
                <Plus className="w-4 h-4 mr-2" />
                Добавить товар
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 px-2">Фото</th>
                    <th className="text-left py-3 px-2">Название</th>
                    <th className="text-left py-3 px-2">Артикул</th>
                    <th className="text-right py-3 px-2">Цена</th>
                    <th className="text-right py-3 px-2">Наличие</th>
                    <th className="text-right py-3 px-2">Доставка</th>
                    <th className="text-right py-3 px-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-2 px-2">
                        <div className="w-12 h-12 bg-zinc-100 overflow-hidden">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-300">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 font-medium">{product.name}</td>
                      <td className="py-2 px-2 font-mono text-zinc-500">{product.article}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatPrice(product.price)} ₽</td>
                      <td className="py-2 px-2 text-right">{product.stock} шт.</td>
                      <td className="py-2 px-2 text-right">{product.delivery_days || 3} дн.</td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditProduct(product)} data-testid={`edit-${product.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id)} className="text-red-500 hover:text-red-600" data-testid={`delete-${product.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="p-6">
            <h2 className="text-lg font-semibold mb-4">Заказы</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 px-2">№ Заказа</th>
                    <th className="text-left py-3 px-2">Дата</th>
                    <th className="text-left py-3 px-2">Клиент</th>
                    <th className="text-right py-3 px-2">Сумма</th>
                    <th className="text-center py-3 px-2">Статус</th>
                    <th className="text-right py-3 px-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-2 px-2 font-mono">{order.id.slice(0, 8)}</td>
                      <td className="py-2 px-2 text-zinc-500">{formatDate(order.created_at)}</td>
                      <td className="py-2 px-2">{order.full_name}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatPrice(order.total)} ₽</td>
                      <td className="py-2 px-2 text-center">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className={`text-xs font-bold px-2 py-1 border-0 ${STATUS_OPTIONS.find(s => s.value === order.status)?.color || 'bg-zinc-100'}`}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setViewingOrder(order)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="p-6">
            <h2 className="text-lg font-semibold mb-4">Пользователи</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 px-2">Имя</th>
                    <th className="text-left py-3 px-2">Email</th>
                    <th className="text-left py-3 px-2">Телефон</th>
                    <th className="text-left py-3 px-2">Роль</th>
                    <th className="text-left py-3 px-2">Дата регистрации</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-2 px-2 font-medium">{u.name}</td>
                      <td className="py-2 px-2">{u.email}</td>
                      <td className="py-2 px-2 text-zinc-500">{u.phone || '—'}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs font-bold px-2 py-1 ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-zinc-100'}`}>
                          {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-zinc-500">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Product Modal */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg" data-testid="product-edit-modal">
          <DialogHeader>
            <DialogTitle>{isNewProduct ? 'Добавить товар' : 'Редактировать товар'}</DialogTitle>
          </DialogHeader>
          
          {editingProduct && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Название *</Label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="mt-1"
                  data-testid="product-name-input"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Артикул *</Label>
                <Input
                  value={editingProduct.article}
                  onChange={(e) => setEditingProduct({ ...editingProduct, article: e.target.value })}
                  className="mt-1"
                  data-testid="product-article-input"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Цена *</Label>
                  <Input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                    data-testid="product-price-input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Наличие</Label>
                  <Input
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="mt-1"
                    data-testid="product-stock-input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Доставка (дней)</Label>
                  <Input
                    type="number"
                    value={editingProduct.delivery_days}
                    onChange={(e) => setEditingProduct({ ...editingProduct, delivery_days: parseInt(e.target.value) || 3 })}
                    className="mt-1"
                    data-testid="product-delivery-input"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">URL изображения</Label>
                <Input
                  value={editingProduct.image_url || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                  placeholder="https://..."
                  className="mt-1"
                  data-testid="product-image-input"
                />
                {editingProduct.image_url && (
                  <div className="mt-2 w-20 h-20 bg-zinc-100 overflow-hidden">
                    <img src={editingProduct.image_url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Описание</Label>
                <Textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="mt-1"
                  rows={3}
                  data-testid="product-description-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingProduct(null)}>
                  Отмена
                </Button>
                <Button onClick={handleSaveProduct} className="bg-orange-500 hover:bg-orange-600" data-testid="save-product-btn">
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Order Modal */}
      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Заказ #{viewingOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          {viewingOrder && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">Получатель:</p>
                  <p className="font-medium">{viewingOrder.full_name}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Телефон:</p>
                  <p className="font-medium">{viewingOrder.phone}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-zinc-500">Адрес:</p>
                  <p className="font-medium">{viewingOrder.address}</p>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Товары:</p>
                {viewingOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1">
                    <span>{item.name} × {item.quantity}</span>
                    <span className="font-mono">{formatPrice(item.price * item.quantity)} ₽</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold pt-2 border-t border-zinc-100 mt-2">
                  <span>Итого:</span>
                  <span className="font-mono">{formatPrice(viewingOrder.total)} ₽</span>
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <Label className="text-xs font-bold uppercase text-zinc-500">Статус заказа</Label>
                <select
                  value={viewingOrder.status}
                  onChange={(e) => handleUpdateOrderStatus(viewingOrder.id, e.target.value)}
                  className="w-full mt-1 h-10 px-3 border border-zinc-200 bg-zinc-50"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
