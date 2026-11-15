import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, X, Package, Loader2, Clock, Tag } from 'lucide-react';
import { Button } from './ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p || 0));

/**
 * Renders an admin offer on a product request + Accept/Reject buttons.
 * Usable in ContactPage ("Мои обращения") and OrdersPage.
 * Props: req (product request), onDone() called after a decision.
 */
export function ProductRequestOffer({ req, onDone }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const isOffered = req.status === 'offered';

  const accept = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/product-requests/${req.id}/accept`);
      toast.success('Предложение принято! Администратор оформит заказ.');
      onDone && onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/product-requests/${req.id}/reject`, { reason });
      toast.success('Предложение отклонено');
      onDone && onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка');
    } finally {
      setBusy(false);
      setRejecting(false);
    }
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 space-y-2" data-testid={`offer-card-${req.id}`}>
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-teal-500" />
        <p className="text-sm font-semibold text-slate-800">{req.product_name || req.article}</p>
        <span className="text-xs font-mono text-slate-400">{req.article}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {isOffered && req.offer_expires_at && (
          <span className="text-xs text-amber-600 font-medium" data-testid={`offer-expires-${req.id}`}>
            Действует до {new Date(req.offer_expires_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </span>
        )}
        {req.offer_price != null && (
          <span className="inline-flex items-center gap-1 text-teal-700 font-semibold" data-testid={`offer-price-${req.id}`}>
            <Tag className="w-3.5 h-3.5" />{fmt(req.offer_price)} ₽/шт
          </span>
        )}
        {req.offer_quantity != null && (
          <span className="text-slate-600">Кол-во: <b>{req.offer_quantity} шт</b></span>
        )}
        {req.offer_delivery_days != null && (
          <span className="inline-flex items-center gap-1 text-blue-600">
            <Clock className="w-3.5 h-3.5" />{req.offer_delivery_days} дн.
          </span>
        )}
        {req.offer_price != null && req.offer_quantity != null && (
          <span className="text-slate-700">Итого: <b>{fmt(req.offer_price * req.offer_quantity)} ₽</b></span>
        )}
      </div>
      {req.admin_response && <p className="text-xs text-slate-500 italic">«{req.admin_response}»</p>}

      {isOffered && (
        rejecting ? (
          <div className="space-y-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Причина отказа (необязательно)"
              rows={2}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-rose-400 resize-none"
              data-testid={`offer-reject-reason-${req.id}`}
            />
            <div className="flex gap-2">
              <Button onClick={reject} disabled={busy} variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50" data-testid={`offer-reject-confirm-${req.id}`}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <X className="w-4 h-4 mr-1" />}Отклонить
              </Button>
              <Button onClick={() => setRejecting(false)} disabled={busy} variant="ghost" className="text-slate-500">Отмена</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 pt-1">
            <Button onClick={accept} disabled={busy} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" data-testid={`offer-accept-${req.id}`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}Принять
            </Button>
            <Button onClick={() => setRejecting(true)} disabled={busy} variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50" data-testid={`offer-reject-${req.id}`}>
              <X className="w-4 h-4 mr-1" />Отклонить
            </Button>
          </div>
        )
      )}
    </div>
  );
}

export default ProductRequestOffer;
