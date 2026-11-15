import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { BadgePercent, Phone } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const money = (n) => `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0))} ₽`;
const empty = { discount: '', deferral_days: '', credit_limit: '', comment: '' };

// Client: current status + conditions and a request for individual conditions (→ wholesale status)
export const MyConditionsCard = ({ isDark = false }) => {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => axios.get(`${API}/my-conditions`).then((r) => setData(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/conditions-requests`, { discount: Number(form.discount) || 0, deferral_days: parseInt(form.deferral_days, 10) || 0, credit_limit: Number(form.credit_limit) || 0, comment: form.comment });
      toast.success('Запрос отправлен. Мы сообщим о решении.');
      setOpen(false); setForm(empty); load();
    } catch (e) { const d = e.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Проверьте заполнение полей'); }
    finally { setBusy(false); }
  };
  const wholesale = data.customer_status === 'wholesale';
  const input = `mt-1 w-full h-10 px-3 rounded-md border text-sm focus:outline-none focus:border-teal-400 ${isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-slate-200 bg-white'}`;
  const row = (label, value, individual) => (
    <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}{individual && <span className="ml-1 text-[10px] font-bold text-teal-600">инд.</span>}</span></div>
  );

  return (
    <div className={`rounded-2xl border p-5 mb-6 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white/80 border-slate-200'}`} data-testid="my-conditions-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className={`font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}><BadgePercent className="w-5 h-5 text-teal-500" />Мои условия</p>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${wholesale ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'}`} data-testid="my-status-badge">{wholesale ? 'Оптовый клиент' : 'Розничный клиент'}</span>
      </div>
      <div className="space-y-1.5">
        {row('Скидка на все товары', `${data.discount}%`, data.discount_individual)}
        {row('Стоимость доставки', data.delivery_cost == null ? 'по общим правилам' : money(data.delivery_cost), data.delivery_individual)}
        {row('Отсрочка платежа', data.credit_limit > 0 ? `${data.deferral_days} дн.` : 'нет', data.credit_individual)}
        {row('Лимит отгрузки в долг', data.credit_limit > 0 ? money(data.credit_limit) : 'нет', data.credit_individual)}
      </div>
      {data.manager && (
        <p className="mt-3 text-sm text-slate-500 flex flex-wrap items-center gap-1.5" data-testid="my-manager"><Phone className="w-3.5 h-3.5 text-teal-500" />Ваш менеджер: <b className={isDark ? 'text-white' : 'text-slate-800'}>{data.manager.name}</b>{data.manager.phone && <a href={`tel:${data.manager.phone}`} className="text-teal-600">{data.manager.phone}</a>}</p>
      )}
      {data.pending_request ? (
        <p className="mt-4 text-sm rounded-xl bg-amber-50 text-amber-800 px-3 py-2" data-testid="conditions-request-pending">Ваш запрос на индивидуальные условия на рассмотрении.</p>
      ) : !open ? (
        <Button variant="outline" onClick={() => setOpen(true)} className="mt-4 border-teal-200 text-teal-700 hover:bg-teal-50" data-testid="conditions-request-open-btn">
          {wholesale ? 'Запросить другие условия' : 'Запросить индивидуальные условия (опт)'}
        </Button>
      ) : (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-3" data-testid="conditions-request-form">
          <p className="text-xs text-slate-500">Укажите желаемые условия. После одобрения вы получите статус оптового клиента.</p>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-[11px] font-semibold text-slate-500">Скидка, %<input type="number" min="0" max="90" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className={input} data-testid="conditions-request-discount" /></label>
            <label className="text-[11px] font-semibold text-slate-500">Отсрочка, дней<input type="number" min="0" max="365" value={form.deferral_days} onChange={(e) => setForm({ ...form, deferral_days: e.target.value })} className={input} data-testid="conditions-request-deferral" /></label>
            <label className="text-[11px] font-semibold text-slate-500">Лимит в долг, ₽<input type="number" min="0" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} className={input} data-testid="conditions-request-limit" /></label>
          </div>
          <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Расскажите о компании и объёмах закупок" rows={2} maxLength={1000} data-testid="conditions-request-comment" />
          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy} className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="conditions-request-submit">{busy ? 'Отправка…' : 'Отправить запрос'}</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyConditionsCard;
