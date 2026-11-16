import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { MapPin, ChevronDown, Clock, Phone, Map as MapIcon, Check } from 'lucide-react';
import { useRegion } from '../context/RegionContext';
import { useFeatures } from '../context/FeaturesContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WarehouseRow = ({ w }) => (
  <div className="px-3 py-2 rounded-xl bg-slate-50" data-testid={`region-warehouse-${w.id}`}>
    <p className="text-sm font-semibold text-slate-800">{w.name}</p>
    {w.address && <p className="text-xs text-slate-500 mt-0.5">{w.address}</p>}
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
      {w.hours && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{w.hours}</span>}
      {w.phone && <a href={`tel:${w.phone}`} className="flex items-center gap-1 hover:text-teal-600"><Phone className="w-3 h-3" />{w.phone}</a>}
    </div>
  </div>
);

// Region choice and warehouses of that region in one dropdown
export const RegionWarehouses = ({ onNavigate }) => {
  const { region, setRegion, regions } = useRegion();
  const { isOn } = useFeatures();
  const showWarehouses = isOn('warehouses_map');
  const [open, setOpen] = useState(false);
  const [warehouses, setWarehouses] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (!open || !showWarehouses) return;
    axios.get(`${API}/warehouses/public`).then((r) => setWarehouses(r.data || [])).catch(() => setWarehouses([]));
  }, [open, showWarehouses]);

  const hasRegions = regions && regions.length > 0;
  if (!hasRegions && !showWarehouses) return null;
  const list = (warehouses || []).filter((w) => !region || w.region === region);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-10 px-3 rounded-xl flex items-center gap-1.5 bg-white/95 border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600 transition-colors duration-200 text-sm font-medium max-w-[200px]"
        aria-expanded={open}
        title="Ваш регион и склады"
        data-testid="region-selector"
      >
        <MapPin className="w-4 h-4 text-teal-500 flex-shrink-0" />
        <span className="truncate">{region || 'Регион и склады'}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 max-h-[70vh] overflow-y-auto" data-testid="region-menu">
          {hasRegions && (
            <>
              <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Ваш регион</p>
              <div className="flex flex-wrap gap-1.5 px-1 pb-2">
                {regions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegion(r)}
                    className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-colors duration-200 ${region === r ? 'bg-teal-500 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700'}`}
                    data-testid={`region-option-${r}`}
                  >
                    {region === r && <Check className="w-3.5 h-3.5" />}{r}
                  </button>
                ))}
              </div>
            </>
          )}
          {showWarehouses && (
            <div className={hasRegions ? 'border-t border-slate-100 pt-2' : ''} data-testid="region-warehouses">
              <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">{region ? `Склады: ${region}` : 'Все склады'}</p>
              <div className="space-y-1.5">
                {warehouses === null && <p className="px-2 py-2 text-sm text-slate-400">Загрузка…</p>}
                {warehouses !== null && list.length === 0 && <p className="px-2 py-2 text-sm text-slate-400" data-testid="region-warehouses-empty">В этом регионе складов нет — товар привезём с другого склада.</p>}
                {list.map((w) => <WarehouseRow key={w.id} w={w} />)}
              </div>
              <Link
                to={region ? `/warehouses?region=${encodeURIComponent(region)}` : '/warehouses'}
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className="mt-2 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-teal-50 text-teal-700 text-sm font-semibold hover:bg-teal-100 transition-colors duration-200"
                data-testid="warehouses-map-link"
              >
                <MapIcon className="w-4 h-4" />Показать на карте
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
