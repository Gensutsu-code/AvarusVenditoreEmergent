import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, ChevronDown, Save, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FIELD = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400';

export default function ReturnSettingsPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/admin/return-settings`)
      .then((r) => setS(r.data))
      .catch(() => toast.error('Не удалось загрузить настройки возвратов'))
      .finally(() => setLoading(false));
  }, []);

  const upd = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/return-settings`, {
        ...s,
        fee_percent: Number(s.fee_percent),
        min_photos: Number(s.min_photos),
        max_photos: Number(s.max_photos),
        return_window_days: Number(s.return_window_days),
      });
      toast.success('Условия возврата сохранены');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden" data-testid="return-settings-panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition"
        data-testid="return-settings-toggle"
      >
        <span className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-slate-600" />
          </span>
          <span className="text-left">
            <span className="block text-sm font-bold text-slate-800">Условия и правила возврата</span>
            <span className="block text-xs text-slate-500">Комиссия, фото, срок, тексты для клиента</span>
          </span>
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100"
          >
            {loading || !s ? (
              <div className="py-10 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500 mx-auto" />
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Numeric rules */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Удержание, %</label>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={s.fee_percent}
                      onChange={(e) => upd('fee_percent', e.target.value)}
                      className={FIELD}
                      data-testid="rs-fee-percent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Мин. фото</label>
                    <input
                      type="number" min="0" max="20"
                      value={s.min_photos}
                      onChange={(e) => upd('min_photos', e.target.value)}
                      className={FIELD}
                      data-testid="rs-min-photos"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Макс. фото</label>
                    <input
                      type="number" min="1" max="20"
                      value={s.max_photos}
                      onChange={(e) => upd('max_photos', e.target.value)}
                      className={FIELD}
                      data-testid="rs-max-photos"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Срок, дней (0 = без лимита)</label>
                    <input
                      type="number" min="0" max="3650"
                      value={s.return_window_days}
                      onChange={(e) => upd('return_window_days', e.target.value)}
                      className={FIELD}
                      data-testid="rs-window-days"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!s.warranty_enabled}
                    onChange={(e) => upd('warranty_enabled', e.target.checked)}
                    className="w-5 h-5 rounded accent-teal-500"
                    data-testid="rs-warranty-enabled"
                  />
                  <span className="text-sm text-slate-700">Разрешить «Возврат по гарантии»</span>
                </label>

                {/* Texts */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Описание «Обычный возврат»</label>
                  <textarea rows={2} value={s.desc_return} onChange={(e) => upd('desc_return', e.target.value)} className={`${FIELD} resize-none`} data-testid="rs-desc-return" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Описание «Возврат по гарантии»</label>
                  <textarea rows={2} value={s.desc_warranty} onChange={(e) => upd('desc_warranty', e.target.value)} className={`${FIELD} resize-none`} data-testid="rs-desc-warranty" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Текст-предупреждение (жёлтый блок)</label>
                  <textarea rows={3} value={s.warning_text} onChange={(e) => upd('warning_text', e.target.value)} className={`${FIELD} resize-none`} data-testid="rs-warning-text" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Общие «Условия и правила возврата» (показывается клиенту)</label>
                  <textarea rows={5} value={s.policy_text} onChange={(e) => upd('policy_text', e.target.value)} className={`${FIELD} resize-none`} data-testid="rs-policy-text" />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={save}
                    disabled={saving}
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl"
                    data-testid="rs-save-btn"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Сохранить условия
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
