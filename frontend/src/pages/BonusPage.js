import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Gift, Award, Star, Trophy, TrendingUp, Clock, 
  CheckCircle, Copy, History, ChevronDown, ChevronUp, Sparkles,
  LayoutList, LayoutGrid
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CONFETTI_COLORS = ['#f97316', '#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#a855f7'];

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
  const [celebrate, setCelebrate] = useState(false);
  const [prizeView, setPrizeView] = useState('grid');
  const [copiedCode, setCopiedCode] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [myRedemptions, setMyRedemptions] = useState([]);

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
      const [programsRes, redemptionsRes] = await Promise.all([
        axios.get(`${API}/bonus/programs`),
        axios.get(`${API}/bonus/my-redemptions`).catch(() => ({ data: { redemptions: [] } }))
      ]);
      setBonusPrograms(Array.isArray(programsRes.data) ? programsRes.data : []);
      setMyRedemptions(redemptionsRes.data.redemptions || []);
    } catch (err) {
      console.error('Failed to fetch bonus data', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price);
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleRedeemPrize = async (programId, prizeId, prizeName, pointsCost) => {
    const confirmText = `Обменять ${pointsCost} баллов на «${prizeName}»?\n\nПосле подтверждения баллы будут списаны с вашего счёта.`;
    if (!window.confirm(confirmText)) return;
    
    const key = `${programId}_${prizeId}`;
    setRedeemingPrize(prev => ({ ...prev, [key]: true }));
    try {
      const res = await axios.post(`${API}/bonus/redeem-prize`, { program_id: programId, prize_id: prizeId });
      toast.success(res.data.message);
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

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div 
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium ${
              isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-teal-100 text-teal-600'
            }`}
            style={{ fontSize: bonusPrograms[0]?.header_font_size || 14 }}
          >
            <Sparkles className="w-4 h-4" />
            Бонусная программа
          </div>
        </motion.div>

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

              return (
                <div key={program.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                  {/* Program Header */}
                  <div className="p-6 border-b border-zinc-100">
                    <div className="flex items-start gap-4">
                      {program.image_url ? (
                        <img src={program.image_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
                      ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center">
                          <Trophy className="w-7 h-7 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-zinc-900">{program.title || 'Бонусная программа'}</h2>
                        <p className="text-zinc-500 text-sm mt-1">{program.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-orange-500"><AnimatedNumber value={Math.round(program.progress?.current_amount || 0)} /></p>
                        <p className="text-xs text-zinc-400">баллов</p>
                      </div>
                    </div>
                  </div>

                  {/* Current Level & Progress */}
                  {program.current_level && (
                    <div className="p-6 bg-gradient-to-r from-zinc-50 to-zinc-100/50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                            style={{ backgroundColor: program.current_level.color }}
                          >
                            {program.current_level.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900">Уровень: {program.current_level.name}</p>
                            {program.current_level.benefits && (
                              <p className="text-sm text-zinc-500">{program.current_level.benefits}</p>
                            )}
                          </div>
                        </div>
                        {program.current_level.cashback_percent > 0 && (
                          <div className="text-right bg-white px-4 py-2 rounded-xl shadow-sm">
                            <p className="text-2xl font-bold" style={{ color: program.current_level.color }}>
                              {program.current_level.cashback_percent}%
                            </p>
                            <p className="text-xs text-zinc-400">кешбэк</p>
                          </div>
                        )}
                      </div>

                      {/* Levels Visualization */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Уровни программы</p>
                          <span className="text-xs font-medium text-zinc-500">
                            Достигнуто <span className="font-bold text-orange-600">{sortedLevels.filter(l => yearlyTotal >= l.min_points).length}</span> из {sortedLevels.length}
                          </span>
                        </div>

                        <div className="relative pt-1">
                          {/* Track */}
                          <div className="absolute left-5 right-5 top-6 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full rounded-full"
                              style={{ backgroundColor: program.current_level.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (yearlyTotal / (sortedLevels[sortedLevels.length - 1]?.min_points || 100000)) * 100)}%` }}
                              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
                            />
                          </div>
                          {/* Nodes */}
                          <div className="relative flex justify-between">
                            {sortedLevels.map((level, idx) => {
                              const isActive = program.current_level?.id === level.id;
                              const isAchieved = yearlyTotal >= level.min_points;
                              return (
                                <motion.div 
                                  key={level.id} 
                                  className="flex flex-col items-center text-center"
                                  initial={{ opacity: 0, y: 12, scale: 0.6 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  transition={{ delay: 0.15 + idx * 0.09, type: 'spring', stiffness: 280, damping: 18 }}
                                >
                                  <motion.div 
                                    className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md z-10 ${isAchieved ? 'text-white' : 'text-white/70'}`}
                                    style={{ backgroundColor: isAchieved ? level.color : '#d4d4d8' }}
                                    animate={isActive ? { boxShadow: [`0 0 0 0 ${level.color}66`, `0 0 0 10px ${level.color}00`] } : {}}
                                    transition={isActive ? { duration: 1.8, repeat: Infinity, ease: 'easeOut' } : {}}
                                  >
                                    {isAchieved ? <CheckCircle className="w-5 h-5" /> : (idx + 1)}
                                  </motion.div>
                                  <p className={`text-xs mt-1.5 leading-tight ${isActive ? 'font-bold' : isAchieved ? 'font-medium' : 'opacity-60'}`} style={{ color: isAchieved ? level.color : '#a1a1aa' }}>
                                    {level.name}
                                  </p>
                                  <p className="text-[10px] text-zinc-400 mt-0.5 tabular-nums">от {formatPrice(level.min_points)} ₽</p>
                                  {level.cashback_percent > 0 && (
                                    <span className="text-[10px] font-semibold mt-0.5 px-1.5 py-0.5 rounded-full" style={{ color: isAchieved ? level.color : '#a1a1aa', backgroundColor: isAchieved ? level.color + '18' : '#f4f4f5' }}>
                                      {level.cashback_percent}%
                                    </span>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Progress Info */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-teal-500" />
                          <span className="text-zinc-600">Покупки за {currentYear}:</span>
                          <span className="font-bold text-teal-600">{formatPrice(yearlyTotal)} ₽</span>
                        </div>
                        {nextLevel && (
                          <span className="text-zinc-500">
                            До <span className="font-semibold" style={{ color: nextLevel.color }}>{nextLevel.name}</span>: {formatPrice(amountToNextLevel)} ₽
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Prizes Section - Expanded by default */}
                  {program.prizes && program.prizes.filter(p => p.enabled).length > 0 && (
                    <div className="p-6 border-t border-zinc-100">
                      <div className="flex items-center justify-between">
                        <button 
                          className="flex items-center gap-2"
                          onClick={() => setCollapsedPrograms(prev => ({ ...prev, [program.id]: !prev[program.id] }))}
                        >
                          <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                            <Award className="w-5 h-5 text-orange-500" />
                            Доступные призы ({program.prizes.filter(p => p.enabled).length})
                          </h3>
                          {collapsedPrograms[program.id] ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
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
                            const isAvailable = prize.quantity === -1 || prize.quantity > 0;
                            
                            return (
                              <div 
                                key={prize.id}
                                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                                  canAfford && isAvailable 
                                    ? 'border-green-200 bg-green-50 hover:border-green-300' 
                                    : 'border-zinc-200 bg-zinc-50'
                                }`}
                                data-testid={`prize-item-${prize.id}`}
                              >
                                {prize.image_url ? (
                                  <img 
                                    src={prize.image_url} 
                                    alt={prize.name} 
                                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      const placeholder = e.target.parentElement.querySelector('[data-placeholder]');
                                      if (placeholder) placeholder.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div 
                                  data-placeholder
                                  className={`w-16 h-16 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 items-center justify-center flex-shrink-0 ${prize.image_url ? 'hidden' : 'flex'}`}
                                >
                                  <Gift className="w-8 h-8 text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-zinc-900">{prize.name}</h4>
                                  {prize.description && (
                                    <p className="text-sm text-zinc-500 truncate">{prize.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-bold text-orange-600">{prize.points_cost} баллов</span>
                                    {prize.quantity >= 0 && (
                                      <span className="text-xs text-zinc-400">(осталось: {prize.quantity})</span>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  onClick={() => handleRedeemPrize(program.id, prize.id, prize.name, prize.points_cost)}
                                  disabled={!canAfford || !isAvailable || isRedeeming}
                                  className={`whitespace-nowrap ${
                                    canAfford && isAvailable
                                      ? 'bg-green-500 hover:bg-green-600'
                                      : 'bg-zinc-300 cursor-not-allowed'
                                  }`}
                                >
                                  {isRedeeming ? '...' : !isAvailable ? 'Нет в наличии' : canAfford ? 'Получить' : 'Недостаточно'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!collapsedPrograms[program.id] && prizeView === 'grid' && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {program.prizes.filter(p => p.enabled).map((prize) => {
                            const canAfford = (program.progress?.current_amount || 0) >= prize.points_cost;
                            const isRedeeming = redeemingPrize[`${program.id}_${prize.id}`];
                            const isAvailable = prize.quantity === -1 || prize.quantity > 0;
                            
                            return (
                              <div 
                                key={prize.id}
                                className={`group flex flex-col rounded-xl border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${
                                  canAfford && isAvailable 
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
                                      className="max-w-full max-h-full object-contain mix-blend-multiply"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <Gift className="w-10 h-10 text-orange-300" />
                                  )}
                                  {prize.quantity >= 0 && (
                                    <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/90 border border-zinc-200 text-zinc-500">x{prize.quantity}</span>
                                  )}
                                </div>
                                <div className="p-2.5 flex flex-col flex-1">
                                  <h4 className="font-semibold text-zinc-900 text-[13px] leading-tight line-clamp-2 min-h-[34px]">{prize.name}</h4>
                                  <div className="flex items-baseline gap-1 mt-1.5">
                                    <span className="text-base font-bold text-orange-600">{prize.points_cost}</span>
                                    <span className="text-[11px] text-zinc-400">баллов</span>
                                  </div>
                                  <Button
                                    onClick={() => handleRedeemPrize(program.id, prize.id, prize.name, prize.points_cost)}
                                    disabled={!canAfford || !isAvailable || isRedeeming}
                                    size="sm"
                                    data-testid="bonus-redeem-btn"
                                    className={`mt-2 w-full text-xs h-8 ${
                                      canAfford && isAvailable
                                        ? 'bg-orange-500 hover:bg-orange-600'
                                        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                                    }`}
                                  >
                                    {isRedeeming ? '...' : !isAvailable ? 'Нет в наличии' : canAfford ? 'Получить' : 'Недостаточно'}
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

        {/* My Prize Redemptions */}
        {myRedemptions.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden" data-testid="my-prize-redemptions">
            <div className="p-4 border-b border-zinc-100">
              <span className="flex items-center gap-2 font-medium">
                <Gift className="w-5 h-5 text-amber-500" />
                Мои призы ({myRedemptions.length})
              </span>
            </div>
            <div>
              {myRedemptions.map(r => (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <div>
                    <p className="font-medium">{r.prize_name}</p>
                    <p className="text-xs text-zinc-400">{formatDate(r.created_at)} — {r.points_cost} баллов</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    r.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                    (r.status === 'issued' || r.status === 'delivered') ? 'bg-teal-100 text-green-700' :
                    r.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-zinc-100 text-zinc-600'
                  }`}>
                    {r.status === 'pending' && 'Ожидает'}
                    {r.status === 'approved' && 'Одобрен'}
                    {(r.status === 'issued' || r.status === 'delivered') && 'Выдан'}
                    {r.status === 'cancelled' && 'Отклонён'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
