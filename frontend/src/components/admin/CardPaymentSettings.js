import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Save, CreditCard, QrCode, Upload, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CardPaymentSettings() {
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
    <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4 mt-6" data-testid="card-payment-settings">
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
