import { useEffect, useState } from 'react';
import axios from 'axios';
import { Flame, ArrowRight, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const pad = (n) => String(n).padStart(2, '0');

function useCountdown(targetIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetIso) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetIso]);
  if (!targetIso) return null;
  let target;
  try {
    const iso = String(targetIso).includes('T') ? targetIso : `${targetIso}T23:59:59+00:00`;
    target = new Date(iso).getTime();
  } catch (_) {
    return null;
  }
  const diff = target - now;
  if (Number.isNaN(diff) || diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

export default function DiscountPromoBanner({ onOpenDiscounts }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${API}/products/discount-summary`)
      .then((res) => {
        if (alive) setSummary(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const countdown = useCountdown(summary?.earliest_until);

  if (loading || !summary || !summary.total_count || summary.total_count <= 0) return null;

  const productWord = (n) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'товар';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'товара';
    return 'товаров';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      data-testid="discount-promo-banner"
      className="relative overflow-hidden rounded-2xl mb-6 border border-rose-200/60 shadow-lg shadow-rose-500/10"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500" />
      {/* Decorative blurred blobs */}
      <div className="absolute -top-12 -left-10 w-48 h-48 rounded-full bg-amber-300/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 right-10 w-56 h-56 rounded-full bg-fuchsia-300/30 blur-3xl pointer-events-none" />
      {/* Animated subtle pulse */}
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-white/5"
        animate={{ opacity: [0.05, 0.15, 0.05] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      <div className="relative px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        {/* Left: icon + headline */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-white font-extrabold text-lg sm:text-xl tracking-tight">
                Горячие предложения
              </span>
              {summary.max_percent > 0 && (
                <span
                  data-testid="discount-promo-max-percent"
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-rose-600 text-xs font-bold"
                >
                  до −{Math.round(summary.max_percent)}%
                </span>
              )}
            </div>
            <p className="text-white/90 text-sm mt-0.5 truncate">
              <span data-testid="discount-promo-count" className="font-semibold">
                {summary.total_count}
              </span>{' '}
              {productWord(summary.total_count)} со скидкой — успейте забрать
            </p>
          </div>
        </div>

        {/* Middle: countdown */}
        {countdown && (
          <div
            data-testid="discount-promo-countdown"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25"
          >
            <Clock className="w-4 h-4 text-white/90" />
            <div className="flex items-center gap-1 font-mono text-white text-sm">
              {countdown.days > 0 && (
                <>
                  <span className="font-bold">{countdown.days}</span>
                  <span className="text-white/70 text-xs">д</span>
                </>
              )}
              <span className="font-bold ml-1">{pad(countdown.hours)}</span>
              <span className="text-white/70">:</span>
              <span className="font-bold">{pad(countdown.minutes)}</span>
              <span className="text-white/70">:</span>
              <span className="font-bold">{pad(countdown.seconds)}</span>
            </div>
          </div>
        )}

        {/* Right: CTA */}
        <button
          onClick={onOpenDiscounts}
          data-testid="discount-promo-cta"
          className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-rose-600 font-semibold text-sm shadow-md hover:shadow-xl hover:bg-rose-50 transition-all whitespace-nowrap"
        >
          Смотреть все
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </motion.div>
  );
}
