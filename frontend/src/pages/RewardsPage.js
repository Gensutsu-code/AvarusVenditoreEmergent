import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PauseCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BonusPage from './BonusPage';
import { RewardChooser } from '../components/rewards/RewardChooser';
import { OzonRewardView } from '../components/rewards/OzonRewardView';
import { CashbackView } from '../components/rewards/CashbackView';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RewardsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);

  const load = useCallback(() => axios.get(`${API}/rewards/me`).then((r) => setInfo(r.data)).catch(() => {}), []);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login'); return; }
    load();
  }, [user, loading, navigate, load]);

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="rewards-loading">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (info.system === 'points') return <BonusPage />;

  return (
    <div className="min-h-screen" data-testid="rewards-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {info.system === 'ozon' && <OzonRewardView info={info} />}
        {info.system === 'cashback' && <CashbackView info={info} reload={load} />}
        {!info.system && !info.chosen && <RewardChooser options={info.options} onChosen={load} />}
        {!info.system && info.chosen && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 max-w-xl" data-testid="reward-system-disabled">
            <PauseCircle className="w-10 h-10 text-slate-400 mb-4" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Бонусная система временно отключена</h1>
            <p className="mt-2 text-slate-500">Начисления по вашей бонусной системе приостановлены. Обратитесь к менеджеру, если хотите перейти на другую систему.</p>
          </div>
        )}
      </div>
    </div>
  );
}
