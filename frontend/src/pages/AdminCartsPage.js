import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ChevronDown, ChevronUp, Trash2, Plus, Minus, Search, Package, User, X, Edit3, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AdminCartsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCart, setExpandedCart] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addProductModal, setAddProductModal] = useState(null); // user_id
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null); // {userId, productId}
  const [editPriceValue, setEditPriceValue] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchCarts();
  }, [user, authLoading, navigate]);

  const fetchCarts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/carts`);
      setCarts(res.data.carts || []);
    } catch (err) {
      toast.error('Ошибка загрузки корзин');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (userId, productId, productName) => {
    try {
      await axios.delete(`${API}/admin/carts/${userId}/item/${productId}`);
      toast.success(`${productName} удалён из корзины`);
      fetchCarts();
    } catch (err) {
      toast.error('Ошибка удаления товара');
    }
  };

  const handleUpdateQuantity = async (userId, productId, newQty) => {
    if (newQty < 1) return;
    try {
      await axios.put(`${API}/admin/carts/${userId}/item/${productId}`, { quantity: newQty });
      setCarts(prev => prev.map(c => {
        if (c.user_id !== userId) return c;
        return {
          ...c,
          items: c.items.map(i => i.product_id === productId ? { ...i, quantity: newQty } : i),
          total: c.items.reduce((s, i) => s + (i.product_id === productId ? newQty : i.quantity) * i.price, 0),
        };
      }));
    } catch (err) {
      toast.error('Ошибка обновления количества');
    }
  };

  const handleSetPrice = async (userId, productId) => {
    const price = parseFloat(editPriceValue);
    if (isNaN(price) || price < 0) {
      toast.error('Некорректная цена');
      return;
    }
    try {
      await axios.put(`${API}/admin/carts/${userId}/item/${productId}`, { price });
      toast.success('Цена обновлена');
      setEditingPrice(null);
      setEditPriceValue('');
      fetchCarts();
    } catch (err) {
      toast.error('Ошибка обновления цены');
    }
  };

  const handleClearCart = async (userId, userName) => {
    if (!window.confirm(`Очистить корзину пользователя ${userName}?`)) return;
    try {
      await axios.delete(`${API}/admin/carts/${userId}`);
      toast.success('Корзина очищена');
      fetchCarts();
    } catch (err) {
      toast.error('Ошибка очистки корзины');
    }
  };

  // Product search for adding to cart
  const searchProducts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setProductResults([]);
      return;
    }
    setProductSearchLoading(true);
    try {
      const res = await axios.get(`${API}/products/search?q=${encodeURIComponent(query)}&limit=10`);
      setProductResults(res.data.products || res.data || []);
    } catch {
      setProductResults([]);
    } finally {
      setProductSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(productSearch), 300);
    return () => clearTimeout(timer);
  }, [productSearch, searchProducts]);

  const handleAddProduct = async (userId, product) => {
    try {
      await axios.post(`${API}/admin/carts/${userId}/add`, { product_id: product.id, quantity: 1 });
      toast.success(`${product.name} добавлен в корзину`);
      setAddProductModal(null);
      setProductSearch('');
      setProductResults([]);
      fetchCarts();
    } catch (err) {
      toast.error('Ошибка добавления товара');
    }
  };

  const filteredCarts = carts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.user_name || '').toLowerCase().includes(q) ||
      (c.user_email || '').toLowerCase().includes(q) ||
      (c.user_phone || '').toLowerCase().includes(q) ||
      c.items.some(i => (i.name || '').toLowerCase().includes(q) || (i.article || '').toLowerCase().includes(q))
    );
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" data-testid="admin-carts-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-carts-page">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-slate-700" />
              <h1 className="text-lg font-bold text-slate-800">Корзины клиентов</h1>
              <span className="text-sm text-slate-400">{carts.length} шт.</span>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени, email, товару..."
                className="pl-9 rounded-xl bg-slate-50 border-slate-200"
                data-testid="admin-carts-search"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-3">
        {filteredCarts.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Нет корзин с товарами</p>
          </div>
        ) : (
          filteredCarts.map(cart => (
            <motion.div
              key={cart.user_id}
              layout
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm"
              data-testid={`cart-${cart.user_id}`}
            >
              {/* Cart header - clickable */}
              <button
                onClick={() => setExpandedCart(expandedCart === cart.user_id ? null : cart.user_id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                data-testid={`cart-toggle-${cart.user_id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-800 text-sm">{cart.user_name}</p>
                    <p className="text-xs text-slate-400">{cart.user_email}{cart.user_phone ? ` \u00b7 ${cart.user_phone}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{cart.total.toLocaleString('ru-RU')} &#8381;</p>
                    <p className="text-xs text-slate-400">{cart.items_count} {cart.items_count === 1 ? 'товар' : cart.items_count < 5 ? 'товара' : 'товаров'}</p>
                  </div>
                  {expandedCart === cart.user_id ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Expanded cart items */}
              <AnimatePresence>
                {expandedCart === cart.user_id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-slate-100 px-4 py-3 space-y-2">
                      {cart.items.map(item => (
                        <div
                          key={item.product_id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 group"
                          data-testid={`cart-item-${cart.user_id}-${item.product_id}`}
                        >
                          {/* Product image */}
                          <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 overflow-hidden flex-shrink-0">
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-slate-300" />
                              </div>
                            )}
                          </div>

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                            <p className="text-xs text-slate-400">
                              Арт: {item.article}
                              {item.manufacturer ? ` \u00b7 ${item.manufacturer}` : ''}
                            </p>
                          </div>

                          {/* Price */}
                          <div className="flex items-center gap-1.5 min-w-[120px] justify-end">
                            {editingPrice?.userId === cart.user_id && editingPrice?.productId === item.product_id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={editPriceValue}
                                  onChange={e => setEditPriceValue(e.target.value)}
                                  className="w-24 h-8 text-sm rounded-lg"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSetPrice(cart.user_id, item.product_id);
                                    if (e.key === 'Escape') { setEditingPrice(null); setEditPriceValue(''); }
                                  }}
                                  data-testid={`price-input-${item.product_id}`}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                                  onClick={() => handleSetPrice(cart.user_id, item.product_id)}
                                  data-testid={`price-confirm-${item.product_id}`}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-100"
                                  onClick={() => { setEditingPrice(null); setEditPriceValue(''); }}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingPrice({ userId: cart.user_id, productId: item.product_id });
                                  setEditPriceValue(String(item.price));
                                }}
                                className="flex items-center gap-1 group/price cursor-pointer"
                                title="Изменить цену"
                                data-testid={`edit-price-${cart.user_id}-${item.product_id}`}
                              >
                                <span className="text-sm font-semibold text-slate-800">
                                  {item.price.toLocaleString('ru-RU')} &#8381;
                                </span>
                                {item.individual_price !== null && item.individual_price !== undefined && (
                                  <span className="text-xs line-through text-slate-400 ml-1">
                                    {item.original_price.toLocaleString('ru-RU')}
                                  </span>
                                )}
                                <Edit3 className="w-3 h-3 text-slate-300 opacity-0 group-hover/price:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </div>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-1 min-w-[100px] justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg"
                              onClick={() => handleUpdateQuantity(cart.user_id, item.product_id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              data-testid={`qty-minus-${item.product_id}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg"
                              onClick={() => handleUpdateQuantity(cart.user_id, item.product_id, item.quantity + 1)}
                              data-testid={`qty-plus-${item.product_id}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>

                          {/* Subtotal */}
                          <div className="min-w-[90px] text-right">
                            <p className="text-sm font-bold text-slate-700">
                              {(item.price * item.quantity).toLocaleString('ru-RU')} &#8381;
                            </p>
                          </div>

                          {/* Remove */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveItem(cart.user_id, item.product_id, item.name)}
                            data-testid={`remove-item-${cart.user_id}-${item.product_id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}

                      {/* Actions row */}
                      <div className="flex items-center justify-between pt-2 pb-1">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-sm"
                            onClick={() => {
                              setAddProductModal(cart.user_id);
                              setProductSearch('');
                              setProductResults([]);
                            }}
                            data-testid={`add-product-btn-${cart.user_id}`}
                          >
                            <Plus className="w-4 h-4 mr-1" /> Добавить товар
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-sm text-red-500 border-red-200 hover:bg-red-50"
                            onClick={() => handleClearCart(cart.user_id, cart.user_name)}
                            data-testid={`clear-cart-btn-${cart.user_id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> Очистить корзину
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Итого</p>
                          <p className="text-lg font-bold text-slate-800">
                            {cart.items.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString('ru-RU')} &#8381;
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {addProductModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setAddProductModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[70vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
              data-testid="add-product-modal"
            >
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Добавить товар в корзину</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setAddProductModal(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Поиск товара по названию или артикулу..."
                    className="pl-9 rounded-xl"
                    autoFocus
                    data-testid="product-search-input"
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-[50vh] p-2">
                {productSearchLoading && (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600" />
                  </div>
                )}
                {!productSearchLoading && productSearch.length >= 2 && productResults.length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-sm">Ничего не найдено</p>
                )}
                {productResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddProduct(addProductModal, p)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                    data-testid={`product-result-${p.id}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 border overflow-hidden flex-shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">Арт: {p.article}{p.manufacturer ? ` \u00b7 ${p.manufacturer}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">{(p.price || 0).toLocaleString('ru-RU')} &#8381;</p>
                      <p className="text-xs text-slate-400">В наличии: {p.stock ?? '?'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
