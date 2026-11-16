import { Navigate, useSearchParams } from 'react-router-dom';
import { Sparkles, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeaturesContext';
import AiAssistantPage from './AiAssistantPage';
import PartsFinderPage from './PartsFinderPage';

const MODES = [
  { id: 'ai', feature: 'ai_assistant', label: 'Спросить ИИ', icon: Sparkles, Page: AiAssistantPage },
  { id: 'params', feature: 'parts_finder', label: 'Подбор по параметрам', icon: SlidersHorizontal, Page: PartsFinderPage },
];

export default function PartsHubPage() {
  const { user } = useAuth();
  const { isOn, loaded } = useFeatures();
  const [params, setParams] = useSearchParams();

  const modes = MODES.filter((m) => isOn(m.feature) && (user?.role !== 'manager' || m.id === 'ai'));
  if (!loaded) return null;
  if (modes.length === 0) return <Navigate to="/" replace />;
  const mode = modes.find((m) => m.id === params.get('mode'))?.id || modes[0].id;

  return (
    <div data-testid="parts-hub-page">
      {modes.length > 1 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
          <div className="inline-flex p-1 rounded-2xl bg-white border border-slate-200 shadow-sm" data-testid="parts-hub-modes">
            {modes.map((m) => {
              const Icon = m.icon;
              const on = m.id === mode;
              return (
                <button key={m.id} type="button" onClick={() => setParams({ mode: m.id }, { replace: true })} className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold transition-colors duration-200 ${on ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`} aria-pressed={on} data-testid={`parts-hub-mode-${m.id}`}>
                  <Icon className="w-4 h-4" />{m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {modes.map((m) => (
        <div key={m.id} className={m.id === mode ? '' : 'hidden'} data-testid={`parts-hub-panel-${m.id}`}>
          <m.Page />
        </div>
      ))}
    </div>
  );
}
