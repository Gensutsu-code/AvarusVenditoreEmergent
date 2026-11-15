import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Plus, Pencil, Trash2, ArrowLeft, UserPlus, UserMinus, Search, Check, XCircle, Loader2, Inbox } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { PeriodSwitch, ManagerStatsView, ConditionsFields, toConditionsPayload, money } from '../components/staff/ManagerStats';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const err = (e, fallback = 'Ошибка') => { const d = e.response?.data?.detail; toast.error(typeof d === 'string' ? d : fallback); };
const emptyForm = { name: '', email: '', password: '', phone: '', position: '', note: '', commission_percent: '', blocked: false };

const ManagerForm = ({ form, setForm, onSave, saving }) => {
  const f = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  const lbl = 'block text-xs font-medium text-slate-500 mb-1';
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className={lbl}>ФИО *</label><Input {...f('name')} placeholder="Иван Петров" data-testid="staff-name-input" /></div>
        <div><label className={lbl}>Должность</label><Input {...f('position')} placeholder="Менеджер по продажам" data-testid="staff-position-input" /></div>
        <div><label className={lbl}>Телефон</label><Input {...f('phone')} placeholder="+7 900 000-00-00" data-testid="staff-phone-input" /></div>
        <div><label className={lbl}>Процент от прибыли, %</label><Input type="number" min="0" max="100" {...f('commission_percent')} placeholder="стандартный с сайта" data-testid="staff-commission-input" /></div>
      </div>
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 grid sm:grid-cols-2 gap-3">
        <p className="sm:col-span-2 text-xs font-bold uppercase text-teal-600">Данные для входа</p>
        <div><label className={lbl}>Email (логин) *</label><Input type="email" {...f('email')} placeholder="manager@company.ru" autoComplete="off" data-testid="staff-email-input" /></div>
        <div><label className={lbl}>{form.id ? 'Новый пароль (пусто — не менять)' : 'Пароль * (от 6 символов)'}</label><Input type="text" {...f('password')} autoComplete="new-password" data-testid="staff-password-input" /></div>
      </div>
      <div><label className={lbl}>Заметка</label><Input {...f('note')} maxLength={500} data-testid="staff-note-input" /></div>
      {form.id && (
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={!!form.blocked} onChange={(e) => setForm({ ...form, blocked: e.target.checked })} className="w-4 h-4 accent-rose-500" data-testid="staff-blocked-toggle" />
          Заблокировать вход
        </label>
      )}
      <Button onClick={onSave} disabled={saving} className="w-full bg-teal-500 hover:bg-teal-600 text-white" data-testid="staff-save-btn">{saving ? 'Сохранение…' : 'Сохранить'}</Button>
    </div>
  );
};

