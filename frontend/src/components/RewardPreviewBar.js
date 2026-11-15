import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Award, Wallet, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatPrice = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p));

const VIEW = {
  points: { icon: Award, color: 'text-amber-600', label: 'Бонусные баллы за заказ', unit: 'б.' },
  ozon: { icon: Gift, color: 'text-indigo-600', label: 'Сертификат Ozon за заказ', unit: '₽' },
  cashback: { icon: Wallet, color: 'text-emerald-600', label: 'Кэшбэк за заказ', unit: '₽' },
};

/** Reward the client will get for the current cart in their chosen bonus system. */
export const RewardPreviewBar = ({ total = 0, compact = false, promoCode }) => {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user) { setData(null); return undefined; }
    const t = setTimeout(() => {
      axios.get(`${API}/rewards/cart-preview`, { params: { amount: total || undefined, promo_code: promoCode || undefined } })
        .then((r) => setData(r.data)).catch(() => setData(null));
    }, 350);
    return () => clearTimeout(t);
  }, [user, total, promoCode]);

  if (!data) return null;
  const wrap = compact ? 'px-4 py-3 border-b border-slate-100' : 'glass-card p-4 mb-6';

  if (!data.system) {
    if (!data.needs_choice) return null;
    return (
      <Link to="/bonus" className={`${wrap} flex items-center justify-between gap-2 group`} data-testid="reward-choose-prompt">
        <span className={`font-semibold text-slate-700 flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          <Gift className={`text-teal-500 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          Выберите бонусную систему и получайте вознаграждение за заказы
        </span>
        <ArrowRight className="w-4 h-4 text-teal-500 transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    );
  }

  const v = VIEW[data.system];
  const Icon = v.icon;
  const belowMin = data.min_order > 0 && total > 0 && total < data.min_order;
  return (
    <div className={wrap} data-testid="reward-preview-bar">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`font-semibold text-slate-700 flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          <Icon className={`${v.color} ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          {v.label}
        </span>
        <span className={`font-bold tabular-nums ${v.color} ${compact ? 'text-sm' : 'text-base'}`} data-testid="reward-preview-amount">
          +{formatPrice(data.amount)} {v.unit}
        </span>
      </div>
      {belowMin && (
        <p className="text-[11px] text-slate-400 mt-1" data-testid="reward-preview-min-order">
          Вознаграждение начисляется при заказе от {formatPrice(data.min_order)} ₽
        </p>
      )}
    </div>
  );
};
