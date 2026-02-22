import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Save, CreditCard, Settings } from 'lucide-react';

export default function DiscountsTab({
  paymentSettings,
  setPaymentSettings,
  cryptoWallets,
  setCryptoWallets,
  handleSavePaymentSettings,
  handleSaveCryptoWallets
}) {
  return (
    <div className="p-6">
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Настройки оплаты</h2>
        
        {/* Payment methods and discounts */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-500" />
            Способы оплаты и скидки
          </h3>
          <p className="text-sm text-zinc-500">Включение/отключение способов оплаты и скидки за выбор способа оплаты</p>
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className={`p-4 rounded-lg border ${paymentSettings.cash_enabled !== false ? 'bg-zinc-50 border-zinc-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-bold uppercase text-zinc-500">Наличные</Label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" 
                    checked={paymentSettings.cash_enabled !== false}
                    onChange={(e) => setPaymentSettings({...paymentSettings, cash_enabled: e.target.checked})} />
                  <div className="w-9 h-5 bg-zinc-300 peer-checked:bg-green-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Скидка:</span>
                <Input type="number" min="0" max="100" value={paymentSettings.cash_discount || 0}
                  onChange={(e) => setPaymentSettings({...paymentSettings, cash_discount: parseFloat(e.target.value) || 0})}
                  className="w-20 h-8 text-sm" disabled={paymentSettings.cash_enabled === false} />
                <span className="text-zinc-500 text-sm">%</span>
              </div>
              {paymentSettings.cash_enabled === false && (
                <p className="text-xs text-red-500 mt-2">Временно недоступно</p>
              )}
            </div>
            
            <div className={`p-4 rounded-lg border ${paymentSettings.card_enabled !== false ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-bold uppercase text-blue-600">Карта (ЮKassa)</Label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" 
                    checked={paymentSettings.card_enabled !== false}
                    onChange={(e) => setPaymentSettings({...paymentSettings, card_enabled: e.target.checked})} />
                  <div className="w-9 h-5 bg-zinc-300 peer-checked:bg-green-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Скидка:</span>
                <Input type="number" min="0" max="100" value={paymentSettings.card_discount || 0}
                  onChange={(e) => setPaymentSettings({...paymentSettings, card_discount: parseFloat(e.target.value) || 0})}
                  className="w-20 h-8 text-sm" disabled={paymentSettings.card_enabled === false} />
                <span className="text-zinc-500 text-sm">%</span>
              </div>
              {paymentSettings.card_enabled === false && (
                <p className="text-xs text-red-500 mt-2">Временно недоступно</p>
              )}
            </div>
            
            <div className={`p-4 rounded-lg border ${paymentSettings.crypto_enabled !== false ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-bold uppercase text-amber-600">Криптовалюта</Label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" 
                    checked={paymentSettings.crypto_enabled !== false}
                    onChange={(e) => setPaymentSettings({...paymentSettings, crypto_enabled: e.target.checked})} />
                  <div className="w-9 h-5 bg-zinc-300 peer-checked:bg-green-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Скидка:</span>
                <Input type="number" min="0" max="100" value={paymentSettings.crypto_discount || 0}
                  onChange={(e) => setPaymentSettings({...paymentSettings, crypto_discount: parseFloat(e.target.value) || 0})}
                  className="w-20 h-8 text-sm" disabled={paymentSettings.crypto_enabled === false} />
                <span className="text-zinc-500 text-sm">%</span>
              </div>
              {paymentSettings.crypto_enabled === false && (
                <p className="text-xs text-red-500 mt-2">Временно недоступно</p>
              )}
            </div>
          </div>
          
          <Button onClick={handleSavePaymentSettings} className="bg-green-500 hover:bg-green-600 mt-4" data-testid="save-payment-settings-btn">
            <Save className="w-4 h-4 mr-2" /> Сохранить настройки оплаты
          </Button>
        </div>

        {/* Crypto wallet settings */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            Кошельки для крипто-оплаты
          </h3>
          <p className="text-sm text-zinc-500">Адреса кошельков для приёма криптовалюты</p>
          {['eth', 'bsc', 'base', 'trc'].map(chain => (
            <div key={chain} className="flex items-center gap-3">
              <Label className="w-16 text-xs font-bold uppercase text-zinc-500">{chain.toUpperCase()}</Label>
              <Input
                value={cryptoWallets?.[`${chain}_address`] || ''}
                onChange={(e) => setCryptoWallets(prev => ({...prev, [`${chain}_address`]: e.target.value}))}
                placeholder={`Адрес ${chain.toUpperCase()} кошелька`}
                className="flex-1 font-mono text-sm"
              />
            </div>
          ))}
          <Button onClick={handleSaveCryptoWallets} className="bg-amber-500 hover:bg-amber-600 mt-2" data-testid="save-crypto-wallets-btn">
            <Save className="w-4 h-4 mr-2" /> Сохранить кошельки
          </Button>
        </div>
      </div>
    </div>
  );
}
