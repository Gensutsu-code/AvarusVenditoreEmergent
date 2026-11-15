import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Percent, Ticket, ShoppingCart, BadgePercent, Gift, CalendarClock, Undo2, Car, Sparkles, Wrench, MessageCircle,
  PackageSearch, Heart, Newspaper, MapPinned, Megaphone, Users, ShoppingBasket, Send, ChevronRight, SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeaturesContext';
import { SITE_FEATURES, FEATURE_GROUPS } from '../lib/siteFeatures';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { FeatureSettingsPanel, hasFeaturePanel } from '../components/admin/FeatureSettingsPanel';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ICONS = {
  discounts: Percent, promo_codes: Ticket, cart_discounts: ShoppingCart, price_requests: BadgePercent, rewards: Gift,
  credit: CalendarClock, returns: Undo2, garage: Car, ai_assistant: Sparkles, parts_finder: Wrench, chat: MessageCircle,
  product_requests: PackageSearch, favorites: Heart, news: Newspaper, warehouses_map: MapPinned, promo_banner: Megaphone,
  managers: Users, admin_carts: ShoppingBasket, telegram: Send,
};
const AUDIENCES = [['all', 'Всем'], ['retail', 'Только рознице'], ['wholesale', 'Только опту']];

const FeatureCard = ({ feature, enabled, onOpen, onToggle }) => {
  const Icon = ICONS[feature.key];
  return (
    <div
      className={`group flex items-start gap-4 p-5 rounded-2xl border bg-white transition-colors duration-200 ${enabled ? 'border-slate-200 hover:border-teal-400' : 'border-slate-200 bg-slate-50'}`}
      data-testid={`feature-card-${feature.key}`}
    >
      <button type="button" onClick={onOpen} className="flex items-start gap-4 flex-1 min-w-0 text-left" data-testid={`feature-open-${feature.key}`}>
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${enabled ? 'bg-teal-50 text-teal-600' : 'bg-slate-200 text-slate-400'}`}>
          <Icon className="w-5 h-5" />
        </span>
        <span className="min-w-0">
          <span className={`flex items-center gap-1.5 font-bold tracking-tight ${enabled ? 'text-slate-900' : 'text-slate-500'}`}>
            {feature.title}
            <ChevronRight className="w-4 h-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
          <span className="block text-sm text-slate-500 mt-0.5">{feature.short}</span>
          <span className="mt-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
            <span className={enabled ? 'text-emerald-600' : 'text-rose-500'} data-testid={`feature-status-${feature.key}`}>{enabled ? 'Включено' : 'Отключено'}</span>
            {hasFeaturePanel(feature.key) && <span className="text-slate-400 flex items-center gap-1"><SlidersHorizontal className="w-3 h-3" />есть настройки</span>}
          </span>
        </span>
      </button>
      <Switch checked={enabled} onCheckedChange={onToggle} data-testid={`feature-switch-${feature.key}`} />
    </div>
  );
};

export default function AdminFeaturesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { flags, isEnabled, reload } = useFeatures();
  const [opened, setOpened] = useState(null);
  const [confirm, setConfirm] = useState(null); // { feature, enabled }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user?.role !== 'admin') navigate('/');
  }, [user, loading, navigate]);

  const update = async (key, patch, message) => {
    setBusy(true);
    try {
      await axios.put(`${API}/admin/features/${key}`, patch);
      await reload();
      toast.success(message);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    } finally { setBusy(false); }
  };

  const applyToggle = async () => {
    const { feature, enabled } = confirm;
    await update(feature.key, { enabled }, `«${feature.title}» ${enabled ? 'включена' : 'отключена'}`);
    setConfirm(null);
  };

  if (user?.role !== 'admin') return null;
  const offCount = SITE_FEATURES.filter((f) => !isEnabled(f.key)).length;

  return (
    <div className="min-h-screen" data-testid="admin-features-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Админ-панель</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tighter text-slate-900">Функционал сайта</h1>
        <p className="mt-3 text-base text-slate-500 max-w-2xl">
          Включайте и отключайте функции магазина. Отключённая функция исчезает у клиентов и из админ-панели, а её данные сохраняются.
          Нажмите на функцию, чтобы прочитать описание и настроить её.
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-700" data-testid="features-summary">
          Включено {SITE_FEATURES.length - offCount} из {SITE_FEATURES.length}
        </p>

        {FEATURE_GROUPS.map((group, gi) => (
          <motion.section key={group.id} className="mt-10" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: gi * 0.06 }}>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 mb-3">{group.title}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {SITE_FEATURES.filter((f) => f.group === group.id).map((f) => (
                <FeatureCard
                  key={f.key}
                  feature={f}
                  enabled={isEnabled(f.key)}
                  onOpen={() => setOpened(f)}
                  onToggle={(v) => setConfirm({ feature: f, enabled: v })}
                />
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent data-testid="feature-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.enabled ? 'Включить' : 'Отключить'} «{confirm?.feature.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.enabled
                ? 'Функция снова появится у клиентов и в админ-панели со всеми сохранёнными данными и настройками.'
                : 'Функция сразу исчезнет у клиентов и из админ-панели. Данные и настройки сохранятся и вернутся при включении.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="feature-confirm-cancel">Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); applyToggle(); }} disabled={busy} data-testid="feature-confirm-apply"
              className={confirm?.enabled ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'}>
              {confirm?.enabled ? 'Включить' : 'Отключить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!opened} onOpenChange={(v) => !v && setOpened(null)}>
        <DialogContent className="rounded-2xl max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="feature-detail-dialog">
          {opened && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight">{opened.title}</DialogTitle>
                <DialogDescription className="text-base text-slate-600 leading-relaxed" data-testid="feature-full-description">{opened.full}</DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch checked={isEnabled(opened.key)} onCheckedChange={(v) => setConfirm({ feature: opened, enabled: v })} data-testid="feature-detail-switch" />
                  <span className="text-sm font-semibold text-slate-800">{isEnabled(opened.key) ? 'Функция включена' : 'Функция отключена'}</span>
                </label>
                {opened.audience && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 ml-auto">
                    Кому доступна:
                    <select
                      value={flags[opened.key]?.audience || 'all'}
                      disabled={busy}
                      onChange={(e) => update(opened.key, { audience: e.target.value }, 'Аудитория функции изменена')}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
                      data-testid="feature-audience-select"
                    >
                      {AUDIENCES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3">Настройки функции</h3>
                <FeatureSettingsPanel featureKey={opened.key} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
