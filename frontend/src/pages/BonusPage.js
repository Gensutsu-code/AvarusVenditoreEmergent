import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Gift, Award, Star, Trophy, TrendingUp, Send, Clock, 
  CheckCircle, Copy, History, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BonusPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bonusPrograms, setBonusPrograms] = useState([]);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingBonus, setRequestingBonus] = useState({});
  const [redeemingPrize, setRedeemingPrize] = useState({});
  const [expandedProgram, setExpandedProgram] = useState(null);
  const [redeemedPrize, setRedeemedPrize] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

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
      const [programsRes, historyRes] = await Promise.all([
        axios.get(`${API}/bonus/programs`),
        axios.get(`${API}/bonus/history`)
      ]);
      setBonusPrograms(programsRes.data.programs || []);
      setBonusHistory(historyRes.data.history || []);
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

  const handleRequestBonus = async (programId, programTitle) => {
    const confirmText = `Вы уверены, что хотите запросить бонус по программе «${programTitle}»?`;
    if (!window.confirm(confirmText)) return;
    
    setRequestingBonus(prev => ({ ...prev, [programId]: true }));
    try {
      const res = await axios.post(`${API}/bonus/request/${programId}`);
      toast.success(res.data.message);
      fetchBonusData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки запроса');
    } finally {
      setRequestingBonus(prev => ({ ...prev, [programId]: false }));
    }
  };

  const handleRedeemPrize = async (programId, prizeId, prizeName, pointsCost) => {
    const confirmText = `Обменять ${pointsCost} баллов на «${prizeName}»?\n\nПосле подтверждения баллы будут списаны с вашего счёта.`;
    if (!window.confirm(confirmText)) return;
    
    const key = `${programId}_${prizeId}`;
    setRedeemingPrize(prev => ({ ...prev, [key]: true }));
    try {
      const res = await axios.post(`${API}/bonus/redeem-prize/${programId}/${prizeId}`);
      toast.success(res.data.message);
      setRedeemedPrize({ name: prizeName, pointsCost });
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
  const totalPoints = bonusPrograms.reduce((sum, p) => sum + (p.bonus_points || 0), 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white" data-testid="bonus-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Total Points */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Бонусная программа
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-2">
            Ваши бонусы
          </h1>
          <p className="text-zinc-500">Накапливайте баллы и обменивайте на призы</p>
        </div>

        {/* Total Points Card */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 rounded-2xl p-6 md:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-orange-200 text-sm font-medium mb-1">Накоплено баллов</p>
              <p className="text-5xl md:text-6xl font-bold">{totalPoints.toFixed(0)}</p>
              <p className="text-orange-200 text-sm mt-2">Доступно для обмена на призы</p>
            </div>
            <div className="w-20 h-20 md:w-24 md:h-24 bg-white/20 rounded-full flex items-center justify-center">
              <Gift className="w-10 h-10 md:w-12 md:h-12" />
            </div>
          </div>
        </div>

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
              const isExpanded = expandedProgram === program.id;

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
                        <p className="text-3xl font-bold text-orange-500">{(program.bonus_points || 0).toFixed(0)}</p>
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
                        <div className="flex justify-between mb-2">
                          {sortedLevels.map((level, idx) => {
                            const isActive = program.current_level?.id === level.id;
                            const isAchieved = yearlyTotal >= level.min_points;
                            return (
                              <div key={level.id} className="flex flex-col items-center">
                                <div 
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    isActive 
                                      ? 'ring-4 ring-offset-2 scale-110' 
                                      : ''
                                  } ${isAchieved ? 'text-white' : 'text-white opacity-50'}`}
                                  style={{ 
                                    backgroundColor: level.color,
                                    '--tw-ring-color': isActive ? level.color + '60' : 'transparent'
                                  }}
                                >
                                  {idx + 1}
                                </div>
                                <p className={`text-xs mt-1 ${isActive ? 'font-bold' : isAchieved ? '' : 'opacity-60'}`} style={{ color: level.color }}>
                                  {level.name}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Progress Line */}
                        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, (yearlyTotal / (sortedLevels[sortedLevels.length - 1]?.min_points || 100000)) * 100)}%`,
                              backgroundColor: program.current_level.color
                            }}
                          />
                        </div>
                      </div>

                      {/* Progress Info */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <span className="text-zinc-600">Покупки за {currentYear}:</span>
                          <span className="font-bold text-green-600">{formatPrice(yearlyTotal)} ₽</span>
                        </div>
                        {nextLevel && (
                          <span className="text-zinc-500">
                            До <span className="font-semibold" style={{ color: nextLevel.color }}>{nextLevel.name}</span>: {formatPrice(amountToNextLevel)} ₽
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Prizes Section */}
                  {program.prizes && program.prizes.filter(p => p.enabled).length > 0 && (
                    <div className="p-6 border-t border-zinc-100">
                      <button 
                        className="flex items-center justify-between w-full"
                        onClick={() => setExpandedProgram(isExpanded ? null : program.id)}
                      >
                        <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                          <Award className="w-5 h-5 text-orange-500" />
                          Доступные призы ({program.prizes.filter(p => p.enabled).length})
                        </h3>
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      
                      {isExpanded && (
                        <div className="mt-4 grid gap-3">
                          {program.prizes.filter(p => p.enabled).map((prize) => {
                            const canAfford = (program.bonus_points || 0) >= prize.points_cost;
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
                              >
                                {prize.image_url ? (
                                  <img 
                                    src={prize.image_url} 
                                    alt={prize.name} 
                                    className="w-16 h-16 rounded-xl object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div 
                                  className={`w-16 h-16 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 items-center justify-center ${prize.image_url ? 'hidden' : 'flex'}`}
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

                  {/* Request Bonus Button */}
                  <div className="p-6 border-t border-zinc-100 bg-zinc-50">
                    {program.bonus_requested ? (
                      <div className="text-center p-4 bg-orange-100 rounded-xl">
                        <div className="flex items-center justify-center gap-2 text-orange-600 mb-2">
                          <Clock className="w-5 h-5 animate-pulse" />
                          <span className="font-bold">Запрос отправлен!</span>
                        </div>
                        <p className="text-sm text-orange-700">
                          Администратор скоро свяжется с вами и выдаст промокод.
                        </p>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => handleRequestBonus(program.id, program.title)}
                        disabled={requestingBonus[program.id] || (program.bonus_points || 0) === 0}
                        className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 text-lg shadow-lg disabled:opacity-50"
                      >
                        <Send className="w-5 h-5 mr-2" />
                        {requestingBonus[program.id] ? 'Отправка...' : (program.request_button_text || 'Запросить бонус')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                          ? 'bg-green-100 text-green-600' 
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
