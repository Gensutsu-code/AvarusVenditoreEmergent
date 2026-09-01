import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Gift, Award, Star, Trophy, TrendingUp, Clock, 
  CheckCircle, Copy, History, ChevronDown, ChevronUp,
  LayoutList, LayoutGrid
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CONFETTI_COLORS = ['#f97316', '#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#a855f7'];

// Premium hero background presets (selectable from admin)
const HERO_PRESETS = {
  midnight: { base: '#0a0e17', g1: 'rgba(249,115,22,0.30)', g2: 'rgba(251,191,36,0.20)', g3: 'rgba(45,212,191,0.10)' },
  graphite: { base: 'linear-gradient(160deg,#1c1c1e,#0a0a0b)', g1: 'rgba(249,115,22,0.22)', g2: 'rgba(255,255,255,0.07)', g3: 'rgba(148,163,184,0.12)' },
  ocean: { base: 'linear-gradient(160deg,#04303a,#04121a)', g1: 'rgba(45,212,191,0.30)', g2: 'rgba(56,189,248,0.20)', g3: 'rgba(16,185,129,0.14)' },
  royal: { base: 'linear-gradient(160deg,#221a4e,#0b1020)', g1: 'rgba(168,85,247,0.32)', g2: 'rgba(217,70,239,0.20)', g3: 'rgba(59,130,246,0.16)' },
  sunset: { base: 'linear-gradient(160deg,#3b0f0f,#0a0e17)', g1: 'rgba(249,115,22,0.34)', g2: 'rgba(244,63,94,0.22)', g3: 'rgba(251,191,36,0.16)' },
  forest: { base: 'linear-gradient(160deg,#0f2417,#08120c)', g1: 'rgba(34,197,94,0.28)', g2: 'rgba(132,204,22,0.18)', g3: 'rgba(20,184,166,0.14)' },
};

const Confetti = () => (
  <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden" data-testid="bonus-confetti">
    {Array.from({ length: 90 }).map((_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.35;
      const dur = 1.8 + Math.random() * 1.4;
      const size = 6 + Math.random() * 8;
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      const rot = Math.random() * 360;
      return (
        <motion.span
          key={i}
          initial={{ y: -30, opacity: 1, rotate: rot }}
          animate={{ y: '105vh', rotate: rot + 540, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: dur, delay, ease: 'easeIn' }}
          style={{ position: 'absolute', left: `${left}%`, top: 0, width: size, height: size * 0.6, backgroundColor: color, borderRadius: 2 }}
        />
      );
    })}
  </div>
);

const AnimatedNumber = ({ value }) => {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = display;
    const end = value;
    if (start === end) return undefined;
    const dur = 800;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{new Intl.NumberFormat('ru-RU').format(display)}</>;
};

