import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLive } from '../lib/live';
import { motion } from 'framer-motion';
import { CreditCard, Clock, CheckCircle, AlertTriangle, Check, X, Wallet, Users, Loader2, Pencil, Send } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p || 0));
const daysLeft = (due) => {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

const TABS = [
  { id: 'requests', label: 'Запросы' },
  { id: 'accounts', label: 'Лимиты клиентов' },
  { id: 'deferrals', label: 'Долги по отсрочке' },
];

export default function AdminCreditPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [deferrals, setDeferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approveModal, setApproveModal] = useState(null); // { request }
  const [limitModal, setLimitModal] = useState(null); // { account }
  const [limit, setLimit] = useState('');
  const [term, setTerm] = useState('30');
  const [respMsg, setRespMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = async () => {
    try {
      const [r, a, d] = await Promise.all([
        axios.get(`${API}/admin/credit-requests`),
        axios.get(`${API}/admin/credit-accounts`),
        axios.get(`${API}/admin/deferrals`),
      ]);
      setRequests(r.data);
      setAccounts(a.data);
      setDeferrals(d.data);
    } catch { toast.error('Ошибка загрузки данных'); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') { navigate('/login'); return; }
    fetchAll();
  }, [user, authLoading, navigate]);
  useLive(fetchAll, 10000, user?.role === 'admin');

  const openApprove = (request) => {
    setApproveModal({ request });
    setLimit(String(request.requested_limit || ''));
    setTerm('30');
    setRespMsg('');
  };

  const openLimit = (account) => {
    setLimitModal({ account });
    setLimit(String(account.credit_limit || ''));
    setTerm(String(account.credit_term_days || 30));
  };

  const submitApprove = async () => {
    const val = Number(limit);
    if (!val || val <= 0) { toast.error('Укажите лимит'); return; }
    setSubmitting(true);
    try {
      await axios.put(`${API}/admin/credit-requests/${approveModal.request.id}/approve`, {
        limit: val, term_days: Number(term) || 30, response_message: respMsg,
      });
      toast.success('Отсрочка одобрена');
      setApproveModal(null); fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };

  const submitOffer = async () => {
    const val = Number(limit);
    if (!val || val <= 0) { toast.error('Укажите лимит'); return; }
    setSubmitting(true);
    try {
      await axios.put(`${API}/admin/credit-requests/${approveModal.request.id}/offer`, {
        limit: val, term_days: Number(term) || 30, response_message: respMsg,
      });
      toast.success('Условия предложены клиенту');
      setApproveModal(null); fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };

  const rejectRequest = async (request) => {
    if (!window.confirm('Отклонить запрос на отсрочку?')) return;
    try {
      await axios.put(`${API}/admin/credit-requests/${request.id}/reject`, { response_message: '' });
      toast.success('Запрос отклонён'); fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
  };

  const submitLimit = async () => {
    const val = Number(limit);
    if (val < 0 || isNaN(val)) { toast.error('Некорректный лимит'); return; }
    setSubmitting(true);
    try {
      await axios.put(`${API}/admin/credit/${limitModal.account.id}/set-limit`, {
        limit: val, term_days: Number(term) || 30,
      });
      toast.success('Лимит обновлён');
      setLimitModal(null); fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmitting(false); }
  };

  const markPaid = async (deferral) => {
    if (!window.confirm(`Отметить отсрочку на ${fmt(deferral.amount)} ₽ как оплаченную?`)) return;
    try {
      await axios.put(`${API}/admin/deferrals/${deferral.id}/mark-paid`);
      toast.success('Отмечено как оплачено'); fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
  };

  if (!user || user.role !== 'admin') return null;

  const pendingReqs = requests.filter(r => r.status === 'pending');
  const unpaidDef = deferrals.filter(d => d.status === 'unpaid');
  const totalDebt = unpaidDef.reduce((s, d) => s + (d.amount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-credit-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Отсрочка платежа</h1>
            <p className="text-sm text-slate-500">Кредитные лимиты, запросы и погашение долгов</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-3" data-testid="credit-stat-pending">
            <Clock className="w-8 h-8 text-amber-400" />
            <div><p className="text-xs text-slate-500">Запросов в ожидании</p><p className="text-2xl font-bold text-slate-800">{pendingReqs.length}</p></div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-3" data-testid="credit-stat-accounts">
            <Users className="w-8 h-8 text-indigo-400" />
            <div><p className="text-xs text-slate-500">Клиентов с лимитом</p><p className="text-2xl font-bold text-slate-800">{accounts.length}</p></div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-3" data-testid="credit-stat-debt">
            <Wallet className="w-8 h-8 text-rose-400" />
            <div><p className="text-xs text-slate-500">Общий долг</p><p className="text-2xl font-bold text-rose-600">{fmt(totalDebt)} ₽</p></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-violet-600 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
              data-testid={`credit-tab-${t.id}`}>
              {t.label}
              {t.id === 'requests' && pendingReqs.length > 0 && <span className="ml-2 bg-amber-400 text-white text-xs rounded-full px-1.5">{pendingReqs.length}</span>}
              {t.id === 'deferrals' && unpaidDef.length > 0 && <span className="ml-2 bg-rose-400 text-white text-xs rounded-full px-1.5">{unpaidDef.length}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-violet-500" /></div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Requests tab */}
            {tab === 'requests' && (
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center text-slate-400 shadow-sm">Запросов нет</div>
                ) : requests.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap" data-testid={`credit-request-${r.id}`}>
                    <div>
                      <p className="font-semibold text-slate-800">{r.user_name || r.user_email}</p>
                      <p className="text-xs text-slate-400">{r.user_email} · {String(r.created_at).slice(0, 10)}</p>
                      {r.message && <p className="text-sm text-slate-600 mt-1 italic">«{r.message}»</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-800">{fmt(r.requested_limit)} ₽</p>
                      {r.status === 'pending' ? (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => openApprove(r)} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg" data-testid={`credit-approve-${r.id}`}><Check className="w-4 h-4 mr-1" />Условия</Button>
                          <Button size="sm" variant="outline" onClick={() => rejectRequest(r)} className="border-rose-200 text-rose-600 rounded-lg" data-testid={`credit-reject-${r.id}`}><X className="w-4 h-4 mr-1" />Отклонить</Button>
                        </div>
                      ) : (
                        <span className={`text-xs font-medium ${['approved', 'accepted'].includes(r.status) ? 'text-emerald-600' : r.status === 'offered' ? 'text-teal-600' : 'text-rose-500'}`}>
                          {r.status === 'approved' ? `Одобрено · ${fmt(r.approved_limit)} ₽`
                            : r.status === 'accepted' ? `Принято клиентом · ${fmt(r.approved_limit)} ₽`
                            : r.status === 'offered' ? `Предложено · ${fmt(r.offered_limit)} ₽ (ждём клиента)`
                            : r.status === 'rejected_by_client' ? 'Отклонено клиентом'
                            : 'Отклонено'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Accounts tab */}
            {tab === 'accounts' && (
              <div className="space-y-3">
                {accounts.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center text-slate-400 shadow-sm">Нет клиентов с лимитом</div>
                ) : accounts.map(a => (
                  <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap" data-testid={`credit-account-${a.id}`}>
                    <div>
                      <p className="font-semibold text-slate-800">{a.name || a.email}</p>
                      <p className="text-xs text-slate-400">{a.email} · срок {a.credit_term_days || 0} дн.</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Лимит</p>
                        <p className="font-bold text-slate-800">{fmt(a.credit_limit)} ₽</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Долг</p>
                        <p className="font-bold text-rose-600">{fmt(a.debt)} ₽</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Доступно</p>
                        <p className="font-bold text-emerald-600">{fmt(a.available)} ₽</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openLimit(a)} className="rounded-lg" data-testid={`credit-edit-limit-${a.id}`}><Pencil className="w-4 h-4 mr-1" />Изменить</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Deferrals tab */}
            {tab === 'deferrals' && (
              <div className="space-y-3">
                {deferrals.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center text-slate-400 shadow-sm">Нет закупок в отсрочку</div>
                ) : deferrals.map(d => {
                  const left = daysLeft(d.due_date);
                  const overdue = d.status === 'unpaid' && left !== null && left < 0;
                  return (
                    <div key={d.id} className={`bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap border ${overdue ? 'border-rose-200' : 'border-transparent'}`} data-testid={`admin-deferral-${d.id}`}>
                      <div>
                        <p className="font-semibold text-slate-800">{d.user_name || d.user_email}</p>
                        <p className="text-xs text-slate-400">Заказ #{String(d.order_id).slice(0, 8)} · {String(d.created_at).slice(0, 10)}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-800">{fmt(d.amount)} ₽</p>
                          {d.status === 'paid' ? (
                            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 justify-end"><CheckCircle className="w-3.5 h-3.5" />Оплачено</span>
                          ) : overdue ? (
                            <span className="text-xs font-medium text-rose-600 flex items-center gap-1 justify-end"><AlertTriangle className="w-3.5 h-3.5" />Просрочено {Math.abs(left)} дн.</span>
                          ) : (
                            <span className="text-xs font-medium text-amber-600 flex items-center gap-1 justify-end"><Clock className="w-3.5 h-3.5" />до {String(d.due_date).slice(0, 10)}</span>
                          )}
                        </div>
                        {d.status === 'unpaid' && (
                          <Button size="sm" onClick={() => markPaid(d)} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg" data-testid={`mark-paid-${d.id}`}><Check className="w-4 h-4 mr-1" />Оплачено</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Approve modal */}
      <Dialog open={!!approveModal} onOpenChange={(o) => !o && setApproveModal(null)}>
        <DialogContent className="rounded-2xl" data-testid="credit-approve-modal">
          <DialogTitle>Одобрить отсрочку</DialogTitle>
          <DialogDescription>Установите кредитный лимит и срок оплаты для {approveModal?.request?.user_name || approveModal?.request?.user_email}</DialogDescription>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Лимит, ₽</label>
              <Input type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} className="rounded-xl" data-testid="approve-limit-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Срок оплаты, дней</label>
              <Input type="number" min="1" value={term} onChange={(e) => setTerm(e.target.value)} className="rounded-xl" data-testid="approve-term-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Сообщение клиенту (необязательно)</label>
              <textarea value={respMsg} onChange={(e) => setRespMsg(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none" data-testid="approve-message-input" />
            </div>
            <Button onClick={submitApprove} disabled={submitting} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl" data-testid="approve-submit-btn">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}Одобрить сразу
            </Button>
            <Button onClick={submitOffer} disabled={submitting} className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl" data-testid="offer-submit-btn">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Предложить условия (нужно согласие клиента)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set limit modal */}
      <Dialog open={!!limitModal} onOpenChange={(o) => !o && setLimitModal(null)}>
        <DialogContent className="rounded-2xl" data-testid="credit-limit-modal">
          <DialogTitle>Изменить лимит</DialogTitle>
          <DialogDescription>{limitModal?.account?.name || limitModal?.account?.email}. Установите 0, чтобы отключить отсрочку.</DialogDescription>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Лимит, ₽</label>
              <Input type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} className="rounded-xl" data-testid="setlimit-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Срок оплаты, дней</label>
              <Input type="number" min="1" value={term} onChange={(e) => setTerm(e.target.value)} className="rounded-xl" data-testid="setlimit-term-input" />
            </div>
            <Button onClick={submitLimit} disabled={submitting} className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl" data-testid="setlimit-submit-btn">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
