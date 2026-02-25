import { useState } from 'react';
import { Megaphone, FileText, Mail, Tag, Percent, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

// Import existing components
import { PromoTab, NotificationsTab } from './index';

// Sub-tab component for Marketing section (Promo + News + Newsletters)
export const MarketingTab = ({
  // Promo props
  promoBanner,
  setPromoBanner,
  handleSavePromoBanner,
  bonusPrograms,
  setBonusPrograms,
  
  // News props
  news,
  setNews,
  
  // Notifications props
  notificationSettings,
  setNotificationSettings,
  handleSaveNotificationSettings,
  testEmail,
  setTestEmail,
  handleSendTestEmail,
  bulkEmailForm,
  setBulkEmailForm,
  handleSendBulkEmail,
  sendingEmail,
  users,
  
  isDark = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState('promo');

  const subTabs = [
    { id: 'promo', label: 'Акции и баннер', icon: Megaphone },
    { id: 'news', label: 'Новости', icon: FileText },
    { id: 'newsletters', label: 'Рассылки', icon: Mail },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-zinc-200 pb-4">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSubTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Promo & Banner */}
      {activeSubTab === 'promo' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PromoTab
            promoBanner={promoBanner}
            setPromoBanner={setPromoBanner}
            handleSavePromoBanner={handleSavePromoBanner}
            bonusPrograms={bonusPrograms}
            setBonusPrograms={setBonusPrograms}
          />
        </motion.div>
      )}

      {/* News */}
      {activeSubTab === 'news' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="p-5 border border-zinc-200 rounded-xl bg-white">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              Управление новостями
            </h3>
            
            {news && news.length > 0 ? (
              <div className="space-y-3">
                {news.map((item) => (
                  <div key={item.id} className="p-3 bg-zinc-50 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-zinc-500 line-clamp-1">{item.content}</p>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {new Date(item.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Новостей пока нет</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Newsletters */}
      {activeSubTab === 'newsletters' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <NotificationsTab
            notificationSettings={notificationSettings}
            setNotificationSettings={setNotificationSettings}
            handleSaveNotificationSettings={handleSaveNotificationSettings}
            testEmail={testEmail}
            setTestEmail={setTestEmail}
            handleSendTestEmail={handleSendTestEmail}
            bulkEmailForm={bulkEmailForm}
            setBulkEmailForm={setBulkEmailForm}
            handleSendBulkEmail={handleSendBulkEmail}
            sendingEmail={sendingEmail}
            users={users}
          />
        </motion.div>
      )}
    </div>
  );
};

export default MarketingTab;
