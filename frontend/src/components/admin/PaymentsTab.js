import { useState } from 'react';
import { CreditCard, Wallet, DollarSign, Percent } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { motion } from 'framer-motion';
import CryptoSettingsTab from './CryptoSettingsTab';
import CardPaymentSettings from './CardPaymentSettings';
import { BalanceTopups } from './BalanceTopups';

// Sub-tab component for Payments section
export const PaymentsTab = ({
  paymentSettings,
  setPaymentSettings,
  handleSavePaymentSettings,
  prepaymentSettings,
  setPrepaymentSettings,
  handleSavePrepaymentSettings,
  isDark = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState('methods');

  const subTabs = [
    { id: 'methods', label: 'Способы оплаты', icon: CreditCard },
    { id: 'prepayment', label: 'Предоплата', icon: DollarSign },
    { id: 'crypto', label: 'Крипто', icon: Wallet },
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

      {/* Payment Methods */}
      {activeSubTab === 'methods' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card payment */}
            <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'border border-zinc-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                    <CreditCard className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : ''}`}>Банковская карта</h3>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Перевод по реквизитам</p>
                  </div>
                </div>
                <Switch
                  checked={paymentSettings.card_enabled !== false}
                  onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, card_enabled: checked })}
                />
              </div>
              <div>
                <Label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Наценка/Скидка — меняется во вкладке «Скидки и акции»</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {(paymentSettings.card_adjustment || 0) > 0 ? '+' : ''}{paymentSettings.card_adjustment || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Cash payment */}
            <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'border border-zinc-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                    <DollarSign className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : ''}`}>Наличные</h3>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>При получении</p>
                  </div>
                </div>
                <Switch
                  checked={paymentSettings.cash_enabled !== false}
                  onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, cash_enabled: checked })}
                />
              </div>
              <div>
                <Label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Наценка/Скидка — меняется во вкладке «Скидки и акции»</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {(paymentSettings.cash_adjustment || 0) > 0 ? '+' : ''}{paymentSettings.cash_adjustment || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Crypto payment */}
            <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'border border-zinc-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
                    <Wallet className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : ''}`}>Криптовалюта</h3>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>USDT/USDC</p>
                  </div>
                </div>
                <Switch
                  checked={paymentSettings.crypto_enabled !== false}
                  onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, crypto_enabled: checked })}
                />
              </div>
              <div>
                <Label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Наценка/Скидка — меняется во вкладке «Скидки и акции»</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {(paymentSettings.crypto_adjustment || 0) > 0 ? '+' : ''}{paymentSettings.crypto_adjustment || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Balance payment */}
            <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'border border-zinc-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-teal-500/20' : 'bg-teal-100'}`}>
                    <Percent className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : ''}`}>Баланс</h3>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Предоплата</p>
                  </div>
                </div>
                <Switch
                  checked={paymentSettings.balance_enabled !== false}
                  onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, balance_enabled: checked })}
                />
              </div>
              <div>
                <Label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Наценка/Скидка — меняется во вкладке «Скидки и акции»</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {(paymentSettings.balance_adjustment || 0) > 0 ? '+' : ''}{paymentSettings.balance_adjustment || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Deferred card/crypto payment */}
          <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'border border-zinc-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : ''}`}>Отложенная оплата (карта/крипта)</h3>
                <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Разрешить оформлять заказ с оплатой позже; неоплаченный заказ отменяется по истечении срока</p>
              </div>
              <Switch
                checked={!!paymentSettings.deferred_payment_enabled}
                onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, deferred_payment_enabled: checked })}
                data-testid="deferred-payment-switch"
              />
            </div>
            {paymentSettings.deferred_payment_enabled && (
              <div>
                <Label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Срок оплаты (часов)</Label>
                <Input
                  type="number"
                  min="1"
                  value={paymentSettings.deferred_payment_hours || 24}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, deferred_payment_hours: parseInt(e.target.value) || 24 })}
                  className={`w-32 mt-1 ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}`}
                  data-testid="deferred-payment-hours"
                />
              </div>
            )}
          </div>

          <Button onClick={handleSavePaymentSettings} className={`${isDark ? 'bg-teal-500/90 hover:bg-teal-500' : 'bg-teal-500 hover:bg-teal-600'} text-white`}>
            Сохранить настройки оплаты
          </Button>

          <CardPaymentSettings />
        </motion.div>
      )}

      {/* Prepayment Settings */}
      {activeSubTab === 'prepayment' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className={`p-5 rounded-xl space-y-4 ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'border border-zinc-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : ''}`}>Система предоплаты</h3>
                <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Включить пополнение баланса</p>
              </div>
              <Switch
                checked={prepaymentSettings.prepayment_enabled !== false}
                onCheckedChange={(checked) => setPrepaymentSettings({ ...prepaymentSettings, prepayment_enabled: checked })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Мин. сумма пополнения (₽)</Label>
                <Input
                  type="number"
                  value={prepaymentSettings.min_topup_amount || 500}
                  onChange={(e) => setPrepaymentSettings({ ...prepaymentSettings, min_topup_amount: parseInt(e.target.value) || 500 })}
                  className={isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}
                />
              </div>
              <div>
                <Label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Макс. сумма пополнения (₽)</Label>
                <Input
                  type="number"
                  value={prepaymentSettings.max_topup_amount || 100000}
                  onChange={(e) => setPrepaymentSettings({ ...prepaymentSettings, max_topup_amount: parseInt(e.target.value) || 100000 })}
                  className={isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSavePrepaymentSettings} className={`${isDark ? 'bg-teal-500/90 hover:bg-teal-500' : 'bg-teal-500 hover:bg-teal-600'} text-white`}>
            Сохранить настройки предоплаты
          </Button>
          <BalanceTopups isDark={isDark} />
        </motion.div>
      )}

      {/* Crypto Settings */}
      {activeSubTab === 'crypto' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CryptoSettingsTab />
        </motion.div>
      )}
    </div>
  );
};

export default PaymentsTab;
