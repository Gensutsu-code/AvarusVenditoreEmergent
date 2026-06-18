import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, ArrowRight, Package, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NewProductsBanner({ onOpenNew }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centerIndex, setCenterIndex] = useState(1);
  const [isNarrow, setIsNarrow] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem('newProductsBannerExpanded');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('newProductsBannerExpanded', String(isExpanded));
    }
  }, [isExpanded]);

  useEffect(() => {
    const check = () => setIsNarrow(typeof window !== 'undefined' && window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-scroll every 5s; pauses on hover or when collapsed. Infinite loop.
  useEffect(() => {
    const featured = summary?.featured || [];
    if (featured.length <= 3 || isPaused || !isExpanded) return undefined;
    const interval = setInterval(() => {
      setCenterIndex((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [summary, isPaused, isExpanded]);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${API}/products/new-summary`)
      .then((res) => {
        if (alive) {
          setSummary(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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
      data-testid="new-promo-banner"
      className="relative overflow-hidden rounded-2xl mb-4 border border-emerald-200/60 shadow-lg shadow-emerald-500/10"
    >
      {/* Background gradient — emerald/teal palette */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400" />
      <div className="absolute -top-12 -left-10 w-48 h-48 rounded-full bg-lime-200/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 right-10 w-56 h-56 rounded-full bg-teal-200/25 blur-3xl pointer-events-none" />
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-white/5"
        animate={{ opacity: [0.05, 0.15, 0.05] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      <div className="relative px-5 py-3 sm:px-6 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
        {/* Left: icon + headline */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-white font-extrabold text-lg sm:text-xl tracking-tight">
                Новинки
              </span>
            </div>
            <p className="text-white/90 text-sm mt-0.5 truncate">
              <span data-testid="new-promo-count" className="font-semibold">
                {summary.total_count}
              </span>{' '}
              {productWord(summary.total_count)} — самые свежие поступления
            </p>
          </div>
        </div>

        {/* Right: CTA + collapse toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNew}
            data-testid="new-promo-cta"
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-emerald-600 font-semibold text-sm shadow-md hover:shadow-xl hover:bg-emerald-50 transition-all whitespace-nowrap"
          >
            Смотреть все
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          {Array.isArray(summary.featured) && summary.featured.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              data-testid="new-promo-collapse-toggle"
              aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
              aria-expanded={isExpanded}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white transition-all"
            >
              <motion.span
                animate={{ rotate: isExpanded ? 0 : 180 }}
                transition={{ duration: 0.3 }}
                className="flex"
              >
                <ChevronDown className="w-5 h-5" />
              </motion.span>
            </button>
          )}
        </div>
      </div>

      {/* Featured products carousel */}
      <AnimatePresence initial={false}>
        {isExpanded && Array.isArray(summary.featured) && summary.featured.length > 0 && (
          <motion.div
            key="new-promo-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            style={{ overflow: 'hidden' }}
            data-testid="new-promo-carousel-wrap"
          >
            {(() => {
              const featured = summary.featured;
              const N = featured.length;

              const cardW = isNarrow ? 29 : 13;
              const adjShift = isNarrow ? 33 : 17;
              const farShift = isNarrow ? 68 : 32;

              const wrapDist = (i, center) => {
                const raw = ((i - center) % N + N) % N;
                return raw > N / 2 ? raw - N : raw;
              };

              return (
                <div
                  className="relative border-t border-white/15 py-2"
                  data-testid="new-promo-featured"
                  onMouseEnter={() => setIsPaused(true)}
                  onMouseLeave={() => setIsPaused(false)}
                  onTouchStart={() => setIsPaused(true)}
                  onTouchEnd={() => setIsPaused(false)}
                >
                  <div className="relative mx-auto h-[230px] sm:h-[295px] overflow-hidden">
                    {featured.map((p, i) => {
                      const dist = wrapDist(i, centerIndex);
                      const absD = Math.abs(dist);
                      if (absD > 2) return null;
                      const isCenter = absD === 0;
                      const isSide = absD === 1;
                      const clickable = absD <= 1;
                      const shift = clickable ? dist * adjShift : Math.sign(dist) * farShift;
                      const leftCenterPct = 50 + shift;
                      const scaleVal = isCenter ? 1.05 : isSide ? 1 : 0.85;
                      return (
                        <motion.div
                          key={p.id}
                          className="absolute"
                          style={{ width: `${cardW}%`, top: '50%' }}
                          initial={false}
                          animate={{
                            left: `calc(${leftCenterPct}% - ${cardW / 2}%)`,
                            y: '-50%',
                            opacity: clickable ? 1 : 0.3,
                            scale: scaleVal,
                            filter: clickable ? 'blur(0px)' : 'blur(1px)',
                            zIndex: isCenter ? 12 : 10 - absD,
                          }}
                          transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
                        >
                          <NewFeaturedCard p={p} clickable={clickable} />
                        </motion.div>
                      );
                    })}

                    {/* Curtain gradient overlays */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-emerald-400 via-emerald-400/70 to-transparent z-[15]" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-teal-400 via-teal-400/70 to-transparent z-[15]" />

                    {N > 3 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCenterIndex((c) => c - 1)}
                          data-testid="new-promo-prev"
                          aria-label="Предыдущие товары"
                          className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-[20] w-9 h-9 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-lg hover:bg-emerald-50 hover:scale-105 transition-all"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCenterIndex((c) => c + 1)}
                          data-testid="new-promo-next"
                          aria-label="Следующие товары"
                          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-[20] w-9 h-9 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-lg hover:bg-emerald-50 hover:scale-105 transition-all"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {N > 3 && (() => {
                    const groupCount = Math.ceil(N / 3);
                    const currentMod = ((centerIndex % N) + N) % N;
                    const currentGroup = Math.min(groupCount - 1, Math.floor(currentMod / 3));
                    return (
                      <div
                        className="mt-2 flex items-center justify-center gap-2"
                        data-testid="new-promo-dots"
                      >
                        {Array.from({ length: groupCount }).map((_, gi) => {
                          const groupCenterIdx = gi * 3 + 1;
                          const active = gi === currentGroup;
                          return (
                            <button
                              key={gi}
                              type="button"
                              onClick={() => setCenterIndex(groupCenterIdx)}
                              data-testid={`new-promo-dot-${gi}`}
                              aria-label={`Группа ${gi + 1}`}
                              className={`rounded-full transition-all ${
                                active
                                  ? 'bg-white w-6 h-2 shadow'
                                  : 'bg-white/40 hover:bg-white/70 w-2 h-2'
                              }`}
                            />
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NewFeaturedCard({ p, clickable }) {
  const price = Number(p.price) || 0;

  const inner = (
    <div className="bg-white/95 rounded-xl overflow-hidden border border-white/40 shadow-lg group h-full flex flex-col">
      <div className="aspect-square bg-slate-100 overflow-hidden relative">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <Package className="w-8 h-8" />
          </div>
        )}
        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow-md">
          <Sparkles className="w-2.5 h-2.5" />
          NEW
        </span>
      </div>
      <div className="p-2 flex-1 flex flex-col">
        {p.manufacturer && (
          <p className="text-[10px] font-bold text-teal-600 leading-tight">{p.manufacturer}</p>
        )}
        <h3 className="text-[11px] font-medium text-slate-800 line-clamp-2 mt-0.5 mb-1 leading-snug group-hover:text-emerald-600 transition-colors">
          {p.name}
        </h3>
        <div className="mt-auto flex items-baseline gap-1.5 flex-wrap">
          <span className="font-bold text-emerald-600 text-sm">
            {Math.round(price).toLocaleString('ru-RU')}{' '}
            <span className="text-[10px] text-slate-400 font-normal">₽</span>
          </span>
        </div>
      </div>
    </div>
  );

  if (clickable) {
    return (
      <Link
        to={`/product/${p.id}`}
        data-testid={`new-promo-featured-${p.id}`}
        className="block h-full hover:-translate-y-1 transition-transform duration-300"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div
      data-testid={`new-promo-featured-${p.id}`}
      aria-hidden="true"
      tabIndex={-1}
      className="block h-full pointer-events-none select-none"
    >
      {inner}
    </div>
  );
}
