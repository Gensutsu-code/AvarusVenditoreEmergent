import { useState, useEffect } from 'react';
import { Send, Image, FileText, Truck, Bell } from 'lucide-react';
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
    { id: 'notifications', label: 'Уведомления', icon: Bell },
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DeliveryTab isDark={isDark} />
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
