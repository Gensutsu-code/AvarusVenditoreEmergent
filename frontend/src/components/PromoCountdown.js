import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { formatCountdown } from '../utils/productHelpers';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Live HH:MM:SS countdown to a promo end time.
 * variant: "inline" (compact text) | "badge" (boxed digits).
 */
export function PromoCountdown({ until, variant = 'badge', className = '', testid }) {
  const [c, setC] = useState(() => formatCountdown(until));

  useEffect(() => {
    setC(formatCountdown(until));
    const t = setInterval(() => setC(formatCountdown(until)), 1000);
    return () => clearInterval(t);
  }, [until]);

  if (!c || c.expired) return null;

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-rose-600 font-semibold tabular-nums ${className}`}
        data-testid={testid || 'promo-countdown'}
      >
        <Clock className="w-3.5 h-3.5" />
        {c.days > 0 && <span>{c.days} дн.</span>}
        {pad(c.hours)}:{pad(c.minutes)}:{pad(c.seconds)}
      </span>
    );
  }

  const Cell = ({ v, label }) => (
    <div className="flex flex-col items-center">
      <span className="bg-rose-600 text-white font-extrabold tabular-nums rounded-md px-2 py-1 text-base leading-none min-w-[2.2rem] text-center shadow-sm shadow-rose-500/30">
        {pad(v)}
      </span>
      <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">{label}</span>
    </div>
  );

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      data-testid={testid || 'promo-countdown'}
    >
      {c.days > 0 && (
        <>
          <Cell v={c.days} label="дн" />
          <span className="text-rose-500 font-bold pb-4">:</span>
        </>
      )}
      <Cell v={c.hours} label="час" />
      <span className="text-rose-500 font-bold pb-4">:</span>
      <Cell v={c.minutes} label="мин" />
      <span className="text-rose-500 font-bold pb-4">:</span>
      <Cell v={c.seconds} label="сек" />
    </div>
  );
}

export default PromoCountdown;
