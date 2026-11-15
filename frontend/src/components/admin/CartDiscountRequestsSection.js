import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ShoppingCart, Check, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const badgeFor = (req) => {
  const st = req.status;
  if (st === 'pending') return { t: 'На рассмотрении', c: 'bg-amber-100 text-amber-700' };
  if (st === 'approved') return { t: `Одобрено ${req.admin_percent}%`, c: 'bg-emerald-100 text-emerald-700' };
  if (st === 'used') return { t: `Использовано ${req.admin_percent}%`, c: 'bg-slate-100 text-slate-500' };
  if (st === 'rejected') return { t: 'Отклонено', c: 'bg-rose-100 text-rose-700' };
  if (st === 'superseded') return { t: 'Заменено', c: 'bg-slate-100 text-slate-400' };
  return { t: 'Отменено клиентом', c: 'bg-slate-100 text-slate-400' };
};

// Заявки клиентов на скидку всей корзины
export const CartDiscountRequestsSection = ({ isDark = false }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState({});
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/cart-discount-requests`);
      setRequests(res.data || []);
    } catch { toast.error('Не удалось загрузить заявки'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => {
    setProcessing(true);
    try { await fn(); toast.success(okMsg); await load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setProcessing(false); }
  };
  const approve = (req) => {
    const pct = Number(inputs[req.id] ?? req.requested_percent);
    if (!pct || pct <= 0 || pct > 90) { toast.error('Введите процент от 1 до 90'); return; }
    act(() => axios.put(`${API}/admin/cart-discount-requests/${req.id}/approve`, { admin_percent: pct }), 'Скидка на корзину одобрена');
  };
  const reject = (req) => act(() => axios.put(`${API}/admin/cart-discount-requests/${req.id}/reject`, { response_message: '' }), 'Запрос отклонён');

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-500" /></div>;

  return (
    <div data-testid="promo-cart-discounts-section">
      <p className="text-sm text-slate-400 mb-3">Клиент просит скидку на всю корзину — вы одобряете своим процентом. Скидка одноразовая и не опускает цену товара ниже минимальной.</p>
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart className={`w-12 h-12 mb-3 ${isDark ? 'text-zinc-700' : 'text-slate-300'}`} />
          <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Запросов скидки на корзину пока нет</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {requests.map((req) => {
            const badge = badgeFor(req);
            return (
              <div key={req.id} className={`rounded-xl border p-4 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`} data-testid={`promo-cart-req-${req.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>{req.user_name || req.user_email}</p>
                    <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{req.user_email}</p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Желаемая скидка: <b className="text-teal-600">{req.requested_percent}%</b></p>
                    {req.message && <p className={`text-xs mt-1 italic ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>«{req.message}»</p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.c}`} data-testid={`promo-cart-req-status-${req.id}`}>{badge.t}</span>
                </div>
                {req.status === 'pending' && (
                  <div className="flex flex-wrap items-end gap-2 mt-3">
                    <div>
                      <label className={`text-[11px] font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Ваш процент, %</label>
                      <input
                        type="number" min="1" max="90"
                        value={inputs[req.id] ?? req.requested_percent}
                        onChange={(e) => setInputs((prev) => ({ ...prev, [req.id]: e.target.value }))}
                        className={`w-24 h-9 px-2 rounded-md border text-sm block mt-1 ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'border-slate-200'}`}
                        data-testid={`promo-cart-req-input-${req.id}`}
                      />
                    </div>
                    <Button onClick={() => approve(req)} disabled={processing} className="bg-emerald-500 hover:bg-emerald-600 text-white h-9" data-testid={`promo-cart-req-approve-${req.id}`}>
                      <Check className="w-4 h-4 mr-1" />Одобрить
                    </Button>
                    <Button onClick={() => reject(req)} disabled={processing} variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50 h-9" data-testid={`promo-cart-req-reject-${req.id}`}>
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CartDiscountRequestsSection;
