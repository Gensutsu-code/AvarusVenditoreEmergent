import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gift } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatPrice = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p));

/**
 * Ozon certificate progress: +REWARD₽ certificate for every STEP₽ of order goods.
 * STEP/REWARD/enabled come from admin settings (/ozon-settings).
 */
export const OzonCertificateBar = ({ total = 0, compact = false }) => {
  const [cfg, setCfg] = useState({ ozon_enabled: true, ozon_step: 10000, ozon_reward: 500 });

  useEffect(() => {
    axios.get(`${API}/ozon-settings`).then((r) => setCfg(r.data)).catch(() => {});
  }, []);

  if (!cfg.ozon_enabled || !cfg.ozon_reward) return null;

  const STEP = Math.max(1, cfg.ozon_step || 10000);
  const REWARD = cfg.ozon_reward || 500;
  const tranches = Math.floor(total / STEP);
  const certificate = tranches * REWARD;
  const within = total - tranches * STEP;
  const pct = Math.min(100, (within / STEP) * 100);
  const toNext = STEP - within;

  return (
    <div
      className={compact ? 'px-4 py-3 border-b border-slate-100' : 'glass-card p-4 mb-6'}
      data-testid="ozon-certificate-bar"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <span className={`font-semibold text-slate-700 flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          <Gift className={`text-indigo-500 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          {certificate > 0 ? (
            <span>
              Сертификат Ozon: <span className="font-bold text-indigo-600" data-testid="ozon-cert-amount">{formatPrice(certificate)} ₽</span>
            </span>
          ) : (
            <span>Сертификат Ozon за заказ</span>
          )}
        </span>
        <span className={`text-slate-400 whitespace-nowrap ${compact ? 'text-[11px]' : 'text-xs'}`} data-testid="ozon-cert-tonext">
          +{formatPrice(REWARD)} ₽ ещё через {formatPrice(toNext)} ₽
        </span>
      </div>
      <div className={`w-full rounded-full bg-slate-100 overflow-hidden ${compact ? 'h-2' : 'h-2.5'}`}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};
