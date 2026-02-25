import { useState } from 'react';
import { Settings, Send, Upload, Image, FileText, Users } from 'lucide-react';
import { motion } from 'framer-motion';

// Import existing components
import { TelegramTab, ImportTab, PartnersTab, TermsTab } from './index';

// Sub-tab component for Settings section (TG + Import + Partners + Rules)
export const SettingsTab = ({
  // Telegram props
  telegramConfig,
  setTelegramConfig,
  handleSaveTelegramConfig,
  
  // Import props
  uploading,
  importResult,
  setImportResult,
  handleImportProducts,
  handleExportProducts,
  importFileRef,
  
  // Partners props
  partners,
  setPartners,
  editingPartner,
  setEditingPartner,
  handleAddDefaultPartners,
  handleDeletePartner,
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
    { id: 'import', label: 'Импорт/Экспорт', icon: Upload },
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
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                    : 'bg-orange-500 text-white'
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
            isDark={isDark}
          />
        </motion.div>
      )}

      {/* Import/Export */}
      {activeSubTab === 'import' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ImportTab
            uploading={uploading}
            importResult={importResult}
            setImportResult={setImportResult}
            handleImportProducts={handleImportProducts}
            handleExportProducts={handleExportProducts}
            importFileRef={importFileRef}
            isDark={isDark}
          />
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
            handleAddDefaultPartners={handleAddDefaultPartners}
            handleDeletePartner={handleDeletePartner}
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
