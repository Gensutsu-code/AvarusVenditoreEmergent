import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Warehouse, Package, TrendingUp, TrendingDown, Wallet, AlertTriangle, Plus, Minus, ArrowDownCircle, ArrowUpCircle, ShoppingCart, Trash2, Loader2, Coins } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p || 0));

const TABS = [
  { id: 'stock', label: 'Остатки' },
  { id: 'movements', label: 'Движения' },
  { id: 'finance', label: 'Финансы' },
];

const MV = {
  receipt: { label: 'Приход', color: 'text-emerald-600 bg-emerald-50', icon: ArrowDownCircle, sign: '+' },
  writeoff: { label: 'Списание', color: 'text-rose-600 bg-rose-50', icon: ArrowUpCircle, sign: '−' },
  sale: { label: 'Продажа', color: 'text-indigo-600 bg-indigo-50', icon: ShoppingCart, sign: '−' },
};

const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export default function AdminWarehousePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('stock');
  const [loading, setLoading] = useState(true);

  const [stockData, setStockData] = useState({ items: [], summary: {} });
  const [search, setSearch] = useState('');
  const [movements, setMovements] = useState([]);
  const [mvFilter, setMvFilter] = useState('');
  const [finance, setFinance] = useState(null);
  const [finStart, setFinStart] = useState(firstOfMonth());
  const [finEnd, setFinEnd] = useState(today());

  const [mvModal, setMvModal] = useState(null); // { product, type }
  const [mvQty, setMvQty] = useState('');
  const [mvPrice, setMvPrice] = useState('');
  const [mvSupplier, setMvSupplier] = useState('');
  const [mvReason, setMvReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [finModal, setFinModal] = useState(false);
  const [finType, setFinType] = useState('expense');
  const [finAmount, setFinAmount] = useState('');
  const [finCategory, setFinCategory] = useState('');
  const [finComment, setFinComment] = useState('');

  const fetchStock = async (s = search) => {
    const res = await axios.get(`${API}/admin/warehouse/stock`, { params: s ? { search: s } : {} });
    setStockData(res.data);
  };
  const fetchMovements = async (f = mvFilter) => {
    const res = await axios.get(`${API}/admin/warehouse/movements`, { params: f ? { type: f } : {} });
    setMovements(res.data);
  };
  const fetchFinance = async () => {
    const res = await axios.get(`${API}/admin/finance`, { params: { start: `${finStart}T00:00:00+00:00`, end: `${finEnd}T23:59:59+00:00` } });
    setFinance(res.data);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') { navigate('/login'); return; }
    Promise.all([fetchStock(), fetchMovements(), fetchFinance()]).catch(() => toast.error('Ошибка загрузки')).finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [user, authLoading, navigate]);

  const openMv = (product, type) => {
    setMvModal({ product, type });
    setMvQty(''); setMvPrice(String(product.purchase_price || '')); setMvSupplier(''); setMvReason('');
  };

  const submitMv = async () => {
    const qty = parseInt(mvQty, 10);
    if (!qty || qty <= 0) { toast.error('Укажите количество'); return; }
    setSubmitting(true);
    try {
      const payload = { product_id: mvModal.product.id, type: mvModal.type, quantity: qty, comment: '' };
      if (mvModal.type === 'receipt') { payload.purchase_price = mvPrice === '' ? undefined : Number(mvPrice); payload.supplier = mvSupplier; }
      else { payload.reason = mvReason; }
      await axios.post(`${API}/admin/warehouse/movement`, payload);
      toast.success(mvModal.type === 'receipt' ? 'Приход оформлен' : 'Списание оформлено');
      setMvModal(null);
      await Promise.all([fetchStock(), fetchMovements(), fetchFinance()]);
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };

  const submitFin = async () => {
    const amt = Number(finAmount);
    if (!amt || amt <= 0) { toast.error('Укажите сумму'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/finance/entry`, { type: finType, amount: amt, category: finCategory, comment: finComment, date: `${today()}T12:00:00+00:00` });
      toast.success('Запись добавлена');
      setFinModal(false); setFinAmount(''); setFinCategory(''); setFinComment('');
      fetchFinance();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };

  const deleteFin = async (id) => {
    if (!window.confirm('Удалить запись?')) return;
    try { await axios.delete(`${API}/admin/finance/entry/${id}`); toast.success('Удалено'); fetchFinance(); }
    catch { toast.error('Ошибка'); }
  };

  if (!user || user.role !== 'admin') return null;
  const s = stockData.summary || {};

  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-warehouse-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Warehouse className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Склад и учёт</h1>
            <p className="text-sm text-slate-500">Остатки, движения товаров и финансовая сводка</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-amber-500 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
              data-testid={`warehouse-tab-${t.id}`}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-amber-500" /></div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* STOCK TAB */}
            {tab === 'stock' && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                  <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="wh-stat-units"><div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-slate-400" /><p className="text-xs text-slate-500">Единиц на складе</p></div><p className="text-xl font-bold text-slate-800">{fmt(s.total_units)}</p></div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="flex items-center gap-2 mb-1"><Coins className="w-4 h-4 text-slate-400" /><p className="text-xs text-slate-500">Стоимость (закупка)</p></div><p className="text-xl font-bold text-slate-800">{fmt(s.total_cost_value)} ₽</p></div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-slate-400" /><p className="text-xs text-slate-500">Потенц. выручка</p></div><p className="text-xl font-bold text-slate-800">{fmt(s.total_revenue_value)} ₽</p></div>
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-4 shadow-sm" data-testid="wh-stat-profit"><div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 opacity-80" /><p className="text-xs opacity-80">Потенц. прибыль</p></div><p className="text-xl font-bold">{fmt(s.potential_profit)} ₽</p></div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-rose-400" /><p className="text-xs text-slate-500">Мало на складе (≤{s.low_stock_threshold})</p></div><p className="text-xl font-bold text-rose-600">{fmt(s.low_stock_count)}</p></div>
                </div>

                <div className="flex gap-2 mb-4">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchStock()} placeholder="Поиск по названию, артикулу, бренду..." className="rounded-xl max-w-md" data-testid="wh-search-input" />
                  <Button onClick={() => fetchStock()} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="wh-search-btn">Найти</Button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Товар</th>
                          <th className="text-right px-4 py-3 font-medium">Остаток</th>
                          <th className="text-right px-4 py-3 font-medium">Закуп.</th>
                          <th className="text-right px-4 py-3 font-medium">Продажа</th>
                          <th className="text-right px-4 py-3 font-medium">Маржа</th>
                          <th className="text-right px-4 py-3 font-medium">Стоимость</th>
                          <th className="text-right px-4 py-3 font-medium">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockData.items.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-10 text-slate-400">Нет товаров</td></tr>
                        ) : stockData.items.map(it => (
                          <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`wh-row-${it.id}`}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{it.name}</p>
                              <p className="text-xs text-slate-400">{it.manufacturer ? it.manufacturer + ' · ' : ''}{it.article}</p>
                            </td>
                            <td className="px-4 py-3 text-right"><span className={`font-bold ${it.is_low ? 'text-rose-600' : 'text-slate-800'}`}>{it.stock}</span>{it.is_low && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 inline ml-1" />}</td>
                            <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{fmt(it.purchase_price)} ₽</td>
                            <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{fmt(it.price)} ₽</td>
                            <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${it.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(it.margin)} ₽</td>
                            <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{fmt(it.stock_cost_value)} ₽</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="outline" onClick={() => openMv(it, 'receipt')} className="border-emerald-200 text-emerald-600 rounded-lg h-8 px-2" data-testid={`wh-receipt-${it.id}`}><Plus className="w-4 h-4" /></Button>
                                <Button size="sm" variant="outline" onClick={() => openMv(it, 'writeoff')} className="border-rose-200 text-rose-600 rounded-lg h-8 px-2" data-testid={`wh-writeoff-${it.id}`}><Minus className="w-4 h-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* MOVEMENTS TAB */}
            {tab === 'movements' && (
              <>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {[{ id: '', label: 'Все' }, { id: 'receipt', label: 'Приход' }, { id: 'writeoff', label: 'Списание' }, { id: 'sale', label: 'Продажи' }].map(f => (
                    <button key={f.id} onClick={() => { setMvFilter(f.id); fetchMovements(f.id); }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${mvFilter === f.id ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                      data-testid={`mv-filter-${f.id || 'all'}`}>{f.label}</button>
                  ))}
                </div>
                <div className="space-y-2">
                  {movements.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center text-slate-400 shadow-sm">Движений нет</div>
                  ) : movements.map(m => {
                    const cfg = MV[m.type] || MV.writeoff; const Icon = cfg.icon;
                    return (
                      <div key={m.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-3 flex-wrap" data-testid={`movement-${m.id}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color}`}><Icon className="w-5 h-5" /></div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{m.product_name} <span className="text-xs text-slate-400">{m.product_article}</span></p>
                            <p className="text-xs text-slate-400">{String(m.created_at).slice(0, 16).replace('T', ' ')}{m.supplier ? ` · ${m.supplier}` : ''}{m.reason ? ` · ${m.reason}` : ''}{m.comment ? ` · ${m.comment}` : ''}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${m.type === 'receipt' ? 'text-emerald-600' : 'text-rose-600'}`}>{cfg.sign}{m.quantity} шт.</p>
                          <p className="text-xs text-slate-400">{m.stock_before} → {m.stock_after}{m.total_cost ? ` · ${fmt(m.total_cost)} ₽` : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* FINANCE TAB */}
            {tab === 'finance' && finance && (
              <>
                <div className="flex items-end gap-3 mb-5 flex-wrap">
                  <div><label className="block text-xs text-slate-500 mb-1">С</label><Input type="date" value={finStart} onChange={(e) => setFinStart(e.target.value)} className="rounded-xl" data-testid="fin-start" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">По</label><Input type="date" value={finEnd} onChange={(e) => setFinEnd(e.target.value)} className="rounded-xl" data-testid="fin-end" /></div>
                  <Button onClick={fetchFinance} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="fin-apply">Применить</Button>
                  <Button onClick={() => { setFinType('expense'); setFinModal(true); }} variant="outline" className="rounded-xl ml-auto" data-testid="fin-add-btn"><Plus className="w-4 h-4 mr-1" />Запись</Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="fin-income"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-500" /><p className="text-xs text-slate-500">Доходы</p></div><p className="text-2xl font-bold text-emerald-600">{fmt(finance.total_income)} ₽</p><p className="text-xs text-slate-400">авто {fmt(finance.auto_income)} · ручн. {fmt(finance.manual_income)}</p></div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm" data-testid="fin-expense"><div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-rose-500" /><p className="text-xs text-slate-500">Расходы</p></div><p className="text-2xl font-bold text-rose-600">{fmt(finance.total_expense)} ₽</p><p className="text-xs text-slate-400">закупки {fmt(finance.auto_expense)} · ручн. {fmt(finance.manual_expense)}</p></div>
                  <div className={`rounded-2xl p-4 shadow-sm text-white ${finance.profit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-rose-500 to-red-600'}`} data-testid="fin-profit"><div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 opacity-80" /><p className="text-xs opacity-80">Прибыль</p></div><p className="text-2xl font-bold">{fmt(finance.profit)} ₽</p><p className="text-xs opacity-80">{finance.paid_orders_count} оплач. заказов</p></div>
                </div>

                <h2 className="text-sm font-bold text-slate-700 mb-3">Ручные записи</h2>
                <div className="space-y-2">
                  {finance.entries.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center text-slate-400 shadow-sm">Нет ручных записей за период</div>
                  ) : finance.entries.map(e => (
                    <div key={e.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-3" data-testid={`fin-entry-${e.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${e.type === 'income' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>{e.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}</div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{e.category || (e.type === 'income' ? 'Доход' : 'Расход')}</p>
                          <p className="text-xs text-slate-400">{String(e.date).slice(0, 10)}{e.comment ? ` · ${e.comment}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`font-bold ${e.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{e.type === 'income' ? '+' : '−'}{fmt(e.amount)} ₽</p>
                        <button onClick={() => deleteFin(e.id)} className="text-slate-300 hover:text-rose-500" data-testid={`fin-delete-${e.id}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Movement modal */}
      <Dialog open={!!mvModal} onOpenChange={(o) => !o && setMvModal(null)}>
        <DialogContent className="rounded-2xl" data-testid="movement-modal">
          <DialogTitle>{mvModal?.type === 'receipt' ? 'Приход товара' : 'Списание товара'}</DialogTitle>
          <DialogDescription>{mvModal?.product?.name} · остаток {mvModal?.product?.stock}</DialogDescription>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Количество</label>
              <Input type="number" min="1" value={mvQty} onChange={(e) => setMvQty(e.target.value)} className="rounded-xl" data-testid="mv-qty-input" />
            </div>
            {mvModal?.type === 'receipt' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Закупочная цена за ед., ₽</label>
                  <Input type="number" min="0" value={mvPrice} onChange={(e) => setMvPrice(e.target.value)} className="rounded-xl" data-testid="mv-price-input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Поставщик (необязательно)</label>
                  <Input value={mvSupplier} onChange={(e) => setMvSupplier(e.target.value)} className="rounded-xl" data-testid="mv-supplier-input" />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Причина (необязательно)</label>
                <Input value={mvReason} onChange={(e) => setMvReason(e.target.value)} placeholder="Брак, потеря, возврат поставщику..." className="rounded-xl" data-testid="mv-reason-input" />
              </div>
            )}
            <Button onClick={submitMv} disabled={submitting} className={`w-full text-white rounded-xl ${mvModal?.type === 'receipt' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`} data-testid="mv-submit-btn">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}{mvModal?.type === 'receipt' ? 'Оформить приход' : 'Списать'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finance entry modal */}
      <Dialog open={finModal} onOpenChange={setFinModal}>
        <DialogContent className="rounded-2xl" data-testid="finance-modal">
          <DialogTitle>Добавить запись</DialogTitle>
          <DialogDescription>Ручной доход или расход</DialogDescription>
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              <button onClick={() => setFinType('expense')} className={`flex-1 py-2 rounded-xl text-sm font-medium ${finType === 'expense' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'}`} data-testid="fin-type-expense">Расход</button>
              <button onClick={() => setFinType('income')} className={`flex-1 py-2 rounded-xl text-sm font-medium ${finType === 'income' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`} data-testid="fin-type-income">Доход</button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Сумма, ₽</label>
              <Input type="number" min="0" value={finAmount} onChange={(e) => setFinAmount(e.target.value)} className="rounded-xl" data-testid="fin-amount-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Категория</label>
              <Input value={finCategory} onChange={(e) => setFinCategory(e.target.value)} placeholder="Аренда, зарплата, реклама..." className="rounded-xl" data-testid="fin-category-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Комментарий</label>
              <Input value={finComment} onChange={(e) => setFinComment(e.target.value)} className="rounded-xl" data-testid="fin-comment-input" />
            </div>
            <Button onClick={submitFin} disabled={submitting} className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="fin-submit-btn">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
