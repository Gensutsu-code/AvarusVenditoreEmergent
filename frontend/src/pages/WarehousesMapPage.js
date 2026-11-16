import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { MapPin, Clock, Phone, Navigation, Warehouse } from 'lucide-react';
import { WarehouseMap, hasCoords } from '../components/WarehouseMap';
import { useRegion } from '../context/RegionContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function WarehousesMapPage() {
  const { region, setRegion } = useRegion();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(() => new URLSearchParams(window.location.search).get('region') || '');
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    axios.get(`${API}/warehouses/public`)
      .then((r) => setWarehouses(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const regions = useMemo(() => [...new Set(warehouses.map((w) => w.region).filter(Boolean))].sort(), [warehouses]);
  const visible = filter ? warehouses.filter((w) => w.region === filter) : warehouses;

  const pickFilter = (r) => { setFilter(r); setActiveId(null); };

  return (
    <div className="min-h-screen" data-testid="warehouses-map-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Склады и пункты выдачи</h1>
          <p className="text-sm text-slate-500 mt-1">
            Выберите регион, чтобы увидеть ближайшие склады. Товар со склада в вашем регионе доставляется быстрее всего.
            {region && <> Ваш регион: <b className="text-teal-600" data-testid="map-current-region">{region}</b>.</>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-5" data-testid="map-region-filter">
          <button onClick={() => pickFilter('')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!filter ? 'bg-teal-500 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300'}`} data-testid="map-region-all">
            Все регионы ({warehouses.length})
          </button>
          {regions.map((r) => (
            <button key={r} onClick={() => pickFilter(r)} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === r ? 'bg-teal-500 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300'}`} data-testid={`map-region-${r}`}>
              {r} ({warehouses.filter((w) => w.region === r).length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center"><div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto" /></div>
        ) : warehouses.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-400" data-testid="map-empty">
            <Warehouse className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            Склады пока не добавлены
          </div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-5">
            <div className="lg:col-span-2 space-y-3 lg:max-h-[620px] lg:overflow-y-auto lg:pr-1" data-testid="map-warehouse-list">
              {visible.map((w, i) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                  className={`glass-card p-4 border-2 transition-colors ${activeId === w.id ? 'border-amber-400' : 'border-transparent'}`}
                  data-testid={`map-warehouse-${w.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{w.name}</p>
                      <p className="text-xs font-semibold text-teal-600 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{w.region}</p>
                    </div>
                    {region === w.region ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">Ваш регион</span>
                    ) : (
                      <button onClick={() => setRegion(w.region)} className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 underline flex-shrink-0" data-testid={`map-set-region-${w.id}`}>Сделать моим регионом</button>
                    )}
                  </div>
                  {w.address && <p className="text-sm text-slate-600 mt-2">{w.address}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                    {w.hours && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{w.hours}</span>}
                    {w.phone && <a href={`tel:${w.phone}`} className="flex items-center gap-1 hover:text-teal-600"><Phone className="w-3 h-3" />{w.phone}</a>}
                  </div>
                  {hasCoords(w) ? (
                    <button onClick={() => setActiveId(w.id)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors" data-testid={`map-show-${w.id}`}>
                      <Navigation className="w-3.5 h-3.5" />Показать на карте
                    </button>
                  ) : (
                    <p className="mt-3 text-[11px] text-slate-400">Точка на карте не указана</p>
                  )}
                </motion.div>
              ))}
            </div>
            <div className="lg:col-span-3 h-[420px] lg:h-[620px] rounded-2xl overflow-hidden shadow-sm border border-slate-200 lg:sticky lg:top-24">
              <WarehouseMap warehouses={visible} activeId={activeId} onSelect={setActiveId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
