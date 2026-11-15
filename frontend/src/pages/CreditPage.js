import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { CreditCard, Clock, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Wallet, Send, Loader2, Hourglass } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const fmt = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p || 0));

const daysLeft = (due) => {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

export default function CreditPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestLimit, setRequestLimit] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInfo = async () => {
    try {
      const res = await axios.get(`${API}/credit/my`);
      setInfo(res.data);
    } catch { toast.error('Ошибка загрузки'); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchInfo();
  }, [user, authLoading, navigate]);

  const submitRequest = async () => {
    const val = Number(requestLimit);
    if (!val || val <= 0) { toast.error('Укажите сумму лимита'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/credit/request`, { requested_limit: val, message });
      toast.success('Запрос отправлен администрации');
      setRequestLimit(''); setMessage('');
      fetchInfo();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка отправки'); } finally { setSubmitting(false); }
  };

  if (authLoading || loading || !info) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-violet-500" /></div>;
  }

  const unpaid = (info.deferrals || []).filter(d => d.status === 'unpaid');
  const paid = (info.deferrals || []).filter(d => d.status === 'paid');
  const approved = info.status === 'approved';

  return (
    <div className="min-h-screen bg-slate-50" data-testid="credit-page">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/account')} className="p-2 rounded-xl hover:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Отсрочка платежа</h1>
            <p className="text-sm text-slate-500">Кредитный лимит и график погашения</p>
          </div>
        </div>

        {(approved && info.pending_request?.status !== 'offered') ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-2xl p-5" data-testid="credit-available-card">
                <CreditCard className="w-6 h-6 mb-2 opacity-80" />
                <p className="text-xs opacity-80">Доступный лимит</p>
                <p className="text-2xl font-bold">{fmt(info.available)} ₽</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <Wallet className="w-6 h-6 mb-2 text-slate-400" />
                <p className="text-xs text-slate-500">Текущий долг</p>
                <p className="text-2xl font-bold text-rose-600" data-testid="credit-debt">{fmt(info.debt)} ₽</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <Clock className="w-6 h-6 mb-2 text-slate-400" />
                <p className="text-xs text-slate-500">Срок оплаты</p>
                <p className="text-2xl font-bold text-slate-800">{info.term_days} дн.</p>
                <p className="text-xs text-slate-400">общий лимит {fmt(info.limit)} ₽</p>
              </div>
            </div>

            {/* Deferral list */}
            <h2 className="text-sm font-bold text-slate-700 mb-3">Закупки в отсрочку</h2>
            {unpaid.length === 0 && paid.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-400 shadow-sm">Нет закупок в отсрочку</div>
            ) : (
              <div className="space-y-3">
                {[...unpaid, ...paid].map((d) => {
                  const left = daysLeft(d.due_date);
                  const overdue = d.status === 'unpaid' && left !== null && left < 0;
                  return (
                    <div key={d.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${overdue ? 'border-red-200' : 'border-transparent'}`} data-testid={`deferral-${d.id}`}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <Link to="/orders" className="text-sm font-semibold text-slate-800 hover:text-teal-600">Заказ #{String(d.order_id).slice(0, 8)}</Link>
                          <p className="text-xs text-slate-400">Оформлено {String(d.created_at).slice(0, 10)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-800">{fmt(d.amount)} ₽</p>
                          {d.status === 'paid' ? (
                            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 justify-end"><CheckCircle className="w-3.5 h-3.5" /> Оплачено</span>
                          ) : overdue ? (
                            <span className="text-xs font-medium text-red-600 flex items-center gap-1 justify-end"><AlertTriangle className="w-3.5 h-3.5" /> Просрочено на {Math.abs(left)} дн.</span>
                          ) : (
                            <span className="text-xs font-medium text-amber-600 flex items-center gap-1 justify-end"><Clock className="w-3.5 h-3.5" /> Оплатить до {String(d.due_date).slice(0, 10)} ({left} дн.)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-4">Погашение отсрочки подтверждается администрацией. После оплаты статус обновится автоматически.</p>
          </>
        ) : (
          /* Request credit limit */
          <div className="bg-white rounded-2xl p-6 shadow-sm" data-testid="credit-request-block">
            {info.pending_request ? (
              info.pending_request.status === 'offered' ? (
                <div className="py-2" data-testid="credit-offer-block">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-9 h-9 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center"><CreditCard className="w-5 h-5" /></span>
                    <h2 className="font-bold text-slate-800">Предложенные условия отсрочки</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">Лимит</p>
                      <p className="text-xl font-extrabold text-teal-600">{fmt(info.pending_request.offered_limit)} ₽</p>
                      {info.pending_request.offered_limit !== info.pending_request.requested_limit && (
                        <p className="text-[11px] text-slate-400 line-through">запрошено {fmt(info.pending_request.requested_limit)} ₽</p>
                      )}
                    </div>
                    <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                      <p className="text-[11px] text-slate-400">Срок оплаты</p>
                      <p className="text-xl font-extrabold text-teal-600">{info.pending_request.offered_term_days} дн.</p>
                    </div>
                  </div>
                  {info.pending_request.response_message && (
                    <p className="text-sm text-slate-500 italic mb-3">«{info.pending_request.response_message}»</p>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={async () => { try { await axios.post(`${API}/credit/requests/${info.pending_request.id}/accept`); toast.success('Условия приняты, отсрочка активирована'); fetchInfo(); } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl" data-testid="credit-offer-accept">
                      <CheckCircle className="w-4 h-4 mr-1" />Принять
                    </Button>
                    <Button onClick={async () => { try { await axios.post(`${API}/credit/requests/${info.pending_request.id}/reject`, { reason: '' }); toast.success('Предложение отклонено'); fetchInfo(); } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } }} variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl" data-testid="credit-offer-reject">
                      <XCircle className="w-4 h-4 mr-1" />Отклонить
                    </Button>
                  </div>
                </div>
              ) : (
              <div className="text-center py-6">
                <Hourglass className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <p className="font-semibold text-slate-800">Запрос на отсрочку на рассмотрении</p>
                <p className="text-sm text-slate-500 mt-1">Запрошенный лимит: {fmt(info.pending_request.requested_limit)} ₽</p>
              </div>
              )
            ) : (
              <>
                <CreditCard className="w-10 h-10 text-violet-400 mb-3" />
                <h2 className="font-bold text-slate-800 mb-1">Запросить отсрочку платежа</h2>
                <p className="text-sm text-slate-500 mb-4">После одобрения администрацией вы сможете оформлять заказы с оплатой позже (в пределах лимита).</p>
                <label className="block text-xs font-medium text-slate-500 mb-1">Желаемый лимит, ₽</label>
                <Input type="number" min="0" value={requestLimit} onChange={(e) => setRequestLimit(e.target.value)} placeholder="например, 50000" className="rounded-xl mb-3" data-testid="credit-request-limit" />
                <label className="block text-xs font-medium text-slate-500 mb-1">Комментарий (необязательно)</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none mb-4" data-testid="credit-request-message" />
                <Button onClick={submitRequest} disabled={submitting} className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white rounded-xl" data-testid="credit-request-submit">
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Отправить запрос
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
