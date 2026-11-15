import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ShieldCheck, Package, Check, X, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import ReturnSettingsPanel from '../components/admin/ReturnSettingsPanel';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  pending: { label: 'На рассмотрении', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Одобрен', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  rejected: { label: 'Отклонён', color: 'bg-rose-100 text-rose-700', icon: XCircle },
};

export default function AdminReturnsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | pending | approved | rejected
  const [actionModal, setActionModal] = useState(null); // { return, action: "approve" | "reject" }
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchReturns();
    const interval = setInterval(fetchReturns, 30000);
    return () => clearInterval(interval);
  }, [user, authLoading, navigate]);

  const fetchReturns = async () => {
    try {
      const res = await axios.get(`${API}/admin/returns`);
      setReturns(res.data);
    } catch (e) {
      toast.error('Не удалось загрузить возвраты');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setSubmitting(true);
    try {
      const endpoint = actionModal.action === 'approve' ? 'approve' : 'reject';
      await axios.put(
        `${API}/admin/returns/${actionModal.return.id}/${endpoint}`,
        { comment: comment.trim() }
      );
      toast.success(
        actionModal.action === 'approve' ? 'Возврат одобрен' : 'Возврат отклонён'
      );
      setActionModal(null);
      setComment('');
      fetchReturns();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadDoc = async (ret) => {
    try {
      const res = await axios.get(`${API}/admin/orders/${ret.order_id}/return-document?return_id=${ret.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Акт_возврата_${ret.id.slice(0, 8)}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Ошибка скачивания документа');
    }
  };

  const formatPrice = (p) => new Intl.NumberFormat('ru-RU').format(p);
  const formatDate = (d) =>
    new Date(d).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const filtered = filter === 'all' ? returns : returns.filter((r) => r.status === filter);
  const counts = {
    all: returns.length,
    pending: returns.filter((r) => r.status === 'pending').length,
    approved: returns.filter((r) => r.status === 'approved').length,
    rejected: returns.filter((r) => r.status === 'rejected').length,
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-returns-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <RefreshCw className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Возвраты</h1>
            <p className="text-sm text-slate-500">Заявки клиентов на возврат и гарантийную замену</p>
          </div>
        </div>

        {/* Return rules & policy editor */}
        <ReturnSettingsPanel />

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'all', label: 'Все' },
            { key: 'pending', label: 'На рассмотрении' },
            { key: 'approved', label: 'Одобрены' },
            { key: 'rejected', label: 'Отклонены' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                filter === f.key
                  ? 'bg-teal-500 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
              data-testid={`filter-${f.key}`}
            >
              {f.label} ({counts[f.key]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <RefreshCw className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Нет возвратов</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ret) => {
              const status = STATUS_CONFIG[ret.status] || STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              const TypeIcon = ret.type === 'warranty' ? ShieldCheck : RefreshCw;
              const typeLabel = ret.type === 'warranty' ? 'Гарантия' : 'Возврат';

              return (
                <motion.div
                  key={ret.id}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  data-testid={`admin-return-${ret.id}`}
                >
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            ret.type === 'warranty' ? 'bg-blue-100' : 'bg-teal-100'
                          }`}
                        >
                          <TypeIcon
                            className={`w-5 h-5 ${
                              ret.type === 'warranty' ? 'text-blue-600' : 'text-teal-600'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800">
                              #{ret.id.slice(0, 8)}
                            </p>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-lg ${
                                ret.type === 'warranty'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-teal-100 text-teal-700'
                              }`}
                            >
                              {typeLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {ret.user_name || ret.user_email} · Заказ #{ret.order_id.slice(0, 8)} ·{' '}
                            {formatDate(ret.created_at)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-bold uppercase rounded-lg flex items-center gap-1 ${status.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>

                    {ret.reason && (
                      <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-400 mb-1">Причина клиента</p>
                        <p className="text-sm text-slate-700">{ret.reason}</p>
                      </div>
                    )}

                    <div className="space-y-2 mb-4">
                      {(ret.items || []).map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl"
                        >
                          <div className="w-10 h-10 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-slate-200">
                            {item.image_url ? (
                              <img
                                src={
                                  item.image_url.startsWith('http')
                                    ? item.image_url
                                    : `${BACKEND_URL}${item.image_url}`
                                }
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.article && <span className="font-mono mr-2">{item.article}</span>}
                              {formatPrice(item.price)} ₽ × {item.quantity}
                            </p>
                          </div>
                          {ret.type === 'return' && (
                            <div className="text-right text-xs">
                              <p className="text-slate-500">
                                {formatPrice(item.item_total)} ₽
                              </p>
                              <p className="text-rose-500">
                                −{formatPrice(item.deduction)} ₽ ({ret.fee_percent ?? 10}%)
                              </p>
                              <p className="font-bold text-emerald-600">
                                {formatPrice(item.refund)} ₽
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {ret.type === 'return' && (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-sm space-y-1 mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Итого удержание {ret.fee_percent ?? 10}%:</span>
                          <span className="font-medium text-rose-500">
                            −{formatPrice(ret.total_deduction)} ₽
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Списание бонусов:</span>
                          <span className="font-medium text-amber-600">
                            {formatPrice(ret.total_bonus_deduction)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-emerald-200">
                          <span className="font-semibold text-slate-700">К возврату на баланс:</span>
                          <span className="font-bold text-emerald-600">
                            {formatPrice(ret.total_refund)} ₽
                          </span>
                        </div>
                      </div>
                    )}

                    {ret.admin_comment && (
                      <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <p className="text-xs text-amber-600 mb-1">Комментарий администратора</p>
                        <p className="text-sm text-amber-800">{ret.admin_comment}</p>
                      </div>
                    )}

                    {ret.photos && ret.photos.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-slate-400 mb-2">Фото от клиента ({ret.photos.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {ret.photos.map((url, i) => (
                            <a
                              key={i}
                              href={url.startsWith('http') ? url : `${BACKEND_URL}${url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block w-24 h-24 rounded-xl overflow-hidden border border-slate-200 hover:border-teal-400 transition"
                              data-testid={`admin-photo-${ret.id}-${i}`}
                            >
                              <img
                                src={url.startsWith('http') ? url : `${BACKEND_URL}${url}`}
                                alt={`photo-${i}`}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadDoc(ret)}
                      className="rounded-xl border-amber-200 text-amber-600 hover:bg-amber-50 mb-3"
                      data-testid={`return-doc-btn-${ret.id}`}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Документ на возврат (Word)
                    </Button>

                    {ret.status === 'pending' && (
                      <div className="flex gap-3">
                        <Button
                          onClick={() => {
                            setActionModal({ return: ret, action: 'approve' });
                            setComment('');
                          }}
                          className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl"
                          data-testid={`approve-btn-${ret.id}`}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Одобрить
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setActionModal({ return: ret, action: 'reject' });
                            setComment('');
                          }}
                          className="border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl"
                          data-testid={`reject-btn-${ret.id}`}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Отклонить
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action confirmation modal */}
      <AnimatePresence>
        {actionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setActionModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              data-testid="action-modal"
            >
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">
                  {actionModal.action === 'approve' ? 'Одобрить возврат' : 'Отклонить возврат'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {actionModal.action === 'approve' ? (
                    actionModal.return.type === 'return' ? (
                      <>
                        Клиенту будет зачислено{' '}
                        <strong>{formatPrice(actionModal.return.total_refund)} ₽</strong> на баланс и
                        списано <strong>{formatPrice(actionModal.return.total_bonus_deduction)}</strong>{' '}
                        бонусных баллов.
                      </>
                    ) : (
                      'Клиенту будет отправлено подтверждение гарантийной замены.'
                    )
                  ) : (
                    'Клиенту будет отправлено уведомление об отклонении возврата.'
                  )}
                </p>
              </div>

              <div className="p-5">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Комментарий {actionModal.action === 'reject' && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder={
                    actionModal.action === 'approve'
                      ? 'Необязательный комментарий...'
                      : 'Укажите причину отклонения...'
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-400 resize-none"
                  data-testid="action-comment-input"
                />
              </div>

              <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActionModal(null)}
                  className="rounded-xl"
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={
                    submitting || (actionModal.action === 'reject' && !comment.trim())
                  }
                  className={
                    actionModal.action === 'approve'
                      ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl'
                      : 'bg-rose-500 hover:bg-rose-600 text-white rounded-xl'
                  }
                  data-testid="confirm-action-btn"
                >
                  {submitting
                    ? 'Отправка...'
                    : actionModal.action === 'approve'
                    ? 'Одобрить'
                    : 'Отклонить'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
