import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FIELDS = [
  { key: 'seller_name', label: 'Получатель (продавец)' },
  { key: 'bank_name', label: 'Банк получателя' },
  { key: 'bik', label: 'БИК' },
  { key: 'corr_account', label: 'Корр. счёт (Сч. №)' },
  { key: 'inn', label: 'ИНН' },
  { key: 'kpp', label: 'КПП' },
  { key: 'account', label: 'Расчётный счёт (Сч. №)' },
];

const InvoiceSettings = ({ isDark }) => {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/invoice-settings`).then(r => setCfg(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/invoice-settings`, cfg);
      toast.success('Реквизиты счёта сохранены');
    } catch (e) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) return null;
  const cardCls = isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200';
  const inputCls = isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : '';

  return (
    <div className="space-y-5" data-testid="invoice-settings">
      <div className={`rounded-xl border p-5 ${cardCls}`}>
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet className="w-5 h-5 text-teal-500" />
          <h3 className={`font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Реквизиты для счёта (Word)</h3>
        </div>
        <p className={`text-sm mb-4 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
          Используются при выгрузке счёта из карточки заказа.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <div key={f.key} className={f.key === 'seller_name' || f.key === 'bank_name' ? 'sm:col-span-2' : ''}>
              <Label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{f.label}</Label>
              <Input
                value={cfg[f.key] || ''}
                onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })}
                className={`mt-1 ${inputCls}`}
                data-testid={`invoice-${f.key}`}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Примечание (нижний колонтитул)</Label>
            <Textarea
              value={cfg.footer_note || ''}
              onChange={(e) => setCfg({ ...cfg, footer_note: e.target.value })}
              className={`mt-1 ${inputCls}`}
              rows={2}
              data-testid="invoice-footer_note"
            />
          </div>
        </div>
        <div className="mt-5">
          <Button onClick={save} disabled={saving} className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="invoice-settings-save">
            {saving ? 'Сохранение...' : 'Сохранить реквизиты'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceSettings;
