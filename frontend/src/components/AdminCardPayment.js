import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CreditCard, CheckCircle, Loader2, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LABEL = {
  awaiting_requisites: 'Ожидает выдачи реквизитов',
  awaiting_payment: 'Ожидает оплаты клиентом',
  receipt_uploaded: 'Чек загружен — подтвердите',
  confirmed: 'Оплата подтверждена',
};

export default function AdminCardPayment({ order, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState({ card_number: '', recipient_name: '', bank: '', comment: '', qr_url: '' });
  const status = order.card_status;
  if (!status) return null;

  const issue = async () => {
    if (!req.card_number && !req.qr_url) { toast.error('Укажите номер карты или QR'); return; }
    setBusy(true);
    try { await axios.post(`${API}/orders/${order.id}/card/issue-requisites`, req); toast.success('Реквизиты выданы'); onUpdate && onUpdate(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true);
    try { await axios.post(`${API}/orders/${order.id}/card/confirm`); toast.success('Оплата подтверждена'); onUpdate && onUpdate(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3" data-testid={`admin-card-payment-${order.id}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-2">
        <CreditCard className="w-4 h-4" /> Оплата картой: {LABEL[status] || status}
        {order.card_amount ? <span className="text-slate-500 font-normal">· {new Intl.NumberFormat('ru-RU').format(Math.round(order.card_amount))} ₽</span> : null}
      </div>

      {status === 'awaiting_requisites' && (
        <div className="space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <Input value={req.card_number} onChange={e => setReq({ ...req, card_number: e.target.value })} placeholder="Номер карты" className="rounded-lg text-sm" data-testid={`issue-card-number-${order.id}`} />
            <Input value={req.recipient_name} onChange={e => setReq({ ...req, recipient_name: e.target.value })} placeholder="Получатель" className="rounded-lg text-sm" />
            <Input value={req.bank} onChange={e => setReq({ ...req, bank: e.target.value })} placeholder="Банк" className="rounded-lg text-sm" />
            <Input value={req.qr_url} onChange={e => setReq({ ...req, qr_url: e.target.value })} placeholder="Ссылка на QR (необяз.)" className="rounded-lg text-sm" />
          </div>
          <Button size="sm" onClick={issue} disabled={busy} className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg" data-testid={`issue-requisites-${order.id}`}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Выдать реквизиты
          </Button>
        </div>
      )}

      {status === 'receipt_uploaded' && (
        <div className="flex items-center gap-3 flex-wrap">
          {order.card_receipt_url && <a href={order.card_receipt_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline" data-testid={`view-receipt-${order.id}`}>Посмотреть чек</a>}
          <Button size="sm" onClick={confirm} disabled={busy} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg" data-testid={`confirm-card-${order.id}`}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />} Подтвердить оплату
          </Button>
        </div>
      )}

      {status === 'awaiting_payment' && <p className="text-xs text-slate-500">Реквизиты выданы. Ожидаем чек от клиента.</p>}
      {status === 'confirmed' && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Оплата получена</p>}
    </div>
  );
}
