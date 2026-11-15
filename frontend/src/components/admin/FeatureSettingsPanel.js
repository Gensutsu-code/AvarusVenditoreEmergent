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
import PromoTab from './PromoTab';
import { Textarea } from '../ui/textarea';
import { useFeatures } from '../../context/FeaturesContext';
import { GARAGE_TYPES } from '../../lib/garageTypes';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const lblCls = 'text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block';

const ParamField = ({ f, value, onChange, testid }) => {
  const id = `${testid}-${f.name}`;
  if (f.type === 'bool') {
    return (
      <label className="flex items-start justify-between gap-4 p-3 rounded-xl border border-slate-200 cursor-pointer">
        <span>
          <span className="text-sm font-semibold text-slate-800 block">{f.label}</span>
          {f.hint && <span className="text-xs text-slate-500">{f.hint}</span>}
        </span>
        <Switch checked={!!value} onCheckedChange={onChange} data-testid={id} />
      </label>
    );
  }
  let control;
  if (f.type === 'select') {
    control = (
      <select value={value ?? ''} onChange={(e) => onChange(f.numeric ? Number(e.target.value) : e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800" data-testid={id}>
        {f.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    );
  } else if (f.type === 'multi') {
    const list = value || [];
    control = (
      <div className="flex flex-wrap gap-2" data-testid={id}>
        {f.options.map(([v, label]) => {
          const on = list.includes(v);
          return (
            <button key={v} type="button" onClick={() => onChange(on ? list.filter((x) => x !== v) : [...list, v])}
              className={`h-9 px-3 rounded-full border text-sm font-medium transition-colors duration-200 ${on ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              data-testid={`${id}-${v}`} aria-pressed={on}>
              {label}
            </button>
          );
        })}
      </div>
    );
  } else if (f.type === 'textarea') {
    control = <Textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={500} className="rounded-xl" data-testid={id} />;
  } else {
    control = (
      <Input
        type={f.type === 'number' ? 'number' : f.type === 'time' ? 'time' : 'text'}
        min={f.type === 'number' ? 0 : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
        className="rounded-xl" data-testid={id}
      />
    );
  }
  return (
    <div>
      <Label className={lblCls}>{f.label}</Label>
      {control}
      {f.hint && <p className="text-xs text-slate-400 mt-1">{f.hint}</p>}
    </div>
  );
};

const FieldsForm = ({ data, setData, fields, onSave, testid }) => {
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await onSave(); toast.success('Настройки сохранены'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4" data-testid={testid}>
      {fields.filter((f) => !f.showIf || f.showIf(data)).map((f) => (
        f.section
          ? <h4 key={f.section} className="pt-2 text-sm font-bold text-slate-800">{f.section}</h4>
          : <ParamField key={f.name} f={f} value={data[f.name]} onChange={(v) => setData({ ...data, [f.name]: v })} testid={testid} />
      ))}
      <Button onClick={save} disabled={saving} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white" data-testid={`${testid}-save`}>Сохранить</Button>
    </div>
  );
};

// Simple settings stored behind an existing GET/PUT endpoint pair
const EndpointForm = ({ getUrl, putUrl, fields, testid }) => {
  const [data, setData] = useState(null);
  useEffect(() => { axios.get(`${API}${getUrl}`).then((r) => setData(r.data)).catch(() => toast.error('Не удалось загрузить настройки')); }, [getUrl]);
  if (!data) return null;
  return <FieldsForm data={data} setData={setData} fields={fields} testid={testid} onSave={() => axios.put(`${API}${putUrl}`, data)} />;
};

// Parameters of a site function (stored in feature settings, applied site-wide right after saving)
const ParamsForm = ({ featureKey, fields }) => {
  const { settings, reload } = useFeatures();
  const [data, setData] = useState(null);
  useEffect(() => { if (!data && settings[featureKey]) setData(settings[featureKey]); }, [settings, featureKey, data]);
  if (!data) return null;
  const onSave = async () => {
    const r = await axios.put(`${API}/admin/feature-settings/${featureKey}`, data);
    setData(r.data);
    await reload();
  };
  return <FieldsForm data={data} setData={setData} fields={fields} testid={`feature-${featureKey}-form`} onSave={onSave} />;
};

const PARAM_FIELDS = {
  garage: [
    { name: 'max_vehicles', type: 'number', label: 'Лимит техники на клиента', hint: '0 — без ограничения' },
    { name: 'allowed_types', type: 'multi', label: 'Какие типы техники можно добавлять', options: GARAGE_TYPES.map(([id, label]) => [id, label]), hint: 'Уже добавленная техника других типов остаётся в гараже' },
    { name: 'checkout_mode', type: 'select', label: 'Выбор техники при оформлении заказа', options: [['off', 'Не спрашивать'], ['optional', 'По желанию клиента'], ['required', 'Обязательно, если в гараже есть техника']] },
  ],
  chat: [
    { section: 'Оформление' },
    { name: 'title', type: 'text', label: 'Заголовок окна чата' },
    { name: 'subtitle', type: 'text', label: 'Подзаголовок' },
    { name: 'greeting_title', type: 'text', label: 'Приветствие' },
    { name: 'greeting_text', type: 'textarea', label: 'Текст под приветствием', hint: 'Клиент видит его до первого сообщения' },
    { section: 'Доступ' },
    { name: 'guests_allowed', type: 'bool', label: 'Чат для гостей', hint: 'Писать можно без входа в аккаунт; гость отображается в разделе «Чаты» как «Гость»' },
    { name: 'attachments_allowed', type: 'bool', label: 'Вложения в чате', hint: 'Клиенты могут отправлять фото и файлы (гостям вложения недоступны)' },
    { section: 'Часы работы и автоответ' },
    { name: 'work_hours_enabled', type: 'bool', label: 'Учитывать часы работы', hint: 'Вне рабочего времени клиент сразу получает автоответ (не чаще раза в 3 часа)' },
    { name: 'work_start', type: 'time', label: 'Начало рабочего дня', showIf: (d) => d.work_hours_enabled },
    { name: 'work_end', type: 'time', label: 'Конец рабочего дня', showIf: (d) => d.work_hours_enabled },
    { name: 'work_days', type: 'multi', label: 'Рабочие дни', showIf: (d) => d.work_hours_enabled, options: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => [i, d]) },
    { name: 'utc_offset', type: 'number', label: 'Часовой пояс, UTC+', hint: 'Москва — 3', showIf: (d) => d.work_hours_enabled },
    { name: 'auto_reply', type: 'textarea', label: 'Текст автоответа', showIf: (d) => d.work_hours_enabled },
  ],
  favorites: [
    { name: 'max_items', type: 'number', label: 'Лимит товаров в избранном', hint: '0 — без ограничения' },
    { name: 'notify_price_drop', type: 'bool', label: 'Уведомлять о снижении цены', hint: 'Когда цена избранного товара в прайсе снижается, клиент получает уведомление на сайте' },
    { name: 'notify_back_in_stock', type: 'bool', label: 'Уведомлять о поступлении', hint: 'Когда избранный товар снова появляется в наличии' },
  ],
  product_requests: [
    { name: 'show_out_of_stock', type: 'bool', label: 'Кнопка запроса у товаров не в наличии', hint: 'На странице товара, которого нет на складе' },
    { name: 'show_not_found', type: 'bool', label: 'Кнопка запроса, если товар не найден', hint: 'В каталоге при пустом результате поиска' },
    { name: 'comment_required', type: 'bool', label: 'Обязательный комментарий', hint: 'Клиент должен описать, что именно ему нужно' },
    { name: 'offer_valid_days', type: 'number', label: 'Срок действия вашего предложения, дней', hint: '0 — бессрочно. По истечении срока клиент не сможет принять предложение' },
  ],
};

const BannerManager = () => {
  const [banner, setBanner] = useState(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { axios.get(`${API}/promo-banner`).then((r) => setBanner(r.data)).catch(() => toast.error('Не удалось загрузить баннер')); }, []);
  if (!banner) return null;
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await axios.post(`${API}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBanner((b) => ({ ...b, image: r.data.url }));
      toast.success('Изображение загружено');
    } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка загрузки'); }
    finally { setUploading(false); }
  };
  const save = () => axios.put(`${API}/admin/promo-banner`, banner).then(() => toast.success('Баннер обновлён')).catch(() => toast.error('Ошибка сохранения'));
  return <PromoTab promoBanner={banner} setPromoBanner={setBanner} uploading={uploading} handlePromoImageUpload={upload} handleSavePromoBanner={save} />;
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
  promo_banner: () => <BannerManager />,
  ...Object.fromEntries(Object.entries(PARAM_FIELDS).map(([key, fields]) => [key, () => <ParamsForm featureKey={key} fields={fields} />])),
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