const ManagerDetail = ({ manager, period, setPeriod, onBack }) => {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [all, setAll] = useState([]);
  const [search, setSearch] = useState('');
  const [includePast, setIncludePast] = useState(false);

  const loadStats = useCallback(() => axios.get(`${API}/admin/staff/${manager.id}/stats`, { params: { period } }).then((r) => setStats(r.data)).catch(err), [manager.id, period]);
  const loadClients = useCallback(() => axios.get(`${API}/admin/staff/${manager.id}/clients`).then((r) => setClients(r.data)).catch(err), [manager.id]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadClients(); }, [loadClients]);
  useEffect(() => {
    const t = setTimeout(() => axios.get(`${API}/admin/staff-clients`, { params: { search } }).then((r) => setAll(r.data)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [search, clients.length]);

  const bind = async (c) => {
    if (c.manager_id && !window.confirm(`Клиент сейчас закреплён за менеджером «${c.manager_name}». Перевести к «${manager.name}»?`)) return;
    try {
      const r = await axios.post(`${API}/admin/staff/${manager.id}/clients`, { user_id: c.id, include_past_orders: includePast });
      toast.success(includePast ? `Клиент привязан, прошлых заказов засчитано: ${r.data.past_orders_added}` : 'Клиент привязан');
      loadClients(); loadStats();
    } catch (e) { err(e); }
  };
  const unbind = async (c) => {
    if (!window.confirm(`Отвязать клиента «${c.name}»? Уже засчитанные продажи останутся в статистике менеджера.`)) return;
    try { await axios.delete(`${API}/admin/staff/${manager.id}/clients/${c.id}`); toast.success('Клиент отвязан'); loadClients(); } catch (e) { err(e); }
  };
  const candidates = all.filter((c) => c.manager_id !== manager.id);

  return (
    <div data-testid="staff-detail">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Button variant="outline" onClick={onBack} data-testid="staff-back-btn"><ArrowLeft className="w-4 h-4 mr-1.5" />Все сотрудники</Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-800 truncate">{manager.name}</h2>
          <p className="text-xs text-slate-500">{manager.position || 'Менеджер'} · {manager.email}{manager.phone ? ` · ${manager.phone}` : ''}</p>
        </div>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </div>
      <ManagerStatsView stats={stats} />

      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid="staff-bound-clients">
          <p className="font-semibold text-slate-800 mb-2">Клиенты менеджера ({clients.length})</p>
          {clients.length === 0 && <p className="text-sm text-slate-400">Пока никто не привязан</p>}
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2" data-testid={`bound-client-${c.id}`}>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-800 truncate">{c.name}</p><p className="text-[11px] text-slate-400 truncate">{c.email} · {c.customer_status === 'wholesale' ? 'оптовый' : 'розничный'}</p></div>
                <Button size="sm" variant="outline" onClick={() => unbind(c)} className="border-rose-200 text-rose-600 hover:bg-rose-50" data-testid={`unbind-client-${c.id}`}><UserMinus className="w-4 h-4 mr-1" />Отвязать</Button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid="staff-bind-panel">
          <p className="font-semibold text-slate-800 mb-2">Привязать клиента</p>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Имя, email или телефон" className="pl-9" data-testid="bind-client-search" />
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-600 mb-2 cursor-pointer">
            <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} className="w-4 h-4 mt-0.5 accent-teal-500" data-testid="bind-include-past" />
            Засчитать менеджеру прошлые заказы клиента (без этого в статистику идут только заказы после привязки)
          </label>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {candidates.length === 0 && <p className="text-sm text-slate-400">Клиенты не найдены</p>}
            {candidates.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2" data-testid={`candidate-client-${c.id}`}>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-800 truncate">{c.name}</p><p className="text-[11px] text-slate-400 truncate">{c.email}{c.manager_name ? ` · у менеджера: ${c.manager_name}` : ''}</p></div>
                <Button size="sm" onClick={() => bind(c)} className="bg-teal-500 hover:bg-teal-600 text-white" data-testid={`bind-client-${c.id}`}><UserPlus className="w-4 h-4 mr-1" />Привязать</Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ConditionsRequests = () => {
  const [items, setItems] = useState(null);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => axios.get(`${API}/admin/conditions-requests`).then((r) => setItems(r.data)).catch(err), []);
  useEffect(() => { load(); }, [load]);
  const valueOf = (r) => edits[r.id] || { individual_discount: r.discount, delivery_cost: null, deferral_days: r.deferral_days, credit_limit: r.credit_limit };
  const decide = async (r, action) => {
    setBusy(true);
    try {
      await axios.put(`${API}/admin/conditions-requests/${r.id}`, { action, ...toConditionsPayload(valueOf(r)) });
      toast.success(action === 'approve' ? 'Одобрено: клиент стал оптовым' : 'Запрос отклонён');
      load();
    } catch (e) { err(e); } finally { setBusy(false); }
  };
  if (!items) return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-500" /></div>;
  if (!items.length) return <div className="py-16 text-center text-slate-400" data-testid="conditions-requests-empty"><Inbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />Запросов на индивидуальные условия пока нет</div>;
  return (
    <div className="space-y-3 max-w-3xl" data-testid="conditions-requests">
      {items.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4" data-testid={`conditions-request-${r.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="font-semibold text-slate-800">{r.user_name || r.user_email}</p><p className="text-xs text-slate-500">{r.user_email} · {new Date(r.created_at).toLocaleDateString('ru-RU')}</p></div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-amber-100 text-amber-700' : r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`} data-testid={`conditions-request-status-${r.id}`}>
              {r.status === 'pending' ? 'На рассмотрении' : r.status === 'approved' ? 'Одобрен' : 'Отклонён'}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-2">Просит: скидка {r.discount}% · отсрочка {r.deferral_days} дн. · лимит {money(r.credit_limit)}</p>
          {r.comment && <p className="text-sm italic text-slate-500 mt-1">«{r.comment}»</p>}
          {r.status === 'pending' && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs font-bold uppercase text-teal-600 mb-2">Условия, которые получит клиент</p>
              <ConditionsFields value={valueOf(r)} onChange={(v) => setEdits({ ...edits, [r.id]: v })} prefix={`req-${r.id}`} />
              <div className="flex gap-2 mt-3">
                <Button onClick={() => decide(r, 'approve')} disabled={busy} className="bg-emerald-500 hover:bg-emerald-600 text-white" data-testid={`conditions-approve-${r.id}`}><Check className="w-4 h-4 mr-1" />Одобрить и сделать оптовым</Button>
                <Button onClick={() => decide(r, 'reject')} disabled={busy} variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50" data-testid={`conditions-reject-${r.id}`}><XCircle className="w-4 h-4 mr-1" />Отклонить</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default function AdminStaffPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState('staff');
  const [period, setPeriod] = useState('month');
  const [staff, setStaff] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => axios.get(`${API}/admin/staff`, { params: { period } }).then((r) => setStaff(r.data)).catch(err), [period]);
  useEffect(() => { if (user?.role === 'admin') load(); }, [user, load]);

  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error('Укажите ФИО и email'); return; }
    if (!form.id && form.password.length < 6) { toast.error('Пароль должен быть не короче 6 символов'); return; }
    setSaving(true);
    const payload = { ...form, commission_percent: form.commission_percent === '' || form.commission_percent == null ? null : Number(form.commission_percent), password: form.password || null };
    try {
      if (form.id) await axios.put(`${API}/admin/staff/${form.id}`, payload);
      else await axios.post(`${API}/admin/staff`, payload);
      toast.success(form.id ? 'Данные сохранены' : 'Менеджер создан — передайте ему email и пароль');
      setForm(null); load();
    } catch (e) { err(e, 'Проверьте заполнение полей'); } finally { setSaving(false); }
  };
  const remove = async (m) => {
    if (!window.confirm(`Удалить менеджера «${m.name}»? Он не сможет войти, его клиенты будут отвязаны.`)) return;
    try { await axios.delete(`${API}/admin/staff/${m.id}`); toast.success('Менеджер удалён'); load(); } catch (e) { err(e); }
  };

  return (
    <div className="min-h-screen" data-testid="admin-staff-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selected ? (
          <ManagerDetail manager={selected} period={period} setPeriod={setPeriod} onBack={() => { setSelected(null); load(); }} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2 flex-1"><Users className="w-7 h-7 text-teal-500" />Сотрудники</h1>
              <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100">
                <button onClick={() => setTab('staff')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'staff' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`} data-testid="staff-tab-managers">Менеджеры</button>
                <button onClick={() => setTab('requests')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'requests' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`} data-testid="staff-tab-requests">Запросы условий</button>
              </div>
            </div>
            {tab === 'requests' ? <ConditionsRequests /> : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <PeriodSwitch value={period} onChange={setPeriod} />
                  <Button onClick={() => setForm({ ...emptyForm })} className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="staff-add-btn"><Plus className="w-4 h-4 mr-1.5" />Добавить менеджера</Button>
                </div>
                {!staff ? <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-500" /></div> : staff.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400" data-testid="staff-empty">Менеджеров пока нет. Добавьте первого.</div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto" data-testid="staff-list">
                    <table className="w-full min-w-[820px]">
                      <thead><tr className="text-[11px] uppercase text-slate-400 text-left">
                        <th className="px-4 py-2.5">Менеджер</th><th className="px-3 py-2.5 text-right">Клиентов</th><th className="px-3 py-2.5 text-right">Заказов</th>
                        <th className="px-3 py-2.5 text-right">Продано</th><th className="px-3 py-2.5 text-right">Прибыль</th><th className="px-3 py-2.5 text-right">Вознаграждение</th><th className="px-3 py-2.5" />
                      </tr></thead>
                      <tbody>{staff.map((m) => (
                        <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`staff-row-${m.id}`}>
                          <td className="px-4 py-3">
                            <button onClick={() => setSelected(m)} className="text-left" data-testid={`staff-open-${m.id}`}>
                              <span className="font-semibold text-slate-800 hover:text-teal-600">{m.name}</span>
                              {m.blocked && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-600">заблокирован</span>}
                              <span className="block text-[11px] text-slate-400">{m.position || 'Менеджер'} · {m.email}</span>
                            </button>
                          </td>
                          <td className="px-3 py-3 text-right text-sm">{m.clients_total}</td>
                          <td className="px-3 py-3 text-right text-sm">{m.stats.orders_count}</td>
                          <td className="px-3 py-3 text-right text-sm font-semibold" data-testid={`staff-revenue-${m.id}`}>{money(m.stats.revenue)}</td>
                          <td className="px-3 py-3 text-right text-sm font-semibold text-emerald-600" data-testid={`staff-profit-${m.id}`}>{money(m.stats.profit)}</td>
                          <td className="px-3 py-3 text-right text-sm text-teal-600">{money(m.stats.commission)} <span className="text-[11px] text-slate-400">({m.stats.commission_percent}%)</span></td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <button onClick={() => setForm({ ...emptyForm, ...m, password: '', commission_percent: m.commission_percent ?? '' })} className="p-2 text-slate-400 hover:text-teal-600" title="Редактировать" data-testid={`staff-edit-${m.id}`}><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => remove(m)} className="p-2 text-slate-400 hover:text-rose-500" title="Удалить" data-testid={`staff-delete-${m.id}`}><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="rounded-2xl max-h-[92vh] overflow-y-auto" data-testid="staff-modal">
          <DialogHeader><DialogTitle>{form?.id ? 'Редактировать менеджера' : 'Новый менеджер'}</DialogTitle></DialogHeader>
          {form && <ManagerForm form={form} setForm={setForm} onSave={save} saving={saving} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
