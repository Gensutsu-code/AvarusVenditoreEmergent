import { useState, useEffect } from 'react';
import { Code, Save, X, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { motion } from 'framer-motion';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const DataEditorModal = ({ collection, documentId, onClose, onSaved, isDark = false }) => {
  const [data, setData] = useState(null);
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [collection, documentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/data/${collection}/${documentId}`);
      setData(res.data);
      setJsonText(JSON.stringify(res.data, null, 2));
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Document not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      setSaving(true);
      setError('');
      const res = await axios.put(`${API}/admin/data/${collection}/${documentId}`, parsed);
      setData(res.data);
      setJsonText(JSON.stringify(res.data, null, 2));
      toast.success('Данные сохранены');
      onSaved && onSaved(res.data);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Невалидный JSON: ' + err.message);
      } else {
        setError(err.response?.data?.detail || 'Ошибка сохранения');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (data) {
      setJsonText(JSON.stringify(data, null, 2));
      setError('');
    }
  };

  const isChanged = data ? jsonText !== JSON.stringify(data, null, 2) : false;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-slate-200'} shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Code className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Редактор данных
              </h3>
              <p className={`text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                {collection} / {documentId?.slice(0, 12)}...
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700' : 'hover:bg-slate-200'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning */}
        <div className={`px-6 py-2 flex items-center gap-2 text-xs ${isDark ? 'bg-amber-500/10 text-amber-400 border-b border-zinc-700' : 'bg-amber-50 text-amber-700 border-b border-amber-100'}`}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Прямое редактирование данных. Будьте осторожны — изменения вступают в силу немедленно. Поле "id" изменить нельзя.</span>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden p-4">
          {loading ? (
            <div className={`h-full flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              Загрузка...
            </div>
          ) : error && !data ? (
            <div className={`h-full flex items-center justify-center text-red-500`}>{error}</div>
          ) : (
            <textarea
              value={jsonText}
              onChange={e => { setJsonText(e.target.value); setError(''); }}
              spellCheck={false}
              className={`w-full h-[50vh] font-mono text-sm p-4 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${
                isDark 
                  ? 'bg-zinc-900 text-zinc-200 border border-zinc-700' 
                  : 'bg-slate-50 text-slate-800 border border-slate-200'
              } ${error ? 'ring-2 ring-red-500/50' : ''}`}
              data-testid="data-editor-textarea"
            />
          )}
        </div>

        {/* Error */}
        {error && data && (
          <div className="px-6 py-2">
            <p className="text-sm text-red-500 font-medium">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-2">
            {isChanged && (
              <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                Есть изменения
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!isChanged}
              className="gap-1"
              data-testid="data-editor-reset-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Сброс
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !isChanged}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white gap-1"
              data-testid="data-editor-save-btn"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DataEditorModal;
