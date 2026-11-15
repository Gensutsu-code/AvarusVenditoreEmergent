import { useState, useEffect } from 'react';
import axios from 'axios';
import { Award, Gift, Wallet, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { RewardSystemCard } from './RewardSystemCard';
import { RewardClients } from './RewardClients';
import { CashbackWithdrawals } from './CashbackWithdrawals';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SYSTEMS = [
  { key: 'points', title: 'Бонусные баллы', icon: Award },
  { key: 'ozon', title: 'Сертификаты Ozon', icon: Gift },
  { key: 'cashback', title: 'Кэшбэк', icon: Wallet },
];

export const RewardSettings = () => {
  const [settings, setSettings] = useState(null);
  const [targets, setTargets] = useState({ categories: [], warehouses: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/rewards/settings`).then((r) => setSettings(r.data)).catch(() => toast.error('Не удалось загрузить настройки вознаграждений'));
    Promise.all([axios.get(`${API}/categories`), axios.get(`${API}/admin/warehouses`)])
      .then(([c, w]) => setTargets({ categories: c.data || [], warehouses: w.data || [] }))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await axios.put(`${API}/admin/rewards/settings`, settings);
      setSettings(r.data);
      toast.success('Настройки вознаграждений сохранены');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка сохранения');
    } finally { setSaving(false); }
  };

  if (!settings) return null;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" data-testid="reward-settings-card">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center">
            <SlidersHorizontal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Системы вознаграждения</h2>
            <p className="text-sm text-slate-500">Клиент один раз выбирает одну систему. Начисление — после выполнения заказа.</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl" data-testid="reward-settings-save-btn">
          <Save className="w-4 h-4 mr-2" />Сохранить настройки
        </Button>
      </div>

      <Tabs defaultValue="points">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {SYSTEMS.map(({ key, title, icon: Icon }) => (
            <TabsTrigger key={key} value={key} data-testid={`reward-tab-${key}`}>
              <Icon className="w-4 h-4 mr-1.5" />{title}
              <span className={`ml-2 w-2 h-2 rounded-full ${settings[key].enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </TabsTrigger>
          ))}
          <TabsTrigger value="clients" data-testid="reward-tab-clients">Клиенты</TabsTrigger>
          <TabsTrigger value="withdrawals" data-testid="reward-tab-withdrawals">Вывод кэшбэка</TabsTrigger>
        </TabsList>
        {SYSTEMS.map(({ key, title }) => (
          <TabsContent key={key} value={key} className="pt-5">
            <RewardSystemCard
              systemKey={key}
              title={title}
              cfg={settings[key]}
              targets={targets}
              onChange={(cfg) => setSettings((s) => ({ ...s, [key]: cfg }))}
            />
          </TabsContent>
        ))}
        <TabsContent value="clients" className="pt-5"><RewardClients /></TabsContent>
        <TabsContent value="withdrawals" className="pt-5"><CashbackWithdrawals /></TabsContent>
      </Tabs>
    </div>
  );
};