export default function BonusPage() {
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [bonusPrograms, setBonusPrograms] = useState([]);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeemingPrize, setRedeemingPrize] = useState({});
  const [collapsedPrograms, setCollapsedPrograms] = useState({});
  const [redeemedPrize, setRedeemedPrize] = useState(null);
  const [confirmPrize, setConfirmPrize] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [prizeView, setPrizeView] = useState('grid');
  const [copiedCode, setCopiedCode] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [variantPrize, setVariantPrize] = useState(null); // { programId, prize }
  const [selectedOptions, setSelectedOptions] = useState({}); // { group_id: choice_id }
  const [pointsGain, setPointsGain] = useState(null); // { programId, amount }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchBonusData();
  }, [user, authLoading, navigate]);

  const fetchBonusData = async () => {
    try {
      const programsRes = await axios.get(`${API}/bonus/programs`);
      const programs = Array.isArray(programsRes.data) ? programsRes.data : [];
      detectPointsGain(programs);
      setBonusPrograms(programs);
    } catch (err) {
      console.error('Failed to fetch bonus data', err);
    } finally {
      setLoading(false);
    }
  };

  // Detects when the points balance grew since the last visit and fires a "+N баллов" wow animation
  const detectPointsGain = (programs) => {
    if (!user) return;
    programs.forEach((p) => {
      const key = `bonus_seen_${user.id}_${p.id}`;
      const cur = Math.round(p.progress?.current_amount || 0);
      const stored = localStorage.getItem(key);
      const prev = stored === null ? null : parseInt(stored, 10);
      if (prev !== null && !isNaN(prev) && cur > prev) {
        const amount = cur - prev;
        setPointsGain({ programId: p.id, amount });
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 2600);
        setTimeout(() => setPointsGain((g) => (g && g.programId === p.id ? null : g)), 3200);
      }
      localStorage.setItem(key, String(cur));
    });
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price);
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleRedeemPrize = (programId, prize) => {
    // If the prize has selectable options, open the variant modal first.
    if (prize.options && prize.options.length > 0) {
      const defaults = {};
      prize.options.forEach(g => {
        if (g.choices && g.choices.length > 0) defaults[g.id] = g.choices[0].id;
      });
      setSelectedOptions(defaults);
      setVariantPrize({ programId, prize });
      return;
    }
    // Otherwise open a simple confirmation (window.confirm is blocked in iframes)
    setConfirmPrize({ programId, prizeId: prize.id, prizeName: prize.name, pointsCost: prize.points_cost });
  };

  const optionsCostFor = (prize, sel) => {
    if (!prize?.options) return 0;
    return prize.options.reduce((sum, g) => {
      const choice = (g.choices || []).find(c => c.id === sel[g.id]);
      return sum + (choice ? (Number(choice.points) || 0) : 0);
    }, 0);
  };

  const submitRedeem = async (programId, prizeId, prizeName, pointsCost, options) => {
    const key = `${programId}_${prizeId}`;
    setRedeemingPrize(prev => ({ ...prev, [key]: true }));
    try {
      const payload = { program_id: programId, prize_id: prizeId };
      if (options && options.length > 0) payload.selected_options = options;
      const res = await axios.post(`${API}/bonus/redeem-prize`, payload);
      toast.success(res.data?.message || 'Приз успешно оформлен!');
      setConfirmPrize(null);
      setVariantPrize(null);
      setRedeemedPrize({ name: prizeName, pointsCost });
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2800);
      fetchBonusData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка обмена');
    } finally {
      setRedeemingPrize(prev => ({ ...prev, [key]: false }));
    }
  };

  const doRedeemPrize = async () => {
    if (!confirmPrize) return;
    const { programId, prizeId, prizeName, pointsCost } = confirmPrize;
    await submitRedeem(programId, prizeId, prizeName, pointsCost, null);
  };

  const copyPromoCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Промокод скопирован!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Calculate total points
  const totalPoints = bonusPrograms.reduce((sum, p) => sum + (p.progress?.current_amount || 0), 0);

  if (authLoading || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-950' : ''}`}>
        <motion.div 
          className={`w-8 h-8 border-2 ${isDark ? 'border-orange-500' : 'border-teal-500'} border-t-transparent rounded-full`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : ''}`} data-testid="bonus-page">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className={`absolute top-20 right-20 w-96 h-96 rounded-full ${isDark ? 'bg-orange-500/5' : 'bg-teal-400/20'} blur-3xl`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className={`absolute bottom-20 left-20 w-80 h-80 rounded-full ${isDark ? 'bg-purple-500/5' : 'bg-pink-400/20'} blur-3xl`}
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative max-w-[1344px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Image - fetched from first bonus program */}
        {bonusPrograms.length > 0 && bonusPrograms[0].banner_url && (
          <div className="flex justify-center mb-8">
            <img 
              src={bonusPrograms[0].banner_url} 
              alt="Бонусная программа"
              className="rounded-2xl shadow-xl object-cover"
              style={{ 
                maxWidth: '100%',
                height: bonusPrograms[0].banner_height || 200
              }}
            />
          </div>
        )}

        {/* Bonus Programs */}
        {bonusPrograms.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
            <Gift className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500 text-lg">Бонусные программы не найдены</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bonusPrograms.map((program) => {
              const yearlyTotal = program.yearly_total || 0;
              const currentYear = program.current_year || new Date().getFullYear();
              const sortedLevels = [...(program.levels || [])].sort((a, b) => a.min_points - b.min_points);
              const currentLevelIndex = sortedLevels.findIndex(l => l.id === program.current_level?.id);
              const nextLevel = currentLevelIndex >= 0 && currentLevelIndex < sortedLevels.length - 1 
                ? sortedLevels[currentLevelIndex + 1] 
                : null;
              const amountToNextLevel = nextLevel ? Math.max(0, nextLevel.min_points - yearlyTotal) : 0;
              const hero = HERO_PRESETS[program.hero_preset] || HERO_PRESETS.midnight;
              // Roadmap fill aligned to EVENLY-SPACED nodes (not raw value/maxPoints),
              // so the line reaches exactly the achieved node + fraction toward the next.
              const lvlCount = sortedLevels.length;
              const achievedCount = sortedLevels.filter(l => yearlyTotal >= l.min_points).length;
              let roadmapFillPct = 0;
              if (lvlCount > 1) {
                if (achievedCount >= lvlCount) {
                  roadmapFillPct = 100;
                } else if (achievedCount >= 1) {
                  const curIdx = achievedCount - 1;
                  const cur = sortedLevels[curIdx];
                  const nxt = sortedLevels[curIdx + 1];
                  const span = (nxt.min_points - cur.min_points) || 1;
                  const frac = Math.min(1, Math.max(0, (yearlyTotal - cur.min_points) / span));
                  roadmapFillPct = ((curIdx + frac) / (lvlCount - 1)) * 100;
                }
              } else {
                roadmapFillPct = achievedCount >= 1 ? 100 : 0;
              }

              return (
                <div key={program.id} className="rounded-[28px] border border-zinc-200/70 bg-white shadow-sm overflow-hidden">
                  {/* Premium dark hero */}
                  <div className="relative overflow-hidden text-white" style={{ background: hero.base }}>
                    {program.hero_image_url && (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${program.hero_image_url})`, opacity: 0.5 }} />
                        <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,8,15,0.35), rgba(5,8,15,0.85))' }} />
                      </>
                    )}
                    <motion.div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full blur-[90px]" style={{ background: hero.g1 }}
                      animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 9, repeat: Infinity }} />
                    <motion.div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 w-80 h-80 rounded-full blur-[90px]" style={{ background: hero.g2 }}
                      animate={{ scale: [1.2, 1, 1.2], opacity: [0.6, 1, 0.6] }} transition={{ duration: 11, repeat: Infinity }} />
                    <motion.div aria-hidden className="pointer-events-none absolute top-10 left-1/3 w-64 h-64 rounded-full blur-[80px]" style={{ background: hero.g3 }}
                      animate={{ x: [0, 30, 0], opacity: [0.6, 1, 0.6] }} transition={{ duration: 13, repeat: Infinity }} />
                    <div className="pointer-events-none absolute inset-0 opacity-[0.14]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)', backgroundSize: '22px 22px' }} />

                    <div className="relative p-6 sm:p-8">
                      {/* Top row: program + jump to prizes */}
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          {program.image_url ? (
                            <img src={program.image_url} alt="" className="w-11 h-11 rounded-xl object-cover ring-1 ring-white/15" />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/15">
                              <Trophy className="w-5 h-5 text-amber-300" />
                            </div>
                          )}
                          <div>
                            <h2 className="text-base font-bold text-white leading-tight">{program.title || 'Программа лояльности'}</h2>
                          </div>
                        </div>
                        <button onClick={() => document.getElementById(`prizes-${program.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                          data-testid="jump-to-prizes"
                          className="text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full ring-1 ring-white/10 transition-colors">
                          <Gift className="w-3.5 h-3.5" /> К призам
                        </button>
                      </div>

                      {/* Program description */}
                      {program.description && (
                        <p className="mt-3 text-sm text-white/70 leading-relaxed max-w-2xl" data-testid="bonus-description">{program.description}</p>
                      )}

                      {/* Balance */}
                      <motion.div className="mt-6 relative" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Доступно баллов</p>
                        <div className="flex items-end gap-3 mt-1 relative">
                          <motion.span
                            className="text-5xl sm:text-6xl font-black tracking-tight bg-gradient-to-br from-orange-300 via-amber-200 to-orange-400 bg-clip-text text-transparent tabular-nums"
                            data-testid="bonus-balance"
                            animate={pointsGain?.programId === program.id ? { scale: [1, 1.12, 1] } : {}}
                            transition={{ duration: 0.6, times: [0, 0.4, 1] }}
                          >
                            <AnimatedNumber value={Math.round(program.progress?.current_amount || 0)} />
                          </motion.span>
                          <Star className="w-6 h-6 text-amber-300 mb-2.5 fill-amber-300/40" />

                          {/* Floating "+N баллов" wow animation */}
                          <AnimatePresence>
                            {pointsGain?.programId === program.id && (
                              <motion.div
                                key={`gain-${pointsGain.amount}`}
                                className="absolute left-0 -top-2 flex items-center gap-1.5 pointer-events-none"
                                initial={{ opacity: 0, y: 10, scale: 0.7 }}
                                animate={{ opacity: [0, 1, 1, 0], y: -56, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 2.6, times: [0, 0.15, 0.7, 1], ease: 'easeOut' }}
                                data-testid="points-gain-popup"
                              >
                                <span className="text-2xl sm:text-3xl font-black text-emerald-300 drop-shadow-[0_2px_10px_rgba(16,185,129,0.6)] tabular-nums">
                                  +{new Intl.NumberFormat('ru-RU').format(pointsGain.amount)}
                                </span>
                                <span className="text-sm font-bold text-emerald-200/90">баллов</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>

                      {/* Level medallion + progress */}
                      {program.current_level ? (
                        <div className="mt-7 grid gap-5">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3.5">
                              <motion.div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl"
                                style={{ background: `linear-gradient(135deg, ${program.current_level.color}, ${program.current_level.color}aa)` }}
                                animate={{ boxShadow: [`0 0 0 0 ${program.current_level.color}66`, `0 0 0 14px ${program.current_level.color}00`] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}>
                                <Award className="w-7 h-7 text-white" />
                              </motion.div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Ваш уровень</p>
                                <p className="text-xl font-black tracking-tight" style={{ color: program.current_level.color }}>{program.current_level.name}</p>
                                {program.current_level.benefits && <p className="text-xs text-white/50 max-w-[220px] truncate">{program.current_level.benefits}</p>}
                              </div>
                            </div>
                            {program.current_level.cashback_percent > 0 && (
                              <div className="text-center bg-white/5 ring-1 ring-white/10 backdrop-blur px-5 py-2.5 rounded-2xl">
                                <p className="text-3xl font-black leading-none bg-gradient-to-b from-amber-200 to-orange-400 bg-clip-text text-transparent">{program.current_level.cashback_percent}%</p>
                                <p className="text-[10px] font-medium text-white/40 mt-1 uppercase tracking-wide">кешбэк</p>
                              </div>
                            )}
                          </div>

                          {nextLevel ? (
                            <div>
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-white/50">Покупки за {currentYear}: <span className="font-bold text-white/90 tabular-nums">{formatPrice(yearlyTotal)} ₽</span></span>
                                <span className="text-white/50">до <span className="font-bold" style={{ color: nextLevel.color }}>{nextLevel.name}</span></span>
                              </div>
                              <div className="relative h-3.5 rounded-full bg-white/10 overflow-hidden ring-1 ring-white/10">
                                <motion.div className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
                                  style={{ background: `linear-gradient(90deg, ${program.current_level.color}, ${nextLevel.color})` }}
                                  initial={{ width: 0 }} animate={{ width: `${program.level_percentage || 0}%` }}
                                  transition={{ type: 'spring', bounce: 0.15, duration: 1.5, delay: 0.3 }} data-testid="next-level-progress-fill">
                                  <motion.div className="absolute inset-y-0 bg-white/30" style={{ width: '35%' }}
                                    animate={{ x: ['-120%', '320%'] }} transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.7 }} />
                                </motion.div>
                              </div>
                              <div className="flex justify-between mt-1.5 text-[11px] text-white/40">
                                <span className="tabular-nums">{program.level_percentage || 0}%</span>
                                <span>Осталось <span className="font-semibold text-white/75 tabular-nums">{formatPrice(amountToNextLevel)} ₽</span></span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><CheckCircle className="w-4 h-4" /> Максимальный уровень достигнут 🎉</div>
                          )}
                        </div>
                      ) : null}

                      {/* Levels roadmap */}
                      {sortedLevels.length > 0 && (
                        <div className="mt-8">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">Путь уровней</p>
                            <span className="text-[11px] text-white/50">Достигнуто <span className="font-bold text-amber-300">{sortedLevels.filter(l => yearlyTotal >= l.min_points).length}</span> / {sortedLevels.length}</span>
                          </div>
                          <div className="relative pt-1">
                            <div className="absolute left-5 right-5 top-6 h-1 bg-white/10 rounded-full overflow-hidden">
                              <motion.div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-300"
                                initial={{ width: 0 }} animate={{ width: `${roadmapFillPct}%` }}
                                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} />
                            </div>
                            <div className="relative flex justify-between">
                              {sortedLevels.map((level, idx) => {
                                const isActive = program.current_level?.id === level.id;
                                const isAchieved = yearlyTotal >= level.min_points;
                                return (
                                  <motion.div key={level.id} className="flex flex-col items-center text-center flex-1 min-w-0"
                                    initial={{ opacity: 0, y: 14, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ delay: 0.2 + idx * 0.08, type: 'spring', stiffness: 260, damping: 16 }}>
                                    <motion.div className="relative w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shadow-lg z-10 ring-2 ring-[#0a0e17]"
                                      style={{ background: isAchieved ? `linear-gradient(135deg, ${level.color}, ${level.color}bb)` : 'rgba(255,255,255,0.08)', color: isAchieved ? '#fff' : 'rgba(255,255,255,0.5)' }}
                                      animate={isActive ? { boxShadow: [`0 0 0 0 ${level.color}88`, `0 0 0 12px ${level.color}00`] } : {}}
                                      transition={isActive ? { duration: 1.8, repeat: Infinity, ease: 'easeOut' } : {}}>
                                      {isAchieved ? <CheckCircle className="w-5 h-5" /> : (idx + 1)}
                                    </motion.div>
                                    <p className={`text-[11px] mt-2 leading-tight truncate max-w-full px-0.5 ${isActive ? 'font-bold' : 'font-medium'}`} style={{ color: isAchieved ? '#fff' : 'rgba(255,255,255,0.45)' }}>{level.name}</p>
                                    <p className="text-[10px] text-white/35 mt-0.5 tabular-nums">от {formatPrice(level.min_points)} ₽</p>
                                    {level.cashback_percent > 0 && (
                                      <span className="text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-full" style={{ color: isAchieved ? level.color : 'rgba(255,255,255,0.4)', backgroundColor: isAchieved ? level.color + '22' : 'rgba(255,255,255,0.06)' }}>{level.cashback_percent}%</span>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Prizes Section - Expanded by default */}
                  {program.prizes && program.prizes.filter(p => p.enabled).length > 0 && (
                    <div id={`prizes-${program.id}`} className="p-6 sm:p-8 scroll-mt-20">
                      <div className="flex items-center justify-between">
                        <button 
                          className="flex items-center gap-2"
                          onClick={() => setCollapsedPrograms(prev => ({ ...prev, [program.id]: !prev[program.id] }))}
                        >
                          <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2 tracking-tight">
                            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                              <Gift className="w-4 h-4 text-white" />
                            </span>
                            Магазин призов
                            <span className="text-sm font-semibold text-zinc-400">({program.prizes.filter(p => p.enabled).length})</span>
                          </h3>
                          {collapsedPrograms[program.id] ? <ChevronDown className="w-5 h-5 text-zinc-400" /> : <ChevronUp className="w-5 h-5 text-zinc-400" />}
                        </button>
                        {!collapsedPrograms[program.id] && (
                          <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5" data-testid="prize-view-toggle">
                            <button
                              onClick={() => setPrizeView('list')}
                              className={`p-1.5 rounded-md transition-colors ${prizeView === 'list' ? 'bg-white shadow text-orange-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                              data-testid="prize-view-list"
                            >
                              <LayoutList className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setPrizeView('grid')}
                              className={`p-1.5 rounded-md transition-colors ${prizeView === 'grid' ? 'bg-white shadow text-orange-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                              data-testid="prize-view-grid"
                            >
                              <LayoutGrid className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Progress to next prize */}
                      {!collapsedPrograms[program.id] && (() => {
                        const rawBalance = program.progress?.current_amount || 0;
                        const balance = Math.round(rawBalance);
                        const avail = program.prizes
                          .filter(p => p.enabled && (p.quantity === -1 || p.quantity > 0))
                          .sort((a, b) => a.points_cost - b.points_cost);
                        const next = avail.find(p => p.points_cost > rawBalance);
                        if (!next) {
                          if (avail.length === 0) return null;
                          return (
                            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3" data-testid="next-prize-progress">
                              <Gift className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                              <p className="text-sm font-semibold text-emerald-700">Вам доступны все призы — выберите и получите свой подарок 🎁</p>
                            </div>
                          );
                        }
                        const remaining = Math.max(0, Math.ceil(next.points_cost - rawBalance));
                        const pct = Math.min(100, Math.round((rawBalance / next.points_cost) * 100));
                        return (
                          <div className="mt-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-4" data-testid="next-prize-progress">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                                  <Award className="w-4 h-4 text-orange-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] uppercase tracking-wide text-orange-500 font-semibold">До следующего приза</p>
                                  <p className="text-sm font-bold text-zinc-900 truncate">{next.name}</p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-lg font-bold text-orange-600 tabular-nums leading-none" data-testid="next-prize-remaining">{remaining}</p>
                                <p className="text-[11px] text-zinc-500 mt-0.5">баллов осталось</p>
                              </div>
                            </div>
                            <div className="h-2.5 bg-orange-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex justify-between mt-1.5 text-[11px] text-zinc-500">
                              <span>{balance} баллов</span>
                              <span>{next.points_cost} баллов</span>
                            </div>
                          </div>
                        );
                      })()}
                      
                      {!collapsedPrograms[program.id] && prizeView === 'list' && (
                        <div className="mt-4 grid gap-3">
                          {program.prizes.filter(p => p.enabled).map((prize) => {
                            const canAfford = (program.progress?.current_amount || 0) >= prize.points_cost;
                            const isRedeeming = redeemingPrize[`${program.id}_${prize.id}`];
                            const outOfStock = prize.out_of_stock || prize.quantity === 0;
                            const isAvailable = !outOfStock && (prize.quantity === -1 || prize.quantity > 0);
                            const hasOptions = prize.options && prize.options.length > 0;
                            
                            return (
                              <div 
                                key={prize.id}
                                className={`relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                                  outOfStock
                                    ? 'border-zinc-200 bg-zinc-50'
                                    : canAfford
                                      ? 'border-green-200 bg-green-50 hover:border-green-300' 
                                      : 'border-zinc-200 bg-zinc-50'
                                }`}
                                data-testid={`prize-item-${prize.id}`}
                              >
                                {outOfStock && (
                                  <span className="absolute top-2 right-2 z-10 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-500 text-white shadow" data-testid={`prize-oos-badge-${prize.id}`}>
                                    Закончился
                                  </span>
                                )}
                                {prize.image_url ? (
                                  <img 
                                    src={prize.image_url} 
                                    alt={prize.name} 
                                    className={`w-16 h-16 rounded-xl object-cover flex-shrink-0 ${outOfStock ? 'grayscale opacity-60' : ''}`}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      const placeholder = e.target.parentElement.querySelector('[data-placeholder]');
                                      if (placeholder) placeholder.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div 
                                  data-placeholder
                                  className={`w-16 h-16 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 items-center justify-center flex-shrink-0 ${prize.image_url ? 'hidden' : 'flex'} ${outOfStock ? 'grayscale opacity-60' : ''}`}
                                >
                                  <Gift className="w-8 h-8 text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-zinc-900">{prize.name}</h4>
                                  {prize.description && (
                                    <p className="text-sm text-zinc-500 truncate">{prize.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-sm font-bold text-orange-600">{prize.points_cost} баллов</span>
                                    {hasOptions && (
                                      <span className="text-[11px] font-medium text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-md">+ параметры</span>
                                    )}
                                    {!outOfStock && prize.quantity >= 0 && (
                                      <span className="text-xs text-zinc-400">(осталось: {prize.quantity})</span>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  onClick={() => handleRedeemPrize(program.id, prize)}
                                  disabled={!canAfford || !isAvailable || isRedeeming}
                                  className={`whitespace-nowrap ${
                                    canAfford && isAvailable
                                      ? 'bg-green-500 hover:bg-green-600'
                                      : 'bg-zinc-300 cursor-not-allowed'
                                  }`}
                                >
                                  {isRedeeming ? '...' : outOfStock ? 'Закончился' : hasOptions ? 'Выбрать' : canAfford ? 'Получить' : 'Недостаточно'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!collapsedPrograms[program.id] && prizeView === 'grid' && (
                        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                          {program.prizes.filter(p => p.enabled).map((prize) => {
                            const canAfford = (program.progress?.current_amount || 0) >= prize.points_cost;
                            const isRedeeming = redeemingPrize[`${program.id}_${prize.id}`];
                            const outOfStock = prize.out_of_stock || prize.quantity === 0;
                            const isAvailable = !outOfStock && (prize.quantity === -1 || prize.quantity > 0);
                            const hasOptions = prize.options && prize.options.length > 0;
                            
                            return (
                              <div 
                                key={prize.id}
                                className={`group flex flex-col rounded-xl border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${
                                  outOfStock
                                    ? 'border-zinc-200 bg-white'
                                    : canAfford
                                      ? 'border-orange-200 bg-white hover:border-orange-300' 
                                      : 'border-zinc-200 bg-white'
                                }`}
                                data-testid={`prize-card-${prize.id}`}
                              >
                                <div className="relative w-full aspect-square bg-zinc-50 p-2 flex items-center justify-center">
                                  {prize.image_url ? (
                                    <img 
                                      src={prize.image_url} 
                                      alt={prize.name} 
                                      className={`max-w-full max-h-full object-contain mix-blend-multiply ${outOfStock ? 'grayscale opacity-50' : ''}`}
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <Gift className={`w-10 h-10 text-orange-300 ${outOfStock ? 'grayscale opacity-50' : ''}`} />
                                  )}
                                  {outOfStock ? (
                                    <span className="absolute top-1.5 right-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-500 text-white shadow" data-testid={`prize-oos-badge-${prize.id}`}>Закончился</span>
                                  ) : prize.quantity >= 0 ? (
                                    <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/90 border border-zinc-200 text-zinc-500">x{prize.quantity}</span>
                                  ) : null}
                                  {hasOptions && !outOfStock && (
                                    <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-500 text-white shadow">+ параметры</span>
                                  )}
                                </div>
                                <div className="p-2 flex flex-col flex-1">
                                  <h4 className="font-semibold text-zinc-900 text-[11px] leading-tight line-clamp-2 min-h-[28px]">{prize.name}</h4>
                                  <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-sm font-bold text-orange-600 tabular-nums">{prize.points_cost}</span>
                                    <span className="text-[10px] text-zinc-400">б.</span>
                                  </div>
                                  <Button
                                    onClick={() => handleRedeemPrize(program.id, prize)}
                                    disabled={!canAfford || !isAvailable || isRedeeming}
                                    size="sm"
                                    data-testid="bonus-redeem-btn"
                                    className={`mt-1.5 w-full text-[11px] h-7 px-1 ${
                                      canAfford && isAvailable
                                        ? 'bg-orange-500 hover:bg-orange-600'
                                        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                                    }`}
                                  >
                                    {isRedeeming ? '...' : outOfStock ? 'Нет' : hasOptions ? 'Выбрать' : canAfford ? 'Получить' : 'Мало'}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full Description */}
                  {program.full_description && (
                    <div className="px-6 pb-6">
                      <details className="group">
                        <summary className="cursor-pointer text-sm text-orange-600 hover:text-orange-700 font-medium list-none flex items-center gap-1">
                          <span>Подробнее о программе</span>
                          <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                        </summary>
                        <p className="mt-3 text-sm text-zinc-600 whitespace-pre-line bg-zinc-50 p-4 rounded-xl">
                          {program.full_description}
                        </p>
                      </details>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {/* Celebration confetti */}
        {celebrate && <Confetti />}

        {/* Redeem confirmation modal */}
        <AnimatePresence>
          {confirmPrize && (
            <motion.div
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmPrize(null)}
              data-testid="redeem-confirm-overlay"
            >
              <motion.div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                onClick={(e) => e.stopPropagation()}
                data-testid="redeem-confirm-modal"
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 text-center">Получить приз?</h3>
                <p className="text-sm text-zinc-500 text-center mt-2">
                  Обменять <span className="font-bold text-orange-600">{confirmPrize.pointsCost}</span> баллов на «<span className="font-semibold text-zinc-700">{confirmPrize.prizeName}</span>»?
                </p>
                <p className="text-xs text-zinc-400 text-center mt-1">Баллы будут списаны с вашего счёта.</p>
                <div className="flex gap-3 mt-5">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmPrize(null)}
                    data-testid="redeem-cancel-btn"
                  >
                    Отмена
                  </Button>
                  <Button
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={doRedeemPrize}
                    disabled={redeemingPrize[`${confirmPrize.programId}_${confirmPrize.prizeId}`]}
                    data-testid="redeem-confirm-btn"
                  >
                    {redeemingPrize[`${confirmPrize.programId}_${confirmPrize.prizeId}`] ? 'Оформляем...' : 'Получить'}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Variant / options selection modal */}
        <AnimatePresence>
          {variantPrize && (() => {
            const { programId, prize } = variantPrize;
            const program = bonusPrograms.find(p => p.id === programId);
            const balance = Math.round(program?.progress?.current_amount || 0);
            const optCost = optionsCostFor(prize, selectedOptions);
            const total = (prize.points_cost || 0) + optCost;
            const canAfford = balance >= total;
            const allSelected = (prize.options || []).every(g => selectedOptions[g.id]);
            const isRedeeming = redeemingPrize[`${programId}_${prize.id}`];
            return (
              <motion.div
                className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setVariantPrize(null)}
                data-testid="variant-overlay"
              >
                <motion.div
                  className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
                  initial={{ scale: 0.9, y: 20, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.9, y: 20, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  onClick={(e) => e.stopPropagation()}
                  data-testid="variant-modal"
                >
                  <div className="p-6 pb-4 flex items-center gap-4 border-b border-zinc-100">
                    {prize.image_url ? (
                      <img src={prize.image_url} alt={prize.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center flex-shrink-0">
                        <Gift className="w-7 h-7 text-orange-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-zinc-900 leading-tight">{prize.name}</h3>
                      <p className="text-sm text-zinc-500 mt-0.5">Базовая стоимость: {prize.points_cost} баллов</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-5 overflow-y-auto">
                    {(prize.options || []).map((grp) => (
                      <div key={grp.id} data-testid={`variant-group-${grp.id}`}>
                        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-2">{grp.name}</p>
                        <div className="flex flex-wrap gap-2">
                          {(grp.choices || []).map((ch) => {
                            const active = selectedOptions[grp.id] === ch.id;
                            return (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => setSelectedOptions(prev => ({ ...prev, [grp.id]: ch.id }))}
                                className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
                                  active
                                    ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                                }`}
                                data-testid={`variant-choice-${grp.id}-${ch.id}`}
                              >
                                {ch.label}
                                {ch.points > 0 && <span className="ml-1.5 text-xs text-orange-500 font-bold">+{ch.points}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 pt-4 border-t border-zinc-100 bg-zinc-50/60 rounded-b-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-zinc-500">Итого к списанию</span>
                      <motion.span
                        key={total}
                        initial={{ scale: 1.15 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        className={`text-2xl font-black tabular-nums ${canAfford ? 'text-orange-600' : 'text-rose-500'}`}
                        data-testid="variant-total"
                      >
                        {total} <span className="text-sm font-medium text-zinc-400">баллов</span>
                      </motion.span>
                    </div>
                    {!canAfford && (
                      <p className="text-xs text-rose-500 mb-3 text-right">Недостаточно баллов (у вас {balance})</p>
                    )}
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setVariantPrize(null)} data-testid="variant-cancel-btn">
                        Отмена
                      </Button>
                      <Button
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={!canAfford || !allSelected || isRedeeming}
                        onClick={() => {
                          const options = (prize.options || []).map(g => ({ group_id: g.id, choice_id: selectedOptions[g.id] }));
                          submitRedeem(programId, prize.id, prize.name, total, options);
                        }}
                        data-testid="variant-confirm-btn"
                      >
                        {isRedeeming ? 'Оформляем...' : 'Получить приз'}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Redeemed Prize Notification */}
        {redeemedPrize && (
          <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-green-500 text-white p-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold">🎉 Приз оформлен!</p>
                <p className="text-sm text-green-100 mt-1">
                  «{redeemedPrize.name}» будет доставлен вам в ближайшее время.
                </p>
              </div>
              <button onClick={() => setRedeemedPrize(null)} className="text-white/70 hover:text-white">×</button>
            </div>
          </div>
        )}

        {/* Bonus History */}
        {bonusHistory.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <button 
              className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
              onClick={() => setShowHistory(!showHistory)}
            >
              <span className="flex items-center gap-2 font-medium">
                <History className="w-5 h-5 text-zinc-400" />
                Полученные промокоды ({bonusHistory.length})
              </span>
              {showHistory ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            
            {showHistory && (
              <div className="border-t border-zinc-100">
                {bonusHistory.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                    <div>
                      <p className="font-medium">{item.program_title || 'Бонус'}</p>
                      <p className="text-xs text-zinc-400">{formatDate(item.created_at)}</p>
                    </div>
                    <button
                      onClick={() => copyPromoCode(item.bonus_code)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono transition-colors ${
                        copiedCode === item.bonus_code 
                          ? 'bg-teal-100 text-teal-600' 
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {copiedCode === item.bonus_code ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {item.bonus_code}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
