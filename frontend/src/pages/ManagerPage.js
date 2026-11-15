import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { BarChart3, Users, MessageCircle, Pencil, Send, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { PeriodSwitch, ManagerStatsView, ConditionsFields, toConditionsPayload, money } from '../components/staff/ManagerStats';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const err = (e) => { const d = e.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Ошибка'); };

const ClientsTab = () => {
  const [clients, setClients] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => axios.get(`${API}/manager/clients`).then((r) => setClients(r.data)).catch(err), []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}/manager/clients/${edit.id}/conditions`, toConditionsPayload(edit.value)); toast.success('Условия клиента сохранены'); setEdit(null); load(); }
    catch (e) { err(e); } finally { setSaving(false); }
  };
  if (!clients) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-500" /></div>;
  if (!clients.length) return <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400" data-testid="manager-clients-empty">За вами пока не закреплены клиенты. Клиентов привязывает администратор.</div>;
  return (
    <div className="grid md:grid-cols-2 gap-3" data-testid="manager-clients">
      {clients.map((c) => (
        <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4" data-testid={`manager-client-${c.id}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="font-semibold text-slate-800 truncate">{c.name}</p><p className="text-xs text-slate-500 truncate">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p></div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${c.customer_status === 'wholesale' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>{c.customer_status === 'wholesale' ? 'Оптовый' : 'Розничный'}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 mt-3">
            <span>Скидка: <b>{c.effective.discount}%</b>{c.effective.discount_individual ? ' (инд.)' : ''}</span>
            <span>Доставка: <b>{c.effective.delivery_cost == null ? 'как на сайте' : money(c.effective.delivery_cost)}</b></span>
            <span>Отсрочка: <b>{c.effective.deferral_days} дн.</b></span>
            <span>Лимит в долг: <b>{money(c.effective.credit_limit)}</b></span>
          </div>
          <Button size="sm" variant="outline" className="mt-3 border-teal-200 text-teal-700 hover:bg-teal-50" onClick={() => setEdit({ id: c.id, name: c.name, value: { individual_discount: c.individual_discount || 0, delivery_cost: c.delivery_cost ?? null, deferral_days: c.deferral_days || 0, credit_limit: c.credit_limit || 0 } })} data-testid={`manager-edit-conditions-${c.id}`}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Индивидуальные условия
          </Button>
        </div>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="rounded-2xl" data-testid="manager-conditions-modal">
          <DialogHeader><DialogTitle>Условия: {edit?.name}</DialogTitle></DialogHeader>
          {edit && (
            <>
              <p className="text-xs text-slate-500">Индивидуальные условия важнее стандартных условий статуса. Нули и пустая доставка — действуют стандартные.</p>
              <ConditionsFields value={edit.value} onChange={(v) => setEdit({ ...edit, value: v })} prefix="mgr" />
              <Button onClick={save} disabled={saving} className="w-full bg-teal-500 hover:bg-teal-600 text-white" data-testid="manager-conditions-save">{saving ? 'Сохранение…' : 'Сохранить'}</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ChatsTab = () => {
  const [chats, setChats] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef(null);
  const loadChats = useCallback(() => axios.get(`${API}/manager/chats`).then((r) => setChats(r.data)).catch(err), []);
  const loadMessages = useCallback((id) => axios.get(`${API}/manager/chats/${id}/messages`).then((r) => setMessages(r.data)).catch(() => {}), []);
  useEffect(() => { loadChats(); }, [loadChats]);
  useEffect(() => {
    if (!active) return undefined;
    loadMessages(active.id);
    const t = setInterval(() => loadMessages(active.id), 8000);
    return () => clearInterval(t);
  }, [active, loadMessages]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try { await axios.post(`${API}/manager/chats/${active.id}/send`, { text }); setText(''); await loadMessages(active.id); loadChats(); }
    catch (er) { err(er); } finally { setSending(false); }
  };
  if (!chats) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-500" /></div>;
  if (!chats.length) return <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400" data-testid="manager-chats-empty">Ваши клиенты пока не писали в чат</div>;
  return (
    <div className="grid md:grid-cols-3 gap-4" data-testid="manager-chats">
      <div className="space-y-1.5">
        {chats.map((c) => (
          <button key={c.id} onClick={() => setActive(c)} className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${active?.id === c.id ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-200'}`} data-testid={`manager-chat-${c.id}`}>
            <span className="flex items-center justify-between gap-2"><span className="font-medium text-sm text-slate-800 truncate">{c.user_name}</span>{c.unread > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">{c.unread}</span>}</span>
            <span className="block text-xs text-slate-400 truncate">{c.last_text}</span>
          </button>
        ))}
      </div>
      <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white flex flex-col h-[520px]">
        {!active ? <div className="m-auto text-slate-400 text-sm">Выберите чат</div> : (
          <>
            <p className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">{active.user_name}</p>
            <div className="flex-1 overflow-y-auto p-4 space-y-2" data-testid="manager-chat-messages">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_type === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.sender_type === 'user' ? 'bg-slate-100 text-slate-800' : 'bg-teal-500 text-white'}`}>{m.text}</div>
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <form onSubmit={send} className="flex gap-2 p-3 border-t border-slate-100">
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ответ клиенту…" maxLength={4000} data-testid="manager-chat-input" />
              <Button type="submit" disabled={sending || !text.trim()} className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="manager-chat-send"><Send className="w-4 h-4" /></Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default function ManagerPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState('stats');
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState(null);
  const isManager = user?.role === 'manager';
  useEffect(() => {
    if (isManager) axios.get(`${API}/manager/overview`, { params: { period } }).then((r) => setStats(r.data)).catch(err);
  }, [isManager, period]);

  if (loading) return null;
  if (!isManager) return <Navigate to="/" replace />;
  const tabs = [{ id: 'stats', label: 'Статистика', icon: BarChart3 }, { id: 'clients', label: 'Мои клиенты', icon: Users }, { id: 'chats', label: 'Чаты с клиентами', icon: MessageCircle }];

  return (
    <div className="min-h-screen" data-testid="manager-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Кабинет менеджера</h1>
        <p className="text-sm text-slate-500 mb-5">{user.name} · в статистику попадают заказы закреплённых за вами клиентов, кроме отменённых</p>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} data-testid={`manager-tab-${t.id}`}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>
          {tab === 'stats' && <PeriodSwitch value={period} onChange={setPeriod} />}
        </div>
        {tab === 'stats' && <ManagerStatsView stats={stats} />}
        {tab === 'clients' && <ClientsTab />}
        {tab === 'chats' && <ChatsTab />}
      </div>
    </div>
  );
}
