import { useState, useEffect } from 'react';
import { Send, Image, FileText, Truck, Bell, Upload, Download, FileSpreadsheet, Power, Code } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

// Import existing components
import { TelegramTab, PartnersTab, TermsTab } from './index';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Delivery Settings sub-tab
const DeliveryTab = ({ isDark }) => {
  const [settings, setSettings] = useState({ min_free_delivery: 5000, delivery_price: 500, delivery_enabled: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/delivery-settings`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/delivery-settings`, settings, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Настройки доставки сохранены');
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Настройки доставки</h3>
        
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.delivery_enabled}
              onChange={e => setSettings({ ...settings, delivery_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-500"
              data-testid="delivery-enabled-toggle"
            />
            <Label className={isDark ? 'text-zinc-300' : 'text-slate-700'}>Платная доставка включена</Label>
          </div>

          <div>
            <Label className={`text-xs font-semibold uppercase ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              Минимальная сумма для бесплатной доставки (₽)
            </Label>
            <Input
              type="number"
              value={settings.min_free_delivery}
              onChange={e => setSettings({ ...settings, min_free_delivery: Number(e.target.value) })}
              className={`mt-1.5 ${isDark ? 'bg-zinc-700 border-zinc-600 text-white' : 'border-slate-200'}`}
              data-testid="min-free-delivery-input"
            />
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              Заказы на эту сумму и выше — бесплатная доставка
            </p>
          </div>

          <div>
            <Label className={`text-xs font-semibold uppercase ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              Стоимость доставки (₽)
            </Label>
            <Input
              type="number"
              value={settings.delivery_price}
              onChange={e => setSettings({ ...settings, delivery_price: Number(e.target.value) })}
              className={`mt-1.5 ${isDark ? 'bg-zinc-700 border-zinc-600 text-white' : 'border-slate-200'}`}
              data-testid="delivery-price-input"
            />
            <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              Применяется если сумма заказа ниже минимальной
            </p>
          </div>
        </div>

        <Button
          onClick={save}
          disabled={saving}
          className="mt-6 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl"
          data-testid="save-delivery-settings-btn"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </div>
  );
};

// CSV Import sub-tab
const ImportTab = ({ isDark }) => {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleDownload = async (type) => {
    const url = type === 'template' 
      ? `${API}/admin/products/csv-template` 
      : `${API}/admin/products/csv-prompt`;
    try {
      const res = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = type === 'template' ? 'products_template.csv' : 'chatgpt_prompt.txt';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch { toast.error('Ошибка скачивания'); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/admin/products/import-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
      if (res.data.imported > 0) toast.success(`Импортировано ${res.data.imported} товаров`);
      else toast.info('Нет новых товаров для импорта');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка импорта');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Download section */}
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Шаблоны</h3>
        <p className={`text-sm mb-5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
          Скачайте шаблон CSV и промпт для ChatGPT для быстрого заполнения
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleDownload('template')}
            variant="outline"
            className={`gap-2 rounded-xl ${isDark ? 'border-zinc-600 text-zinc-300 hover:bg-zinc-700' : 'border-slate-200 hover:bg-slate-50'}`}
            data-testid="download-csv-template"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-500" />
            Скачать шаблон CSV
          </Button>
          <Button
            onClick={() => handleDownload('prompt')}
            variant="outline"
            className={`gap-2 rounded-xl ${isDark ? 'border-zinc-600 text-zinc-300 hover:bg-zinc-700' : 'border-slate-200 hover:bg-slate-50'}`}
            data-testid="download-gpt-prompt"
          >
            <Download className="w-4 h-4 text-purple-500" />
            Скачать промпт для ChatGPT
          </Button>
        </div>
      </div>

      {/* Upload section */}
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Импорт товаров</h3>
        <p className={`text-sm mb-5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
          Загрузите CSV файл с товарами. Разделитель — точка с запятой (;). Дубликаты артикулов будут пропущены.
        </p>
        <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer transition-colors ${
          uploading ? 'opacity-50 pointer-events-none' : ''
        } bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-medium text-sm`}>
          <Upload className="w-4 h-4" />
          {uploading ? 'Загрузка...' : 'Выбрать CSV файл'}
          <input type="file" accept=".csv" onChange={handleUpload} className="hidden" data-testid="csv-file-input" />
        </label>
      </div>

      {/* Result section */}
      {result && (
        <div className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>Результат импорта</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className={`p-4 rounded-lg text-center ${isDark ? 'bg-emerald-900/30' : 'bg-emerald-50'}`}>
              <p className="text-2xl font-bold text-emerald-600">{result.imported}</p>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Импортировано</p>
            </div>
            <div className={`p-4 rounded-lg text-center ${isDark ? 'bg-amber-900/30' : 'bg-amber-50'}`}>
              <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Пропущено</p>
            </div>
            <div className={`p-4 rounded-lg text-center ${isDark ? 'bg-zinc-700/50' : 'bg-slate-50'}`}>
              <p className="text-2xl font-bold text-slate-600">{result.total_rows}</p>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Всего строк</p>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div>
              <p className={`text-sm font-medium mb-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Ошибки:</p>
              <div className={`max-h-40 overflow-y-auto text-xs space-y-1 p-3 rounded-lg ${isDark ? 'bg-zinc-900/50' : 'bg-slate-50'}`}>
                {result.errors.map((err, i) => (
                  <p key={i} className={isDark ? 'text-red-300' : 'text-red-500'}>{err}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Notifications Settings sub-tab
const NotificationsTab = ({ isDark }) => {
  const [settings, setSettings] = useState({ client_notifications_enabled: true });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/notification-settings`).then(r => {
      setSettings({ client_notifications_enabled: r.data.client_notifications_enabled !== false });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/notification-settings`, settings);
      toast.success('Настройки уведомлений сохранены');
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Уведомления на сайте</h3>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className={`font-medium ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>Уведомления для клиентов</Label>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                Toast-уведомления и звуковые оповещения на сайте
              </p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, client_notifications_enabled: !s.client_notifications_enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.client_notifications_enabled ? 'bg-teal-500' : isDark ? 'bg-zinc-600' : 'bg-slate-300'}`}
              data-testid="client-notifications-toggle"
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.client_notifications_enabled ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="mt-6 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl"
          data-testid="save-notification-settings-btn"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </div>
  );
};

// Maintenance Mode sub-tab
const MaintenanceTab = ({ isDark }) => {
  const [settings, setSettings] = useState({ enabled: false, message: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/maintenance/status`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const toggle = async () => {
    const action = settings.enabled ? 'включить' : 'выключить';
    if (!window.confirm(`${settings.enabled ? 'Включить' : 'Выключить'} сайт?`)) return;
    try {
      const res = await axios.post(`${API}/maintenance/toggle`);
      setSettings(s => ({ ...s, enabled: res.data.enabled }));
      toast.success(res.data.enabled ? 'Сайт выключен — режим техработ' : 'Сайт включён');
    } catch { toast.error('Ошибка'); }
  };

  const saveMessage = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/maintenance/settings`, { message: settings.message });
      setSettings(res.data);
      toast.success('Сообщение сохранено');
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-5 ${isDark ? 'text-white' : 'text-slate-800'}`}>Режим технических работ</h3>

        <div className={`p-5 rounded-xl mb-5 flex items-center justify-between ${
          settings.enabled
            ? isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'
            : isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.enabled ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
            <div>
              <p className={`font-bold ${
                settings.enabled
                  ? isDark ? 'text-red-400' : 'text-red-700'
                  : isDark ? 'text-green-400' : 'text-green-700'
              }`}>
                {settings.enabled ? 'Сайт выключен' : 'Сайт работает'}
              </p>
              <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                {settings.enabled ? 'Посетители видят страницу техработ' : 'Сайт доступен для всех'}
              </p>
            </div>
          </div>
          <Button
            onClick={toggle}
            className={settings.enabled
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
            }
            data-testid="maintenance-toggle-btn"
          >
            <Power className="w-4 h-4 mr-2" />
            {settings.enabled ? 'Включить сайт' : 'Выключить сайт'}
          </Button>
        </div>

        <div className="space-y-3">
          <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
            Сообщение для посетителей (необязательно)
          </Label>
          <Input
            value={settings.message}
            onChange={(e) => setSettings(s => ({ ...s, message: e.target.value }))}
            placeholder="Мы обновляем сайт, чтобы сделать его ещё лучше. Скоро вернёмся!"
            className={isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-600' : ''}
            data-testid="maintenance-message-input"
          />
          <Button
            onClick={saveMessage}
            disabled={saving}
            variant="outline"
            size="sm"
            data-testid="save-maintenance-message-btn"
          >
            {saving ? 'Сохранение...' : 'Сохранить сообщение'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Developer Mode sub-tab
const DeveloperModeTab = ({ isDark }) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/admin/developer-mode`).then(r => {
      setEnabled(r.data.enabled);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggle = async () => {
    try {
      const res = await axios.put(`${API}/admin/developer-mode`);
      setEnabled(res.data.enabled);
      toast.success(res.data.enabled ? 'Developer Mode включён' : 'Developer Mode выключен');
    } catch { toast.error('Ошибка'); }
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Developer Mode</h3>
        <p className={`text-sm mb-5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
          Режим разработчика даёт полный контроль над данными. Все действия логируются во вкладке "Логи".
        </p>

        <div className={`p-5 rounded-xl flex items-center justify-between ${
          enabled
            ? isDark ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'
            : isDark ? 'bg-zinc-700/50 border border-zinc-600' : 'bg-slate-50 border border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${enabled ? 'bg-amber-500 animate-pulse' : isDark ? 'bg-zinc-500' : 'bg-slate-400'}`} />
            <div>
              <p className={`font-bold ${
                enabled
                  ? isDark ? 'text-amber-400' : 'text-amber-700'
                  : isDark ? 'text-zinc-300' : 'text-slate-700'
              }`}>
                {enabled ? 'Developer Mode активен' : 'Developer Mode выключен'}
              </p>
              <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                {enabled ? 'Все действия пользователей и админов логируются' : 'Логирование действий отключено'}
              </p>
            </div>
          </div>
          <Button
            onClick={toggle}
            className={enabled
              ? isDark ? 'bg-zinc-600 hover:bg-zinc-500 text-white' : 'bg-slate-500 hover:bg-slate-600 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
            }
            data-testid="developer-mode-toggle-btn"
          >
            <Code className="w-4 h-4 mr-2" />
            {enabled ? 'Выключить' : 'Включить'}
          </Button>
        </div>

        <div className={`mt-5 p-4 rounded-xl ${isDark ? 'bg-zinc-900/50 border border-zinc-700' : 'bg-slate-50 border border-slate-200'}`}>
          <h4 className={`text-sm font-bold mb-3 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Возможности Developer Mode:</h4>
          <ul className={`text-sm space-y-2 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
              Логирование всех действий пользователей и администраторов
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
              Просмотр логов с фильтрацией по пользователю, типу и дате
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
              Прямое редактирование данных в JSON-формате
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
              Откат любого изменения данных (Undo)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Sub-tab component for Settings section (TG + Partners + Rules)
export const SettingsTab = ({
  // Telegram props
  telegramConfig,
  setTelegramConfig,
  handleSaveTelegramConfig,
  handleTestTelegram,
  
  // Partners props
  partners,
  setPartners,
  editingPartner,
  setEditingPartner,
  isNewPartner,
  setIsNewPartner,
  handleAddDefaultPartners,
  handleDeletePartner,
  handleSavePartner,
  handlePartnerImageUpload,
  partnerImageUploading,
  partnerImageRef,
  
  // Terms props
  termsSections,
  setTermsSections,
  handleSaveTerms,
  handleResetTerms,
  termsSaving,
  
  isDark = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState('telegram');

  const subTabs = [
    { id: 'telegram', label: 'Telegram', icon: Send },
    { id: 'delivery', label: 'Доставка', icon: Truck },
    { id: 'import', label: 'Импорт', icon: Upload },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
    { id: 'maintenance', label: 'Техработы', icon: Power },
    { id: 'partners', label: 'Партнёры', icon: Image },
    { id: 'terms', label: 'Правила', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className={`flex gap-2 border-b pb-4 ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSubTab === tab.id
                  ? isDark 
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' 
                    : 'bg-teal-500 text-white'
                  : isDark
                    ? 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 border border-zinc-700/50'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Telegram Settings */}
      {activeSubTab === 'telegram' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TelegramTab
            telegramSettings={telegramConfig || { enabled: false, bot_token: '', chat_id: '' }}
            setTelegramSettings={setTelegramConfig}
            handleSaveTelegram={handleSaveTelegramConfig}
            handleTestTelegram={handleTestTelegram}
            isDark={isDark}
          />
        </motion.div>
      )}

      {/* Delivery Settings */}
      {activeSubTab === 'delivery' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <DeliveryTab isDark={isDark} />
        </motion.div>
      )}

      {/* Import */}
      {activeSubTab === 'import' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <ImportTab isDark={isDark} />
        </motion.div>
      )}

      {/* Notifications Settings */}
      {activeSubTab === 'notifications' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <NotificationsTab isDark={isDark} />
        </motion.div>
      )}

      {/* Maintenance */}
      {activeSubTab === 'maintenance' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <MaintenanceTab isDark={isDark} />
        </motion.div>
      )}

      {/* Partners */}
      {activeSubTab === 'partners' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PartnersTab
            partners={partners}
            setPartners={setPartners}
            editingPartner={editingPartner}
            setEditingPartner={setEditingPartner}
            isNewPartner={isNewPartner}
            setIsNewPartner={setIsNewPartner}
            handleAddDefaultPartners={handleAddDefaultPartners}
            handleDeletePartner={handleDeletePartner}
            handleSavePartner={handleSavePartner}
            handlePartnerImageUpload={handlePartnerImageUpload}
            partnerImageUploading={partnerImageUploading}
            partnerImageRef={partnerImageRef}
            isDark={isDark}
          />
        </motion.div>
      )}

      {/* Terms */}
      {activeSubTab === 'terms' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TermsTab
            termsSections={termsSections}
            setTermsSections={setTermsSections}
            handleSaveTerms={handleSaveTerms}
            handleResetTerms={handleResetTerms}
            termsSaving={termsSaving}
            isDark={isDark}
          />
        </motion.div>
      )}

    </div>
  );
};

export default SettingsTab;
