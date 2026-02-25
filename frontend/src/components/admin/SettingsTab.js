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

      {/* Telegram Settings */}
      {activeSubTab === 'telegram' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TelegramTab
            telegramConfig={telegramConfig}
            setTelegramConfig={setTelegramConfig}
            handleSaveTelegramConfig={handleSaveTelegramConfig}
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
          />
        </motion.div>
      )}
    </div>
  );
};

export default SettingsTab;
