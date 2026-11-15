import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Package, FolderTree, Warehouse, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TYPES = {
  product: { label: 'Товар', icon: Package },
  category: { label: 'Группа товаров', icon: FolderTree },
  warehouse: { label: 'Склад', icon: Warehouse },
  manufacturer: { label: 'Бренд', icon: Tag },
};
const selectCls = 'h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800';

const ProductPicker = ({ value, onPick, testid }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => {
      axios.get(`${API}/products/search`, { params: { q, limit: 8 } }).then((r) => setResults(r.data.products || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <button type="button" onClick={() => onPick(null)} className="h-9 px-3 rounded-xl bg-slate-100 text-sm text-slate-800 truncate text-left" title="Нажмите, чтобы выбрать другой товар" data-testid={`${testid}-selected`}>
        {value.name}
      </button>
    );
  }
  return (
    <div className="relative">
      <Input placeholder="Название или артикул" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl h-9" data-testid={`${testid}-search`} />
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-auto">
          {results.map((p) => (
            <button key={p.id} type="button" onClick={() => { onPick({ id: p.id, name: `${p.name} (${p.article || '—'})` }); setQ(''); setResults([]); }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50" data-testid={`${testid}-result-${p.id}`}>
              {p.name} <span className="text-slate-400">{p.article}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const RewardRulesEditor = ({ systemKey: k, rules, targets, rateLabel, onChange }) => {
  const [type, setType] = useState('product');
  const [target, setTarget] = useState(null);
  const [percent, setPercent] = useState('');
  const list = { category: targets.categories, warehouse: targets.warehouses, manufacturer: targets.manufacturers }[type] || [];

  const add = () => {
    if (!target) { toast.error('Выберите, к чему применить ставку'); return; }
    if (percent === '' || Number(percent) < 0) { toast.error('Укажите ставку'); return; }
    if (rules.some((r) => r.type === type && r.target_id === target.id)) { toast.error('Такое правило уже есть'); return; }
    onChange([...rules, { id: `${type}-${target.id}`, type, target_id: target.id, target_name: target.name, percent: Number(percent) }]);
    setTarget(null); setPercent('');
  };

  return (
    <div data-testid={`reward-${k}-rules`}>
      <h3 className="text-sm font-bold text-slate-800">Особые ставки</h3>
      <p className="text-xs text-slate-500 mb-3">Пониженные — для отдельных товаров, групп и складов: из подходящих применяется самая низкая. Ставка бренда может быть и повышенной — она заменяет базовую и главнее остальных правил. 0% = не начислять.</p>

      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_130px_auto] gap-2 items-center p-3 rounded-xl bg-slate-50 border border-slate-200">
        <select value={type} onChange={(e) => { setType(e.target.value); setTarget(null); }} className={selectCls} data-testid={`reward-${k}-rule-type`}>
          {Object.entries(TYPES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
        </select>
        {type === 'product' ? (
          <ProductPicker value={target} onPick={setTarget} testid={`reward-${k}-rule-product`} />
        ) : (
          <select value={target?.id || ''} onChange={(e) => { const x = list.find((i) => i.id === e.target.value); setTarget(x ? { id: x.id, name: x.name } : null); }} className={selectCls} data-testid={`reward-${k}-rule-target`}>
            <option value="">— выберите —</option>
            {list.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )}
        <Input type="number" min="0" step="0.1" placeholder={rateLabel} value={percent} onChange={(e) => setPercent(e.target.value)} className="rounded-xl h-9" data-testid={`reward-${k}-rule-percent`} />
        <Button type="button" size="sm" className="rounded-xl bg-slate-900 hover:bg-teal-600 text-white" onClick={add} data-testid={`reward-${k}-rule-add`}>
          <Plus className="w-4 h-4 mr-1" />Добавить
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-slate-400 mt-3" data-testid={`reward-${k}-rules-empty`}>Правил пока нет — ко всем товарам применяется базовая ставка.</p>
      ) : (
        <div className="mt-3 border border-slate-200 rounded-xl divide-y divide-slate-100">
          {rules.map((r) => {
            const Icon = TYPES[r.type].icon;
            return (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2" data-testid={`reward-${k}-rule-${r.id}`}>
                <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-400 w-28 flex-shrink-0">{TYPES[r.type].label}</span>
                <span className="text-sm text-slate-800 flex-1 truncate">{r.target_name}</span>
                <Input type="number" min="0" step="0.1" value={r.percent}
                  onChange={(e) => onChange(rules.map((x) => (x.id === r.id ? { ...x, percent: e.target.value === '' ? '' : Number(e.target.value) } : x)))}
                  className="rounded-xl h-8 w-24" data-testid={`reward-${k}-rule-${r.id}-percent`} />
                <span className="text-sm text-slate-400">%</span>
                <Button type="button" variant="ghost" size="icon" className="text-rose-500 h-8 w-8" onClick={() => onChange(rules.filter((x) => x.id !== r.id))} data-testid={`reward-${k}-rule-${r.id}-delete`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
