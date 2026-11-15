import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Ticket, Copy, Check, Percent, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0));
const fmtDate = (d) => new Date(String(d).slice(0, 10)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

// Storefront banner: promo codes the admin chose to show + link to discounted products
export const PromoStrip = () => {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    axios.get(`${API}/promotions/active`).then((r) => setData(r.data)).catch(() => {});
  }, []);

  const codes = data?.promo_codes || [];
  const discounted = data?.discounted_products || 0;
  if (!codes.length && !discounted) return null;

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast.success(`Промокод ${code} скопирован — введите его в корзине`);
      setTimeout(() => setCopied(''), 2500);
    } catch {
      toast.info(`Промокод: ${code}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-slate-900 text-white"
      data-testid="promo-strip"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        {codes.map((c) => (
          <button
            key={c.code}
            onClick={() => copy(c.code)}
            className="group flex items-center gap-2 text-sm text-left"
            title="Нажмите, чтобы скопировать промокод"
            data-testid={`promo-strip-code-${c.code}`}
          >
            <Ticket className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <b className="text-amber-300">{c.type === 'amount' ? `−${fmt(c.value)} ₽` : `−${c.value}%`}</b> по промокоду
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono font-bold tracking-wider px-2 py-0.5 rounded-md border border-dashed border-amber-400/70 text-amber-200 group-hover:bg-amber-400/10 transition-colors">
              {c.code}
              {copied === c.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </span>
            {(c.min_order > 0 || c.valid_until) && (
              <span className="text-xs text-slate-400">
                {c.min_order > 0 && `от ${fmt(c.min_order)} ₽`}{c.min_order > 0 && c.valid_until && ' · '}{c.valid_until && `до ${fmtDate(c.valid_until)}`}
              </span>
            )}
          </button>
        ))}
        {discounted > 0 && (
          <Link to="/catalog?category=discounted" className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-rose-300 hover:text-rose-200 transition-colors" data-testid="promo-strip-discounted-link">
            <Percent className="w-4 h-4" />Товары со скидкой: {discounted}<ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </motion.div>
  );
};

export default PromoStrip;
