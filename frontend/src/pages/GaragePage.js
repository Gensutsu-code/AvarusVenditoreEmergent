import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Truck, Container, Plus, Pencil, Trash2, ShoppingCart, Package, Loader2, History } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useFeatures } from '../context/FeaturesContext';
import { GARAGE_TYPES, garageTypeLabel } from '../lib/garageTypes';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const money = (n) => `${new Intl.NumberFormat('ru-RU').format(Math.round(Number(n) || 0))} ₽`;
const date = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '');
const err = (e) => { const d = e.response?.data?.detail; toast.error(typeof d === 'string' ? d : 'Проверьте заполнение полей'); };
const empty = { type: 'truck', name: '', vin: '', year: '', plate: '', note: '' };

export default function GaragePage() {
  const { user, loading } = useAuth();
  const { addToCart } = useCart();
  const [data, setData] = useState(null);
  const garageCfg = useFeatures().settings.garage || {};
  const allowedTypes = garageCfg.allowed_types || ['truck', 'trailer'];
  const maxVehicles = garageCfg.max_vehicles || 0;
  const limitReached = maxVehicles > 0 && (data?.vehicles.length || 0) >= maxVehicles;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => axios.get(`${API}/garage`).then((r) => setData(r.data)).catch(err), []);
  useEffect(() => { if (user) load(); }, [user, load]);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const save = async () => {
    const payload = { ...form, vin: form.vin.trim().toUpperCase(), year: form.year ? parseInt(form.year, 10) : null };
    if (!payload.name.trim()) { toast.error('Укажите марку и модель'); return; }
    if (payload.vin.length !== 17) { toast.error('VIN должен содержать 17 символов'); return; }
    setSaving(true);
    try {
      if (form.id) await axios.put(`${API}/garage/vehicles/${form.id}`, payload);
      else await axios.post(`${API}/garage/vehicles`, payload);
      toast.success('Сохранено'); setForm(null); load();
    } catch (e) { err(e); } finally { setSaving(false); }
  };
  const remove = async (v) => {
    if (!window.confirm(`Удалить «${v.name}» из гаража? Заказы останутся в истории без привязки к авто.`)) return;
    try { await axios.delete(`${API}/garage/vehicles/${v.id}`); toast.success('Удалено'); load(); } catch (e) { err(e); }
  };
  const rebuy = async (p) => {
    if (await addToCart(p.product_id, 1)) toast.success('Товар добавлен в корзину'); else toast.error('Не удалось добавить товар в корзину');
  };
  const assign = async (orderId, vehicleId) => {
    try { await axios.put(`${API}/garage/orders/${orderId}/vehicle`, { vehicle_id: vehicleId || null }); toast.success('Заказ привязан'); load(); } catch (e) { err(e); }
  };
  const f = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  const lbl = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <div className="min-h-screen" data-testid="garage-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Мой гараж</h1>
            <p className="text-sm text-slate-500">Добавьте автомобили и прицепы — при оформлении заказа можно выбрать, для какой техники покупка, и потом быстро купить те же запчасти снова.</p>
          </div>
          <Button onClick={() => setForm({ ...empty, type: allowedTypes[0] })} disabled={limitReached} title={limitReached ? `В гараже может быть не больше ${maxVehicles} единиц техники` : undefined} className="bg-teal-500 hover:bg-teal-600 text-white" data-testid="garage-add-btn"><Plus className="w-4 h-4 mr-1.5" />Добавить технику</Button>
        </div>

        {!data ? <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-500" /></div> : (
          <>
            {data.vehicles.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400" data-testid="garage-empty">В гараже пока пусто. Добавьте автомобиль или прицеп с VIN-кодом.</div>}
            <div className="space-y-5">
              {data.vehicles.map((v) => (
                <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-5" data-testid={`garage-vehicle-${v.id}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">{v.type === 'trailer' ? <Container className="w-5 h-5" /> : <Truck className="w-5 h-5" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800">{v.name} <span className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{garageTypeLabel(v.type)}</span></p>
                      <p className="text-sm text-slate-500">VIN: <span className="font-mono text-slate-700" data-testid={`garage-vin-${v.id}`}>{v.vin}</span>{v.year ? ` · ${v.year} г.` : ''}{v.plate ? ` · ${v.plate}` : ''}</p>
                      {v.note && <p className="text-xs text-slate-400 mt-0.5">{v.note}</p>}
                    </div>
                    <button onClick={() => setForm({ ...empty, ...v, year: v.year || '' })} className="p-2 text-slate-400 hover:text-teal-600" title="Редактировать" data-testid={`garage-edit-${v.id}`}><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(v)} className="p-2 text-slate-400 hover:text-rose-500" title="Удалить" data-testid={`garage-delete-${v.id}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <p className="mt-4 mb-2 text-sm font-semibold text-slate-700 flex items-center gap-1.5"><History className="w-4 h-4 text-teal-500" />Купленные запчасти ({v.parts.length})</p>
                  {v.parts.length === 0 ? <p className="text-sm text-slate-400">Для этой техники покупок пока нет. Выберите её в корзине при оформлении заказа.</p> : (
                    <div className="grid md:grid-cols-2 gap-2" data-testid={`garage-parts-${v.id}`}>
                      {v.parts.map((p) => (
                        <div key={p.product_id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5" data-testid={`garage-part-${v.id}-${p.product_id}`}>
                          <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">{p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300" />}</div>
                          <div className="min-w-0 flex-1">
                            {p.available ? <Link to={`/product/${p.product_id}`} className="text-sm font-medium text-slate-800 hover:text-teal-600 line-clamp-1">{p.name}</Link> : <p className="text-sm font-medium text-slate-500 line-clamp-1">{p.name}</p>}
                            <p className="text-[11px] text-slate-400"><span className="font-mono">{p.article}</span> · куплено {p.quantity} шт. · {date(p.last_bought_at)}</p>
                          </div>
                          {p.available ? (
                            <Button size="sm" onClick={() => rebuy(p)} disabled={!p.in_stock} className="bg-teal-500 hover:bg-teal-600 text-white flex-shrink-0" title={p.in_stock ? 'Купить снова' : 'Нет в наличии'} data-testid={`garage-rebuy-${v.id}-${p.product_id}`}>
                              <ShoppingCart className="w-3.5 h-3.5 mr-1" />{p.in_stock ? money(p.price) : 'Нет'}
                            </Button>
                          ) : <span className="text-[11px] text-slate-400 flex-shrink-0">снят с продажи</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {data.vehicles.length > 0 && data.unassigned_orders.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 mt-6" data-testid="garage-unassigned">
                <p className="font-semibold text-slate-800 mb-1">Заказы без привязки к технике</p>
                <p className="text-xs text-slate-400 mb-3">Выберите технику, чтобы запчасти из заказа попали в её историю.</p>
                <div className="space-y-2">
                  {data.unassigned_orders.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 px-3 py-2" data-testid={`garage-order-${o.id}`}>
                      <span className="text-sm font-mono text-slate-500">#{o.id.slice(0, 8)}</span>
                      <span className="text-xs text-slate-400">{date(o.created_at)}</span>
                      <span className="text-sm text-slate-700 flex-1 min-w-[160px] truncate">{o.items.map((i) => i.name).join(', ')}</span>
                      <select defaultValue="" onChange={(e) => e.target.value && assign(o.id, e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" data-testid={`garage-assign-${o.id}`}>
                        <option value="">— выбрать технику —</option>
                        {data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="rounded-2xl" aria-describedby={undefined} data-testid="garage-modal">
          <DialogHeader><DialogTitle>{form?.id ? 'Редактировать технику' : 'Добавить технику'}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {GARAGE_TYPES.filter(([id]) => allowedTypes.includes(id) || id === form.type).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setForm({ ...form, type: id })} className={`h-10 rounded-xl border text-sm font-medium transition-colors ${form.type === id ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600'}`} data-testid={`garage-type-${id}`}>{label}</button>
                ))}
              </div>
              <div><label className={lbl}>Марка и модель *</label><Input {...f('name')} placeholder="DAF XF 105" maxLength={120} data-testid="garage-name-input" /></div>
              <div><label className={lbl}>VIN-код * (17 символов)</label><Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="XLRTE47MS0E123456" maxLength={17} className="font-mono" data-testid="garage-vin-input" /><p className="text-[11px] text-slate-400 mt-1">{form.vin.length}/17</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Год выпуска</label><Input type="number" min="1950" max="2100" {...f('year')} data-testid="garage-year-input" /></div>
                <div><label className={lbl}>Гос. номер</label><Input {...f('plate')} maxLength={20} data-testid="garage-plate-input" /></div>
              </div>
              <div><label className={lbl}>Заметка</label><Input {...f('note')} maxLength={300} data-testid="garage-note-input" /></div>
              <Button onClick={save} disabled={saving} className="w-full bg-teal-500 hover:bg-teal-600 text-white" data-testid="garage-save-btn">{saving ? 'Сохранение…' : 'Сохранить'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
