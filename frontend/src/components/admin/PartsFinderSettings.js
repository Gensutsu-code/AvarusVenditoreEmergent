import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Wrench, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PartsFinderSettings = ({ isDark }) => {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/parts-finder/settings`).then(r => setCfg(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/parts-finder/settings`, cfg);
      toast.success('Настройки подбора сохранены');
    } catch (e) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) return null;
  const cardCls = isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200';
  const inputCls = isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : '';
  const txt = isDark ? 'text-zinc-100' : 'text-zinc-900';
  const sub = isDark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <div className="space-y-5" data-testid="parts-finder-settings">
      {/* AI */}
      <div className={`rounded-xl border p-5 ${cardCls}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-500" />
            <div>
              <h3 className={`font-bold ${txt}`}>ИИ-подбор по каталогу</h3>
              <p className={`text-sm ${sub}`}>Работает уже сейчас: ИИ сопоставляет запрос с вашими товарами.</p>
            </div>
          </div>
          <Switch checked={!!cfg.ai_enabled} onCheckedChange={(v) => setCfg({ ...cfg, ai_enabled: v })} data-testid="finder-ai-toggle" />
        </div>
      </div>

      {/* Monetization */}
      <div className={`rounded-xl border p-5 ${cardCls}`}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className={`font-bold ${txt}`}>Платный доступ к подбору</h3>
          </div>
          <Switch checked={!!cfg.paid_enabled} onCheckedChange={(v) => setCfg({ ...cfg, paid_enabled: v })} data-testid="finder-paid-toggle" />
        </div>
        <p className={`text-sm mb-4 ${sub}`}>
          Когда включено — клиент платит за подбор: подписка (период, безлимит) или разовый запрос. Оплата с баланса (₽) или баллами (× множитель). Баллы за подбор не начисляются.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className={`text-xs ${sub}`}>Цена разового запроса, ₽</Label>
            <Input type="number" min="0" value={cfg.request_price ?? 0} onChange={(e) => setCfg({ ...cfg, request_price: e.target.value })} className={`mt-1 ${inputCls}`} data-testid="finder-request-price" />
          </div>
          <div>
            <Label className={`text-xs ${sub}`}>Бесплатных запросов на клиента</Label>
            <Input type="number" min="0" value={cfg.free_requests ?? 0} onChange={(e) => setCfg({ ...cfg, free_requests: e.target.value })} className={`mt-1 ${inputCls}`} data-testid="finder-free-requests" />
          </div>
          <div>
            <Label className={`text-xs ${sub}`}>Цена подписки, ₽</Label>
            <Input type="number" min="0" value={cfg.subscription_price ?? 0} onChange={(e) => setCfg({ ...cfg, subscription_price: e.target.value })} className={`mt-1 ${inputCls}`} data-testid="finder-sub-price" />
          </div>
          <div>
            <Label className={`text-xs ${sub}`}>Длительность подписки, дней</Label>
            <Input type="number" min="1" value={cfg.subscription_days ?? 30} onChange={(e) => setCfg({ ...cfg, subscription_days: e.target.value })} className={`mt-1 ${inputCls}`} data-testid="finder-sub-days" />
          </div>
          <div>
            <Label className={`text-xs ${sub}`}>Множитель цены в баллах (× от ₽)</Label>
            <Input type="number" min="1" step="0.5" value={cfg.points_multiplier ?? 2} onChange={(e) => setCfg({ ...cfg, points_multiplier: e.target.value })} className={`mt-1 ${inputCls}`} data-testid="finder-points-mult" />
          </div>
        </div>
        {cfg.paid_enabled && (
          <p className={`text-xs mt-3 ${sub}`}>
            В баллах: разовый — {Math.round((Number(cfg.request_price) || 0) * (Number(cfg.points_multiplier) || 1))}, подписка — {Math.round((Number(cfg.subscription_price) || 0) * (Number(cfg.points_multiplier) || 1))}.
          </p>
        )}
      </div>

      {/* Paid catalog */}
      <div className={`rounded-xl border p-5 ${cardCls}`}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-teal-500" />
            <h3 className={`font-bold ${txt}`}>Платный каталог (VIN-декодер)</h3>
          </div>
          <Switch checked={!!cfg.catalog_enabled} onCheckedChange={(v) => setCfg({ ...cfg, catalog_enabled: v })} data-testid="finder-catalog-toggle" />
        </div>
        <p className={`text-sm mb-4 ${sub}`}>
          Заглушка для будущей интеграции (Laximo / TecDoc и т.п.). Укажите провайдера, URL и API-ключ — после реализации интеграции подбор будет точным по VIN.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className={`text-xs ${sub}`}>Провайдер</Label>
            <Input value={cfg.provider || ''} onChange={(e) => setCfg({ ...cfg, provider: e.target.value })} placeholder="Laximo / TecDoc" className={`mt-1 ${inputCls}`} data-testid="finder-provider" />
          </div>
          <div>
            <Label className={`text-xs ${sub}`}>Base URL</Label>
            <Input value={cfg.base_url || ''} onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })} placeholder="https://api..." className={`mt-1 ${inputCls}`} data-testid="finder-base-url" />
          </div>
          <div className="sm:col-span-2">
            <Label className={`text-xs ${sub}`}>API-ключ</Label>
            <Input type="password" value={cfg.api_key || ''} onChange={(e) => setCfg({ ...cfg, api_key: e.target.value })} placeholder="••••••••" className={`mt-1 ${inputCls}`} data-testid="finder-api-key" />
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="finder-settings-save">
        {saving ? 'Сохранение...' : 'Сохранить настройки'}
      </Button>
    </div>
  );
};

export default PartsFinderSettings;
