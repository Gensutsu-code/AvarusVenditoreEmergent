import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { MapPin, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Единый справочник регионов: склады выбирают регион только из этого списка
export const RegionsPanel = ({ regions, reload }) => {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [busy, setBusy] = useState(false);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); await reload(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); }
    finally { setBusy(false); }
  };

  const add = () => {
    if (!name.trim()) { toast.error('Введите название региона'); return; }
    run(async () => { await axios.post(`${API}/admin/regions`, { name }); setName(''); }, 'Регион добавлен');
  };
  const rename = () => {
    if (!editing?.name?.trim()) { toast.error('Введите название региона'); return; }
    run(async () => { await axios.put(`${API}/admin/regions/${editing.id}`, { name: editing.name }); setEditing(null); }, 'Регион переименован');
  };
  const remove = (r) => {
    if (!window.confirm(`Удалить регион «${r.name}» из справочника?`)) return;
    run(() => axios.delete(`${API}/admin/regions/${r.id}`), 'Регион удалён');
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm mb-4" data-testid="regions-panel">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="font-semibold text-slate-800 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-teal-500" />Справочник регионов</p>
          <p className="text-xs text-slate-500">Регион склада выбирается только из этого списка. При переименовании регион обновится у всех складов и клиентов.</p>
        </div>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Новый регион" className="rounded-xl h-9 w-48" maxLength={60} data-testid="region-new-input" />
          <Button onClick={add} disabled={busy} className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-9" data-testid="region-add-btn"><Plus className="w-4 h-4 mr-1" />Добавить</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" data-testid="regions-list">
        {regions.length === 0 && <p className="text-sm text-slate-400">Регионов пока нет. Добавьте первый регион.</p>}
        {regions.map((r) => (editing?.id === r.id ? (
          <div key={r.id} className="flex items-center gap-1 rounded-xl border border-teal-300 bg-teal-50 px-2 py-1">
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && rename()} className="h-7 w-40 text-sm" maxLength={60} autoFocus data-testid="region-rename-input" />
            <button onClick={rename} disabled={busy} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded" data-testid="region-rename-save"><Check className="w-4 h-4" /></button>
            <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded" data-testid="region-rename-cancel"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div key={r.id} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-1.5 py-1 text-sm" data-testid={`region-chip-${r.id}`}>
            <span className="font-medium text-slate-700">{r.name}</span>
            <span className="text-[11px] text-slate-400">складов: {r.warehouses_count}</span>
            <button onClick={() => setEditing({ id: r.id, name: r.name })} className="p-1 text-slate-400 hover:text-teal-600" title="Переименовать" data-testid={`region-edit-${r.id}`}><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => remove(r)} disabled={busy} className="p-1 text-slate-400 hover:text-rose-500" title="Удалить" data-testid={`region-delete-${r.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )))}
      </div>
    </div>
  );
};

export default RegionsPanel;
