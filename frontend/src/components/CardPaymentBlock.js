import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CreditCard, QrCode, Upload, Loader2, CheckCircle, Clock, Copy } from 'lucide-react';
import { Button } from './ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS = {
  awaiting_requisites: { label: 'Ожидайте реквизиты от администрации', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  awaiting_payment: { label: 'Ожидает оплаты', cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: CreditCard },
  receipt_uploaded: { label: 'Чек отправлен, ожидает подтверждения', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', Icon: Clock },
  confirmed: { label: 'Оплата подтверждена', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle },
};

export default function CardPaymentBlock({ order, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const status = order.card_status;
  if (!status) return null;
  const cfg = STATUS[status] || STATUS.awaiting_payment;
  const req = order.card_requisites || {};
  const { Icon } = cfg;

  const copy = (txt) => { navigator.clipboard?.writeText(txt); toast.success('Скопировано'); };

  const uploadReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = res.data.url || res.data.file_url || res.data.image_url;
      await axios.post(`${API}/orders/${order.id}/card/upload-receipt`, { receipt_url: url });
      toast.success('Чек загружен! Ожидайте подтверждения');
      onUpdate && onUpdate();
    } catch (err) { toast.error(err.response?.data?.detail || 'Ошибка загрузки чека'); } finally { setUploading(false); }
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4" data-testid={`card-payment-block-${order.id}`}>
      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls} mb-3`}>
        <Icon className="w-3.5 h-3.5" />{cfg.label}
      </div>
      {order.card_amount ? <p className="text-sm text-slate-600 mb-2">К оплате картой: <b className="text-slate-800">{new Intl.NumberFormat('ru-RU').format(Math.round(order.card_amount))} ₽</b></p> : null}

      {status === 'awaiting_payment' && (
        <>
          <div className="grid sm:grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5 text-sm">
              {req.card_number && <div className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border"><span className="font-mono font-semibold text-slate-800">{req.card_number}</span><button onClick={() => copy(req.card_number)} className="text-blue-500" data-testid="copy-card-number"><Copy className="w-4 h-4" /></button></div>}
              {req.recipient_name && <p className="text-slate-600">Получатель: <b>{req.recipient_name}</b></p>}
              {req.bank && <p className="text-slate-600">Банк: {req.bank}</p>}
              {req.comment && <p className="text-slate-500 text-xs">{req.comment}</p>}
            </div>
            {req.qr_url && (
              <div className="flex flex-col items-center">
                <img src={req.qr_url} alt="QR" className="w-32 h-32 rounded-lg border object-contain bg-white" data-testid="card-qr-img" />
                <span className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><QrCode className="w-3 h-3" /> QR для оплаты</span>
              </div>
            )}
          </div>
          <label className="mt-3 cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium" data-testid={`upload-receipt-${order.id}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Я оплатил — загрузить чек
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={uploadReceipt} />
          </label>
        </>
      )}

      {status === 'receipt_uploaded' && order.card_receipt_url && (
        <a href={order.card_receipt_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">Просмотреть загруженный чек</a>
      )}

      {status === 'awaiting_requisites' && (
        <p className="text-sm text-slate-500">Администрация скоро выдаст реквизиты для оплаты этого заказа.</p>
      )}
    </div>
  );
}
