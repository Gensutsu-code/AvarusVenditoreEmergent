import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, CalendarClock } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const err = (e) => { const d = e.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Проверьте заполнение полей'); };
const empty = { text: '', due_date: '', client_id: '' };
const sel = 'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:border-teal-400';

// Manager's own to-do list: call back, send an invoice... optionally tied to a client and a date
export const ManagerTasksTab = ({ clients, onChanged }) => {
  const [tasks, setTasks] = useState(null);
  const [form, setForm] = useState(empty);

  const load = useCallback(() => axios.get(`${API}/manager/tasks`).then((r) => { setTasks(r.data); onChanged?.(r.data); }).catch(err), [onChanged]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.text.trim()) { toast.error('Напишите, что нужно сделать'); return; }
    try { await axios.post(`${API}/manager/tasks`, { ...form, due_date: form.due_date || null, client_id: form.client_id || null }); setForm(empty); load(); } catch (e2) { err(e2); }
  };
  const toggle = (t) => axios.put(`${API}/manager/tasks/${t.id}`, { text: t.text, due_date: t.due_date, client_id: t.client_id, done: !t.done }).then(load).catch(err);
  const remove = (t) => axios.delete(`${API}/manager/tasks/${t.id}`).then(load).catch(err);

  return (
    <div data-testid="manager-tasks">
      <form onSubmit={create} className="flex flex-wrap gap-2 mb-4 rounded-xl border border-slate-200 bg-white p-3">
        <Input value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Что сделать: перезвонить, выставить счёт…" maxLength={500} className="flex-1 min-w-[220px]" data-testid="manager-task-text" />
        <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className={sel} data-testid="manager-task-client">
          <option value="">Без клиента</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-40" data-testid="manager-task-date" />
        <Button type="submit" className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="manager-task-add"><Plus className="w-4 h-4 mr-1" />Добавить</Button>
      </form>
      {tasks && tasks.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400" data-testid="manager-tasks-empty">Задач пока нет</div>}
      {tasks && tasks.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3" data-testid={`manager-task-${t.id}`}>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)} className="w-4 h-4 accent-teal-500" data-testid={`manager-task-done-${t.id}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${t.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.text}</p>
                {t.client_name && <p className="text-xs text-slate-400">{t.client_name}</p>}
              </div>
              {t.due_date && <span className={`text-xs flex items-center gap-1 whitespace-nowrap ${t.overdue ? 'font-bold text-rose-600' : 'text-slate-500'}`} data-testid={`manager-task-due-${t.id}`}><CalendarClock className="w-3.5 h-3.5" />{t.due_date.split('-').reverse().join('.')}{t.overdue ? ' · просрочено' : ''}</span>}
              <button type="button" onClick={() => remove(t)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors duration-200" title="Удалить" data-testid={`manager-task-delete-${t.id}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
