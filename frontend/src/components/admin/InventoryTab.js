import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const diffCls = (d) => (d > 0 ? 'text-emerald-600' : d < 0 ? 'text-rose-600' : 'text-slate-400');
const signed = (d) => (d > 0 ? `+${d}` : `${d}`);

const InventoryDoc = ({ doc }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm" data-testid={`inventory-doc-${doc.id}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left p-3 flex items-center justify-between gap-3 flex-wrap" data-testid={`inventory-doc-toggle-${doc.id}`}>
        <div>
          <p className="font-medium text-slate-800 text-sm">{doc.number} · {doc.warehouse_name}</p>
          <p className="text-xs text-slate-400">{String(doc.created_at).slice(0, 16).replace('T', ' ')} · {doc.created_by}{doc.comment ? ` · ${doc.comment}` : ''}</p>
        </div>
        <p className="text-sm">
          <span className="text-slate-500">Позиций: {doc.positions}</span>
          <span className="ml-3 font-semibold text-emerald-600">+{doc.surplus}</span>
          <span className="ml-2 font-semibold text-rose-600">−{doc.shortage}</span>
        </p>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 py-2 text-sm">
          {doc.items.map((i) => (
            <div key={i.product_id} className="flex items-center justify-between gap-3 py-1">
              <span className="text-slate-700 truncate">{i.product_name} <span className="text-xs text-slate-400">{i.product_article}</span></span>
              <span className="whitespace-nowrap text-slate-500">{i.expected} → {i.actual} <b className={diffCls(i.diff)}>({signed(i.diff)})</b></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Stock count for one warehouse: type what is really on the shelf, differences are booked automatically
export const InventoryTab = ({ warehouses, items, onDone }) => {
  const [whId, setWhId] = useState('');
  const [actual, setActual] = useState({});
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState([]);

  const loadDocs = useCallback(() => axios.get(`${API}/admin/warehouse/inventory`).then((r) => setDocs(r.data || [])).catch(() => {}), []);
  useEffect(() => { loadDocs(); }, [loadDocs]);
  useEffect(() => { if (!whId && warehouses[0]) setWhId(warehouses[0].id); }, [warehouses, whId]);

  const rows = useMemo(() => items.map((p) => ({
    ...p, expected: p.warehouses?.find((w) => w.warehouse_id === whId)?.quantity || 0,
  })), [items, whId]);
  const counted = rows.filter((r) => actual[r.id] !== undefined && actual[r.id] !== '');
  const changed = counted.filter((r) => Number(actual[r.id]) !== r.expected).length;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await axios.post(`${API}/admin/warehouse/inventory`, {
        warehouse_id: whId, comment, items: counted.map((r) => ({ product_id: r.id, actual: Number(actual[r.id]) })),
      });
      toast.success(`Инвентаризация ${res.data.number} проведена: излишки +${res.data.surplus}, недостача −${res.data.shortage}`);
      setActual({}); setComment('');
      loadDocs(); onDone();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSaving(false); }
  };

  return (
    <div data-testid="inventory-tab">
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex items-end gap-3 flex-wrap mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Склад</label>
            <select value={whId} onChange={(e) => { setWhId(e.target.value); setActual({}); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" data-testid="inventory-warehouse">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} — {w.region}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Комментарий</label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: плановый пересчёт" className="rounded-xl" data-testid="inventory-comment" />
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">Введите фактическое количество только по тем товарам, которые пересчитали. Пустые строки не изменятся.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase">
              <tr><th className="text-left py-2 font-medium">Товар</th><th className="text-right py-2 font-medium">По учёту</th><th className="text-right py-2 font-medium w-32">Факт</th><th className="text-right py-2 font-medium w-24">Разница</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = actual[r.id];
                const diff = v === undefined || v === '' ? null : Number(v) - r.expected;
                return (
                  <tr key={r.id} className="border-t border-slate-100" data-testid={`inventory-row-${r.id}`}>
                    <td className="py-2"><p className="font-medium text-slate-800">{r.name}</p><p className="text-xs text-slate-400">{r.article}</p></td>
                    <td className="py-2 text-right font-semibold text-slate-700" data-testid={`inventory-expected-${r.id}`}>{r.expected}</td>
                    <td className="py-2 text-right"><Input type="number" min="0" value={v ?? ''} onChange={(e) => setActual((a) => ({ ...a, [r.id]: e.target.value }))} className="rounded-lg h-9 w-24 ml-auto text-right" data-testid={`inventory-actual-${r.id}`} /></td>
                    <td className={`py-2 text-right font-bold ${diff === null ? 'text-slate-300' : diffCls(diff)}`} data-testid={`inventory-diff-${r.id}`}>{diff === null ? '—' : signed(diff)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap mt-4">
          <p className="text-sm text-slate-500" data-testid="inventory-summary">Пересчитано: {counted.length} · с расхождением: {changed}</p>
          <Button onClick={submit} disabled={saving || counted.length === 0 || !whId} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl" data-testid="inventory-submit">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ClipboardCheck className="w-4 h-4 mr-2" />Провести инвентаризацию</>}
          </Button>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-slate-600 mb-2">Проведённые инвентаризации</h3>
      <div className="space-y-2">
        {docs.length === 0 ? <div className="bg-white rounded-2xl p-8 text-center text-slate-400 shadow-sm" data-testid="inventory-empty">Инвентаризаций пока не было</div>
          : docs.map((d) => <InventoryDoc key={d.id} doc={d} />)}
      </div>
    </div>
  );
};
