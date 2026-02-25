import { useState } from 'react';
import { CreditCard, Wallet, Percent, DollarSign } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// Sub-tab component for Payments section
export const PaymentsTab = ({
  paymentSettings,
  setPaymentSettings,
  handleSavePaymentSettings,
  prepaymentSettings,
  setPrepaymentSettings,
  handleSavePrepaymentSettings,
  cryptoWallets,
  setCryptoWallets,
  handleSaveCryptoWallets,
  isDark = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState('methods');

  const subTabs = [
    { id: 'methods', label: 'Способы оплаты', icon: CreditCard },
    { id: 'prepayment', label: 'Предоплата', icon: DollarSign },
    { id: 'crypto', label: 'Криптовалюта', icon: Wallet },
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

      {/* Payment Methods */}
      {activeSubTab === 'methods' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card payment */}
            <div className="p-5 border border-zinc-200 rounded-xl bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Банковская карта</h3>
                    <p className="text-xs text-zinc-500">ЮKassa</p>
                  </div>
                </div>
                <Switch
                  checked={paymentSettings.card_enabled !== false}
                  onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, card_enabled: checked })}
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Наценка/Скидка (%)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={paymentSettings.card_adjustment || 0}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, card_adjustment: parseFloat(e.target.value) || 0 })}
                    className="w-24"
                  />
                  <span className="text-sm text-zinc-500">
                    {(paymentSettings.card_adjustment || 0) > 0 ? '+' : ''}{paymentSettings.card_adjustment || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Cash payment */}
            <div className="p-5 border border-zinc-200 rounded-xl bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Наличные</h3>
                    <p className="text-xs text-zinc-500">При получении</p>
                  </div>
                </div>
                <Switch
                  checked={paymentSettings.cash_enabled !== false}
                  onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, cash_enabled: checked })}
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Наценка/Скидка (%)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={paymentSettings.cash_adjustment || 0}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, cash_adjustment: parseFloat(e.target.value) || 0 })}
                    className="w-24"
                  />
                  <span className="text-sm text-zinc-500">
                    {(paymentSettings.cash_adjustment || 0) > 0 ? '+' : ''}{paymentSettings.cash_adjustment || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Crypto payment */}
            <div className="p-5 border border-zinc-200 rounded-xl bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Криптовалюта</h3>
                    <p className="text-xs text-zinc-500">USDT/USDC</p>
                  </div>
                </div>
                <Switch
                  checked={paymentSettings.crypto_enabled !== false}
                  onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, crypto_enabled: checked })}
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Наценка/Скидка (%)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={paymentSettings.crypto_adjustment || 0}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, crypto_adjustment: parseFloat(e.target.value) || 0 })}
                    className="w-24"
                  />
                  <span className="text-sm text-zinc-500">
                    {(paymentSettings.crypto_adjustment || 0) > 0 ? '+' : ''}{paymentSettings.crypto_adjustment || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Balance payment */}
            <div className="p-5 border border-zinc-200 rounded-xl bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Percent className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Баланс</h3>
                    <p className="text-xs text-zinc-500">Предоплата</p>
                  </div>
                </div>
                <Switch
                  checked={paymentSettings.balance_enabled !== false}
                  onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, balance_enabled: checked })}
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Наценка/Скидка (%)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={paymentSettings.balance_adjustment || 0}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, balance_adjustment: parseFloat(e.target.value) || 0 })}
                    className="w-24"
                  />
                  <span className="text-sm text-zinc-500">
                    {(paymentSettings.balance_adjustment || 0) > 0 ? '+' : ''}{paymentSettings.balance_adjustment || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleSavePaymentSettings} className="bg-orange-500 hover:bg-orange-600 text-white">
            Сохранить настройки оплаты
          </Button>
        </motion.div>
      )}

      {/* Prepayment Settings */}
      {activeSubTab === 'prepayment' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="p-5 border border-zinc-200 rounded-xl bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Система предоплаты</h3>
                <p className="text-sm text-zinc-500">Включить пополнение баланса</p>
              </div>
              <Switch
                checked={prepaymentSettings.prepayment_enabled !== false}
                onCheckedChange={(checked) => setPrepaymentSettings({ ...prepaymentSettings, prepayment_enabled: checked })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-zinc-500">Мин. сумма пополнения (₽)</Label>
                <Input
                  type="number"
                  value={prepaymentSettings.min_topup_amount || 500}
                  onChange={(e) => setPrepaymentSettings({ ...prepaymentSettings, min_topup_amount: parseInt(e.target.value) || 500 })}
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Макс. сумма пополнения (₽)</Label>
                <Input
                  type="number"
                  value={prepaymentSettings.max_topup_amount || 100000}
                  onChange={(e) => setPrepaymentSettings({ ...prepaymentSettings, max_topup_amount: parseInt(e.target.value) || 100000 })}
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSavePrepaymentSettings} className="bg-orange-500 hover:bg-orange-600 text-white">
            Сохранить настройки предоплаты
          </Button>
        </motion.div>
      )}

      {/* Crypto Wallets */}
      {activeSubTab === 'crypto' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="p-5 border border-zinc-200 rounded-xl bg-white space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-500" />
              Кошельки для приёма криптовалюты
            </h3>
            
            <div className="grid gap-4">
              <div>
                <Label className="text-xs text-zinc-500">ETH/ERC-20 (Ethereum)</Label>
                <Input
                  value={cryptoWallets.eth_address || ''}
                  onChange={(e) => setCryptoWallets({ ...cryptoWallets, eth_address: e.target.value })}
                  placeholder="0x..."
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">BSC/BEP-20 (Binance Smart Chain)</Label>
                <Input
                  value={cryptoWallets.bsc_address || ''}
                  onChange={(e) => setCryptoWallets({ ...cryptoWallets, bsc_address: e.target.value })}
                  placeholder="0x..."
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Base</Label>
                <Input
                  value={cryptoWallets.base_address || ''}
                  onChange={(e) => setCryptoWallets({ ...cryptoWallets, base_address: e.target.value })}
                  placeholder="0x..."
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">TRC-20 (Tron)</Label>
                <Input
                  value={cryptoWallets.trc_address || ''}
                  onChange={(e) => setCryptoWallets({ ...cryptoWallets, trc_address: e.target.value })}
                  placeholder="T..."
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSaveCryptoWallets} className="bg-orange-500 hover:bg-orange-600 text-white">
            Сохранить кошельки
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default PaymentsTab;
