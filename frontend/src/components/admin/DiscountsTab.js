import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Save, CreditCard, Settings, Wallet, QrCode, Upload, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function CardPaymentSettings() {
  const [cfg, setCfg] = useState({ mode: 'global', card_number: '', recipient_name: '', bank: '', comment: '', qr_url: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/card-payment-settings`).then(r => setCfg(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}/admin/card-payment-settings`, cfg); toast.success('Настройки оплаты картой сохранены'); }
    catch { toast.error('Ошибка сохранения'); } finally { setSaving(false); }
  };

  const uploadQr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = res.data.url || res.data.file_url || res.data.image_url;
      setCfg(prev => ({ ...prev, qr_url: url }));
      toast.success('QR-код загружен');
    } catch { toast.error('Ошибка загрузки QR'); } finally { setUploading(false); }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4" data-testid="card-payment-settings">
      <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-blue-500" />
        Ручная оплата на карту
      </h3>
      <p className="text-sm text-zinc-500">Реквизиты для перевода и режим выдачи. Клиент переводит, загружает чек, админ подтверждает.</p>

      <div>
        <Label className="text-xs font-bold uppercase text-zinc-500">Режим выдачи реквизитов</Label>
        <div className="mt-2 flex gap-2">
          {[{ id: 'global', label: 'Общие реквизиты' }, { id: 'per_order', label: 'Индивидуально на заказ' }].map(o => (
            <button key={o.id} type="button" onClick={() => setCfg({ ...cfg, mode: o.id })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${cfg.mode === o.id ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              data-testid={`card-mode-${o.id}`}>{o.label}</button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">{cfg.mode === 'global' ? 'Клиент сразу видит реквизиты ниже.' : 'Реквизиты выдаются вручную для каждого заказа в разделе Заказы.'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label className="text-xs font-bold uppercase text-zinc-500">Номер карты</Label><Input value={cfg.card_number || ''} onChange={e => setCfg({ ...cfg, card_number: e.target.value })} placeholder="2200 0000 0000 0000" className="mt-1 font-mono" data-testid="card-number-input" /></div>
        <div><Label className="text-xs font-bold uppercase text-zinc-500">Получатель</Label><Input value={cfg.recipient_name || ''} onChange={e => setCfg({ ...cfg, recipient_name: e.target.value })} placeholder="ФИО / организация" className="mt-1" data-testid="card-recipient-input" /></div>
        <div><Label className="text-xs font-bold uppercase text-zinc-500">Банк</Label><Input value={cfg.bank || ''} onChange={e => setCfg({ ...cfg, bank: e.target.value })} placeholder="Банк" className="mt-1" /></div>
        <div><Label className="text-xs font-bold uppercase text-zinc-500">Комментарий</Label><Input value={cfg.comment || ''} onChange={e => setCfg({ ...cfg, comment: e.target.value })} placeholder="Напр.: укажите № заказа" className="mt-1" /></div>
      </div>

      <div>
        <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-1"><QrCode className="w-4 h-4" /> QR-код для оплаты</Label>
        <div className="mt-2 flex items-center gap-3">
          {cfg.qr_url ? <img src={cfg.qr_url} alt="QR" className="w-20 h-20 rounded-lg border object-cover" data-testid="card-qr-preview" /> : <div className="w-20 h-20 rounded-lg border border-dashed flex items-center justify-center text-zinc-300"><QrCode className="w-8 h-8" /></div>}
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-sm" data-testid="card-qr-upload">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Загрузить QR
            <input type="file" accept="image/*" className="hidden" onChange={uploadQr} />
          </label>
          {cfg.qr_url && <button onClick={() => setCfg({ ...cfg, qr_url: '' })} className="text-xs text-rose-500">Убрать</button>}
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="bg-blue-500 hover:bg-blue-600" data-testid="save-card-payment-settings-btn">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Сохранить реквизиты
      </Button>
    </div>
  );
}

export default function DiscountsTab({
  paymentSettings,
  setPaymentSettings,
  cryptoWallets,
  setCryptoWallets,
  prepaymentSettings,
  setPrepaymentSettings,
  handleSavePaymentSettings,
  handleSaveCryptoWallets,
  handleSavePrepaymentSettings
}) {
  return (
    <div className="p-6">
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Настройки оплаты</h2>
        
        {/* Prepayment Settings */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-500" />
            Предоплата (Баланс)
          </h3>
          <p className="text-sm text-zinc-500">Настройка системы пополнения баланса и оплаты с баланса</p>
          
          <div className="flex items-center gap-4 p-3 bg-purple-50 rounded-lg">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" 
                checked={prepaymentSettings?.prepayment_enabled !== false}
                onChange={(e) => setPrepaymentSettings({...prepaymentSettings, prepayment_enabled: e.target.checked})} />
              <div className="w-11 h-6 bg-zinc-300 peer-checked:bg-purple-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
            <div>
              <p className="font-medium text-zinc-900">Система предоплаты включена</p>
              <p className="text-xs text-zinc-500">Пользователи могут пополнять баланс и оплачивать с него</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold uppercase text-zinc-500">Мин. сумма пополнения (₽)</Label>
              <Input 
                type="number" 
                min="0" 
                value={prepaymentSettings?.min_topup_amount || 500}
                onChange={(e) => setPrepaymentSettings({...prepaymentSettings, min_topup_amount: parseFloat(e.target.value) || 0})}
                className="mt-1"
                data-testid="min-topup-amount"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase text-zinc-500">Макс. сумма пополнения (₽)</Label>
              <Input 
                type="number" 
                min="0" 
                value={prepaymentSettings?.max_topup_amount || 100000}
                onChange={(e) => setPrepaymentSettings({...prepaymentSettings, max_topup_amount: parseFloat(e.target.value) || 0})}
                className="mt-1"
                data-testid="max-topup-amount"
              />
            </div>
          </div>
          
          <Button onClick={handleSavePrepaymentSettings} className="bg-purple-500 hover:bg-purple-600" data-testid="save-prepayment-settings-btn">
            <Save className="w-4 h-4 mr-2" /> Сохранить настройки предоплаты
          </Button>
        </div>
        
        {/* Payment methods and adjustments */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-500" />
            Способы оплаты и корректировки цены
          </h3>
          <p className="text-sm text-zinc-500">Включение/отключение способов оплаты. Отрицательное значение = скидка, положительное = наценка</p>
          
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
                <span className="text-xs text-zinc-500">Цена:</span>
                <Input type="number" min="-50" max="50" value={paymentSettings.cash_adjustment ?? -15}
                  onChange={(e) => setPaymentSettings({...paymentSettings, cash_adjustment: parseFloat(e.target.value) || 0})}
                  className="w-20 h-8 text-sm" disabled={paymentSettings.cash_enabled === false} />
                <span className="text-zinc-500 text-sm">%</span>
              </div>
              <p className={`text-xs mt-1 ${(paymentSettings.cash_adjustment ?? -15) < 0 ? 'text-green-600' : (paymentSettings.cash_adjustment ?? -15) > 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                {(paymentSettings.cash_adjustment ?? -15) < 0 ? `Скидка ${Math.abs(paymentSettings.cash_adjustment ?? -15)}%` : 
                 (paymentSettings.cash_adjustment ?? -15) > 0 ? `Наценка +${paymentSettings.cash_adjustment}%` : 'Без изменений'}
              </p>
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
                <span className="text-xs text-zinc-500">Цена:</span>
                <Input type="number" min="-50" max="50" value={paymentSettings.card_adjustment ?? 0}
                  onChange={(e) => setPaymentSettings({...paymentSettings, card_adjustment: parseFloat(e.target.value) || 0})}
                  className="w-20 h-8 text-sm" disabled={paymentSettings.card_enabled === false} />
                <span className="text-zinc-500 text-sm">%</span>
              </div>
              <p className={`text-xs mt-1 ${(paymentSettings.card_adjustment ?? 0) < 0 ? 'text-green-600' : (paymentSettings.card_adjustment ?? 0) > 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                {(paymentSettings.card_adjustment ?? 0) < 0 ? `Скидка ${Math.abs(paymentSettings.card_adjustment ?? 0)}%` : 
                 (paymentSettings.card_adjustment ?? 0) > 0 ? `Наценка +${paymentSettings.card_adjustment}%` : 'Без изменений'}
              </p>
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
                <span className="text-xs text-zinc-500">Цена:</span>
                <Input type="number" min="-50" max="50" value={paymentSettings.crypto_adjustment ?? -20}
                  onChange={(e) => setPaymentSettings({...paymentSettings, crypto_adjustment: parseFloat(e.target.value) || 0})}
                  className="w-20 h-8 text-sm" disabled={paymentSettings.crypto_enabled === false} />
                <span className="text-zinc-500 text-sm">%</span>
              </div>
              <p className={`text-xs mt-1 ${(paymentSettings.crypto_adjustment ?? -20) < 0 ? 'text-green-600' : (paymentSettings.crypto_adjustment ?? -20) > 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                {(paymentSettings.crypto_adjustment ?? -20) < 0 ? `Скидка ${Math.abs(paymentSettings.crypto_adjustment ?? -20)}%` : 
                 (paymentSettings.crypto_adjustment ?? -20) > 0 ? `Наценка +${paymentSettings.crypto_adjustment}%` : 'Без изменений'}
              </p>
              {paymentSettings.crypto_enabled === false && (
                <p className="text-xs text-red-500 mt-2">Временно недоступно</p>
              )}
            </div>

            {/* Balance payment */}
            <div className={`p-4 rounded-lg border ${paymentSettings.balance_enabled !== false ? 'bg-purple-50 border-purple-100' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-bold uppercase text-purple-600">Баланс</Label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" 
                    checked={paymentSettings.balance_enabled !== false}
                    onChange={(e) => setPaymentSettings({...paymentSettings, balance_enabled: e.target.checked})} />
                  <div className="w-9 h-5 bg-zinc-300 peer-checked:bg-green-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Цена:</span>
                <Input type="number" min="-50" max="50" value={paymentSettings.balance_adjustment ?? 0}
                  onChange={(e) => setPaymentSettings({...paymentSettings, balance_adjustment: parseFloat(e.target.value) || 0})}
                  className="w-20 h-8 text-sm" disabled={paymentSettings.balance_enabled === false} />
                <span className="text-zinc-500 text-sm">%</span>
              </div>
              <p className={`text-xs mt-1 ${(paymentSettings.balance_adjustment ?? 0) < 0 ? 'text-green-600' : (paymentSettings.balance_adjustment ?? 0) > 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                {(paymentSettings.balance_adjustment ?? 0) < 0 ? `Скидка ${Math.abs(paymentSettings.balance_adjustment ?? 0)}%` : 
                 (paymentSettings.balance_adjustment ?? 0) > 0 ? `Наценка +${paymentSettings.balance_adjustment}%` : 'Без изменений'}
              </p>
              {paymentSettings.balance_enabled === false && (
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

        <CardPaymentSettings />
      </div>
    </div>
  );
}
