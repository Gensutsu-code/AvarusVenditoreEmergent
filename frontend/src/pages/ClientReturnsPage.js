import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ShieldCheck, Package, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  pending: { label: 'На рассмотрении', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Одобрен', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  rejected: { label: 'Отклонён', color: 'bg-rose-100 text-rose-700', icon: XCircle },
};

export default function ClientReturnsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchReturns();
  }, [user, authLoading, navigate]);

  const fetchReturns = async () => {
    try {
      const res = await axios.get(`${API}/returns`);
      setReturns(res.data);
    } catch (e) {
      console.error('Failed to fetch returns', e);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (p) => new Intl.NumberFormat('ru-RU').format(p);
  const formatDate = (d) =>
    new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  if (!user) return null;

  return (
    <div className="min-h-screen relative" data-testid="client-returns-page">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 mb-4"
          data-testid="back-to-orders-link"
        >
          <ArrowLeft className="w-4 h-4" />
          К моим заказам
        </Link>

        <motion.div
          className="flex items-center gap-4 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <RefreshCw className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Мои возвраты</h1>
            <p className="text-sm text-slate-500">
              {returns.length > 0 ? `${returns.length} заявок` : 'История возвратов'}
            </p>
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Загрузка...</p>
          </div>
        ) : returns.length === 0 ? (
          <motion.div
            className="text-center py-16 glass-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            data-testid="no-returns"
          >
            <RefreshCw className="w-20 h-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">У вас пока нет возвратов</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {returns.map((ret, idx) => {
                const status = STATUS_CONFIG[ret.status] || STATUS_CONFIG.pending;
                const StatusIcon = status.icon;
                const typeLabel = ret.type === 'warranty' ? 'Возврат по гарантии' : 'Возврат';
                const TypeIcon = ret.type === 'warranty' ? ShieldCheck : RefreshCw;
                const isExpanded = expanded[ret.id];

                return (
                  <motion.div
                    key={ret.id}
                    className="glass-card overflow-hidden"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    data-testid={`return-card-${ret.id}`}
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-slate-50/50 transition"
                      onClick={() => setExpanded((p) => ({ ...p, [ret.id]: !p[ret.id] }))}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
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
                            <p className="font-semibold text-slate-800">
                              {typeLabel} #{ret.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Заказ #{ret.order_id.slice(0, 8)} · {formatDate(ret.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {ret.type === 'return' && (
                            <span className="font-mono font-bold text-emerald-600">
                              {formatPrice(ret.total_refund)} ₽
                            </span>
                          )}
                          <span
                            className={`px-3 py-1 text-xs font-bold uppercase rounded-lg flex items-center gap-1 ${status.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-200/50"
                        >
                          <div className="p-4 space-y-3">
                            {ret.reason && (
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-xs text-slate-400 mb-1">Причина</p>
                                <p className="text-sm text-slate-700">{ret.reason}</p>
                              </div>
                            )}

                            {ret.admin_comment && (
                              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <p className="text-xs text-amber-600 mb-1">Комментарий администратора</p>
                                <p className="text-sm text-amber-800">{ret.admin_comment}</p>
                              </div>
                            )}

                            {ret.photos && ret.photos.length > 0 && (
                              <div>
                                <p className="text-xs text-slate-400 mb-2">Фото</p>
                                <div className="flex flex-wrap gap-2">
                                  {ret.photos.map((url, i) => (
                                    <a
                                      key={i}
                                      href={url.startsWith('http') ? url : `${BACKEND_URL}${url}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block w-20 h-20 rounded-xl overflow-hidden border border-slate-200 hover:border-teal-400 transition"
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

                            <div>
                              <p className="text-xs text-slate-400 mb-2">Товары к возврату</p>
                              <div className="space-y-2">
                                {(ret.items || []).map((item, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-3 p-2 bg-slate-50/80 rounded-xl border border-slate-100"
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
                                        {formatPrice(item.price)} ₽ × {item.quantity}
                                      </p>
                                    </div>
                                    {ret.type === 'return' && (
                                      <div className="text-right text-xs">
                                        <p className="text-rose-500">
                                          −{formatPrice(item.deduction)} ₽
                                        </p>
                                        <p className="font-bold text-emerald-600">
                                          {formatPrice(item.refund)} ₽
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {ret.type === 'return' && (
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-rose-500">Удержание 10%:</span>
                                  <span className="font-medium text-rose-500">
                                    −{formatPrice(ret.total_deduction)} ₽
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-amber-600">Списано бонусных баллов:</span>
                                  <span className="font-medium text-amber-600">
                                    {formatPrice(ret.total_bonus_deduction)}
                                  </span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-slate-200">
                                  <span className="font-semibold">К возврату на баланс:</span>
                                  <span className="font-bold text-emerald-600">
                                    {formatPrice(ret.total_refund)} ₽
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
