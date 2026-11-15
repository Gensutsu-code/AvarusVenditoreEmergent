import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, FileText, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

// Import existing components
import { PromoTab, NotificationsTab } from './index';
import NewsTab from './NewsTab';

// Sub-tab component for Marketing section (Promo + News + Newsletters)
export const MarketingTab = ({
  // Promo props
  promoBanner,
  setPromoBanner,
  handleSavePromoBanner,
  uploading,
  handlePromoImageUpload,
  promoFileRef,
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
  const [searchParams] = useSearchParams();
  const subParam = searchParams.get('sub');
  const [activeSubTab, setActiveSubTab] = useState(subParam || 'promo');
  useEffect(() => { if (subParam) setActiveSubTab(subParam); }, [subParam]);

  const subTabs = [
    { id: 'promo', label: 'Акции и баннер', icon: Megaphone },
    { id: 'news', label: 'Новости', icon: FileText },
    { id: 'newsletters', label: 'Рассылки', icon: Mail },
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
            uploading={uploading}
            handlePromoImageUpload={handlePromoImageUpload}
            promoFileRef={promoFileRef}
            isDark={isDark}
          />
        </motion.div>
      )}

      {/* News */}
      {activeSubTab === 'news' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <NewsTab
            newsList={news || []}
            setNewsList={setNews}
          />
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
            isDark={isDark}
          />
        </motion.div>
      )}
    </div>
  );
};

export default MarketingTab;
