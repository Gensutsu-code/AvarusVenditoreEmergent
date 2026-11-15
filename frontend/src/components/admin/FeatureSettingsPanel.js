import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { RewardSettings } from './RewardSettings';
import { StatusConditionsSettings } from './StatusConditionsSettings';
import { CartDiscountRequestsSection } from './CartDiscountRequestsSection';
import { CategoryDiscountPanel } from './CategoryDiscountPanel';
import { AiBulkDescriptions } from './AiBulkDescriptions';
import { ProductDiscountsSection, PromoCodesSection } from './DiscountsPromoTab';
import ReturnSettingsPanel from './ReturnSettingsPanel';
import PartsFinderSettings from './PartsFinderSettings';
import NewsTab from './NewsTab';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Simple settings stored behind an existing GET/PUT endpoint pair
const EndpointForm = ({ getUrl, putUrl, fields, testid }) => {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { axios.get(`${API}${getUrl}`).then((r) => setData(r.data)).catch(() => toast.error('Не удалось загрузить настройки')); }, [getUrl]);
  if (!data) return null;
  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}${putUrl}`, data); toast.success('Настройки сохранены'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4" data-testid={testid}>
      {fields.map((f) => (
        <div key={f.name}>
          {f.type === 'bool' ? (
            <label className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-200 cursor-pointer">
              <span className="text-sm font-semibold text-slate-800">{f.label}</span>
              <Switch checked={!!data[f.name]} onCheckedChange={(v) => setData({ ...data, [f.name]: v })} data-testid={`${testid}-${f.name}`} />
            </label>
          ) : (
            <>
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">{f.label}</Label>
              <Input
                type={f.type === 'number' ? 'number' : 'text'}
                value={data[f.name] ?? ''}
                onChange={(e) => setData({ ...data, [f.name]: f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })}
                className="rounded-xl" data-testid={`${testid}-${f.name}`}
              />
            </>
          )}
          {f.hint && <p className="text-xs text-slate-400 mt-1">{f.hint}</p>}
        </div>
      ))}
      <Button onClick={save} disabled={saving} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white" data-testid={`${testid}-save`}>Сохранить</Button>
    </div>
  );
};

const NewsManager = () => {
  const [newsList, setNewsList] = useState(null);
  useEffect(() => { axios.get(`${API}/admin/news`).then((r) => setNewsList(r.data || [])).catch(() => setNewsList([])); }, []);
  return newsList ? <NewsTab newsList={newsList} setNewsList={setNewsList} /> : null;
};

const TELEGRAM_FIELDS = [
  { name: 'enabled', type: 'bool', label: 'Отправлять уведомления о заказах' },
  { name: 'bot_token', type: 'text', label: 'Токен бота', hint: 'Выдаёт @BotFather' },
  { name: 'chat_id', type: 'text', label: 'ID чата или канала' },
];

const PANELS = {
  discounts: () => (<div className="space-y-6"><CategoryDiscountPanel /><ProductDiscountsSection /></div>),
  promo_codes: () => <PromoCodesSection />,
  cart_discounts: () => <CartDiscountRequestsSection />,
  rewards: () => <RewardSettings />,
  credit: () => <StatusConditionsSettings />,
  managers: () => <StatusConditionsSettings />,
  returns: () => <ReturnSettingsPanel />,
  parts_finder: () => <PartsFinderSettings />,
  ai_assistant: () => <AiBulkDescriptions />,
  news: () => <NewsManager />,
  telegram: () => <EndpointForm getUrl="/admin/telegram-settings" putUrl="/admin/telegram-settings" fields={TELEGRAM_FIELDS} testid="feature-telegram-form" />,
};

export const hasFeaturePanel = (key) => !!PANELS[key];

export const FeatureSettingsPanel = ({ featureKey }) => {
  const Panel = PANELS[featureKey];
  if (!Panel) {
    return <p className="text-sm text-slate-500" data-testid="feature-no-settings">У этой функции нет дополнительных параметров — она управляется переключателем и настройкой аудитории выше.</p>;
  }
  return <div data-testid={`feature-settings-${featureKey}`}><Panel /></div>;
};
