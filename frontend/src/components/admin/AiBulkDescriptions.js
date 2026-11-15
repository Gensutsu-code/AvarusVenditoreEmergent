import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, Loader2, Square } from 'lucide-react';
import { Button } from '../ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Writes AI descriptions for every product that has none (background job with progress)
export const AiBulkDescriptions = ({ onFinished }) => {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/ai/bulk-descriptions`);
      setState((prev) => {
        if (prev?.status === 'running' && r.data.status !== 'running') {
          if (r.data.status === 'finished') toast.success(`Описания готовы: ${r.data.done}`);
          else if (r.data.status === 'stopped') toast.info(`Остановлено. Написано описаний: ${r.data.done}`);
          else toast.error(r.data.error || 'Задача прервалась — запустите её ещё раз');
          if (onFinished) onFinished();
        }
        return r.data;
      });
    } catch { /* keep the last known state */ }
  }, [onFinished]);

  useEffect(() => { load(); }, [load]);
  const running = state?.status === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [running, load]);

  const start = async () => {
    const n = state?.without_description || 0;
    if (!window.confirm(`Написать описания с помощью ИИ для товаров без описания (${n} шт.)? Существующие описания не изменятся. Расход спишется с баланса ИИ.`)) return;
    setBusy(true);
    try { const r = await axios.post(`${API}/admin/ai/bulk-descriptions/start`); setState({ ...r.data, without_description: n }); toast.success('Запущено — можно продолжать работу'); }
    catch (e) { toast.error(e.response?.data?.detail || 'Не удалось запустить'); }
    finally { setBusy(false); }
  };
  const stop = async () => {
    try { await axios.post(`${API}/admin/ai/bulk-descriptions/stop`); toast.info('Останавливаю после текущего товара…'); }
    catch { toast.error('Не удалось остановить'); }
  };

  if (!state) return null;
  if (running) {
    const processed = (state.done || 0) + (state.failed || 0);
    return (
      <div className="flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 h-10 text-sm text-teal-700" data-testid="ai-bulk-progress">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Описания: {processed} из {state.total}</span>
        <button onClick={stop} className="ml-1 p-1 rounded hover:bg-teal-100" title="Остановить" data-testid="ai-bulk-stop-btn"><Square className="w-3.5 h-3.5" /></button>
      </div>
    );
  }
  const n = state.without_description || 0;
  return (
    <Button variant="outline" onClick={start} disabled={busy || n === 0} className="border-teal-300 text-teal-600 hover:bg-teal-50" title={n === 0 ? 'У всех товаров уже есть описание' : 'ИИ напишет описания для всех товаров без описания'} data-testid="ai-bulk-descriptions-btn">
      <Sparkles className="w-4 h-4 mr-2" />Описания с ИИ ({n})
    </Button>
  );
};

export default AiBulkDescriptions;
