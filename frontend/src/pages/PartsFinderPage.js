import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Search, Wrench, Sparkles, Info, Loader2, ArrowRight, Package, Lock, Crown, Wallet, Coins, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FIELDS = [
  { key: 'vin', label: 'VIN', placeholder: 'WMA06XZZ7...' },
  { key: 'brand', label: 'Марка', placeholder: 'MAN, Volvo, DAF...' },
  { key: 'model', label: 'Модель', placeholder: 'TGA, FH, XF...' },
  { key: 'year', label: 'Год', placeholder: '2018' },
  { key: 'engine', label: 'Двигатель', placeholder: 'D2066, D13...' },
  { key: 'axle', label: 'Номер оси / мост', placeholder: 'напр. HY-1336' },
  { key: 'cross_number', label: 'Кросс-номер', placeholder: 'аналог/замена артикула' },
];

const fmtPrice = (v) => new Intl.NumberFormat('ru-RU').format(Math.round(v || 0));
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return ''; } };

export default function PartsFinderPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ vin: '', brand: '', model: '', year: '', engine: '', axle: '', cross_number: '', query: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [access, setAccess] = useState(null);
  const [payPrompt, setPayPrompt] = useState(null);
  const [showSub, setShowSub] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fetchAccess = useCallback(async () => {
    if (!user) return;
    try {
      const r = await axios.get(`${API}/parts-finder/access`);
      setAccess(r.data);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { fetchAccess(); }, [fetchAccess]);

  const runSearch = async (payWith = '') => {
    if (!user) { setError('Войдите в аккаунт, чтобы пользоваться подбором'); return; }
    if (!Object.values(form).some((v) => v.trim())) { setError('Заполните хотя бы одно поле'); return; }
    setError('');
    setLoading(true);
    setResult(null);
    setPayPrompt(null);
    try {
      const res = await axios.post(`${API}/parts-finder/search`, { ...form, pay_with: payWith });
      if (res.data.requires_payment) {
        setPayPrompt(res.data);
      } else {
        setResult(res.data);
        if (res.data.charged) {
          toast.success(res.data.charged.method === 'points'
            ? `Списано ${fmtPrice(res.data.charged.amount)} баллов`
            : `Списано ${fmtPrice(res.data.charged.amount)} ₽ с баланса`);
        }
        fetchAccess();
      }
    } catch (err) {
      const code = err.response?.status;
      if (code === 401 || code === 403) setError('Войдите в аккаунт, чтобы пользоваться подбором');
      else setError(err.response?.data?.detail || 'Ошибка подбора. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async (payWith) => {
    setBusy(true);
    try {
      await axios.post(`${API}/parts-finder/subscribe`, { pay_with: payWith });
      toast.success('Подписка оформлена!');
      setShowSub(false);
      fetchAccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Не удалось оформить подписку');
    } finally {
      setBusy(false);
    }
  };

  const paid = access?.paid_enabled;
  const hasSub = access?.has_subscription;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Умный подбор
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 flex items-center gap-3">
            <Wrench className="w-8 h-8 text-teal-500" /> Подбор запчастей
          </h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base max-w-2xl">
            Укажите VIN, марку/модель, двигатель, номер оси или кросс-номер — система подберёт подходящие артикулы из нашего каталога.
          </p>
        </motion.div>

        {/* Not logged in */}
        {!user && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center" data-testid="finder-login-required">
            <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">Подбор доступен авторизованным пользователям</p>
            <p className="text-slate-400 text-sm mt-1">Войдите в аккаунт, чтобы воспользоваться подбором запчастей.</p>
            <Link to="/login"><Button className="mt-4 bg-teal-500 hover:bg-teal-600 text-white px-8" data-testid="finder-login-btn">Войти</Button></Link>
          </div>
        )}

        {/* Access / pricing bar */}
        {user && paid && access && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6" data-testid="finder-access-bar">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasSub ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  {hasSub ? (
                    <>
                      <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Подписка активна</p>
                      <p className="text-xs text-slate-400" data-testid="finder-sub-until">Безлимит до {fmtDate(access.subscription_until)}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-800 text-sm">Платный подбор</p>
                      <p className="text-xs text-slate-400" data-testid="finder-price-info">
                        Разовый запрос: <b>{fmtPrice(access.request_price)} ₽</b> или <b>{fmtPrice(access.request_price_points)} баллов</b>
                        {access.free_remaining > 0 && <> · бесплатных осталось: {access.free_remaining}</>}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-xs text-slate-500">
                  <p>Баланс: <b className="text-slate-700">{fmtPrice(access.balance)} ₽</b></p>
                  <p>Баллы: <b className="text-slate-700">{fmtPrice(access.points)}</b></p>
                </div>
                {!hasSub && (
                  <Button onClick={() => setShowSub((v) => !v)} variant="outline"
                    className="border-teal-300 text-teal-700 hover:bg-teal-50" data-testid="finder-open-sub-btn">
                    <Crown className="w-4 h-4 mr-1.5" /> Подписка
                  </Button>
                )}
              </div>
            </div>

            {/* Subscription purchase panel */}
            {showSub && !hasSub && (
              <div className="mt-4 pt-4 border-t border-slate-100" data-testid="finder-sub-panel">
                <p className="text-sm text-slate-600 mb-3">
                  Подписка на <b>{access.subscription_days} дней</b> — безлимитный подбор. Выберите способ оплаты:
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => subscribe('balance')} disabled={busy || access.balance < access.subscription_price}
                    className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="finder-sub-balance-btn">
                    <Wallet className="w-4 h-4 mr-1.5" /> {fmtPrice(access.subscription_price)} ₽ с баланса
                  </Button>
                  <Button onClick={() => subscribe('points')} disabled={busy || access.points < access.subscription_price_points}
                    variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" data-testid="finder-sub-points-btn">
                    <Coins className="w-4 h-4 mr-1.5" /> {fmtPrice(access.subscription_price_points)} баллов
                  </Button>
                </div>
                {access.balance < access.subscription_price && access.points < access.subscription_price_points && (
                  <p className="text-xs text-rose-500 mt-2">Недостаточно средств и баллов для подписки.</p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Form */}
        {user && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6" data-testid="parts-finder-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs text-slate-600">{f.label}</Label>
                  <Input value={form[f.key]} onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder} className="mt-1" data-testid={`finder-${f.key}`} />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Label className="text-xs text-slate-600">Что ищете (описание детали)</Label>
              <Input value={form.query} onChange={(e) => update('query', e.target.value)}
                placeholder="напр. фильтр топливный, тормозные колодки, ступичный подшипник..."
                onKeyDown={(e) => e.key === 'Enter' && runSearch()} className="mt-1" data-testid="finder-query" />
            </div>
            {error && <p className="text-sm text-rose-500 mt-3" data-testid="finder-error">{error}</p>}
            <Button onClick={() => runSearch()} disabled={loading}
              className="mt-5 w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white px-8" data-testid="finder-search-btn">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Подбираем...</> : <><Search className="w-4 h-4 mr-2" /> Подобрать запчасть</>}
            </Button>
          </motion.div>
        )}

        {/* Payment prompt for one-time request */}
        {payPrompt && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-white rounded-2xl border-2 border-teal-200 shadow-sm p-5 sm:p-6" data-testid="finder-pay-prompt">
            <p className="font-semibold text-slate-800">Оплата подбора</p>
            <p className="text-sm text-slate-500 mt-1">
              Разовый запрос стоит <b>{fmtPrice(payPrompt.request_price)} ₽</b> или <b>{fmtPrice(payPrompt.request_price_points)} баллов</b>.
              Выберите способ оплаты — результат покажем сразу после списания.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Button onClick={() => runSearch('balance')} disabled={loading || payPrompt.balance < payPrompt.request_price}
                className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="finder-pay-balance-btn">
                <Wallet className="w-4 h-4 mr-1.5" /> {fmtPrice(payPrompt.request_price)} ₽ (баланс: {fmtPrice(payPrompt.balance)})
              </Button>
              <Button onClick={() => runSearch('points')} disabled={loading || payPrompt.points < payPrompt.request_price_points}
                variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" data-testid="finder-pay-points-btn">
                <Coins className="w-4 h-4 mr-1.5" /> {fmtPrice(payPrompt.request_price_points)} баллов (есть: {fmtPrice(payPrompt.points)})
              </Button>
            </div>
            {payPrompt.balance < payPrompt.request_price && payPrompt.points < payPrompt.request_price_points && (
              <p className="text-xs text-rose-500 mt-3">Недостаточно средств и баллов. Оформите подписку или пополните баланс.</p>
            )}
          </motion.div>
        )}

        {/* Results */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8" data-testid="finder-results">
            {result.note && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-teal-50 border border-teal-200 mb-4">
                <Info className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-teal-800">{result.note}</p>
              </div>
            )}

            {result.results.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Ничего не найдено. Уточните параметры или опишите деталь подробнее.
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-800">Найдено вариантов: {result.count}</h2>
                {result.results.map((p) => (
                  <Link key={p.id} to={`/product/${p.id}`}
                    className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-3 hover:border-teal-300 hover:shadow-md transition-all group"
                    data-testid={`finder-result-${p.id}`}>
                    <div className="w-16 h-16 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {p.image_url ? <img src={p.image_url} alt="" className="max-w-full max-h-full object-contain" /> : <Package className="w-7 h-7 text-slate-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-teal-600">{p.article}</span>
                        {p.manufacturer && <span className="text-xs text-slate-400">{p.manufacturer}</span>}
                        {typeof p.confidence === 'number' && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.confidence >= 60 ? 'bg-emerald-100 text-emerald-700' : p.confidence >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            {p.confidence}% совпадение
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-slate-900 text-sm truncate mt-0.5">{p.name}</p>
                      {p.reason && <p className="text-xs text-slate-400 truncate mt-0.5">{p.reason}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-slate-900">{fmtPrice(p.price)} ₽</p>
                      <span className="text-xs text-teal-600 flex items-center gap-1 justify-end mt-1 group-hover:gap-2 transition-all">
                        Открыть <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
