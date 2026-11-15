import { useState, useEffect, useCallback } from 'react';
import { ScrollText, Search, RotateCcw, ChevronLeft, ChevronRight, Clock, Shield, Activity, Trash2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const METHOD_COLORS = {
  GET: 'bg-blue-500/15 text-blue-600',
  POST: 'bg-green-500/15 text-green-600',
  PUT: 'bg-amber-500/15 text-amber-600',
  DELETE: 'bg-red-500/15 text-red-600',
  PATCH: 'bg-purple-500/15 text-purple-600',
};

const LogDetailModal = ({ log, onClose, onRevert, isDark }) => {
  if (!log) return null;

  const renderJson = (data, label) => {
    if (!data) return null;
    return (
      <div className="mt-3">
        <p className={`text-xs font-bold uppercase mb-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>{label}</p>
        <pre className={`text-xs p-3 rounded-lg overflow-auto max-h-60 ${isDark ? 'bg-zinc-900 text-zinc-300' : 'bg-slate-50 text-slate-700'}`}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-slate-200'} shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Детали действия</h3>
            <p className={`text-xs mt-1 font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{log.id}</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-zinc-700' : 'hover:bg-slate-100'}`}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className={`p-3 rounded-lg ${isDark ? 'bg-zinc-700/50' : 'bg-slate-50'}`}>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Действие</p>
            <p className={`text-sm font-semibold ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>{log.action}</p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-zinc-700/50' : 'bg-slate-50'}`}>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Пользователь</p>
            <p className={`text-sm font-semibold ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>{log.user_name || '—'}</p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-zinc-700/50' : 'bg-slate-50'}`}>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Метод / Путь</p>
            <p className={`text-sm font-mono ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[log.method] || 'bg-gray-100 text-gray-600'}`}>{log.method}</span>
              {' '}{log.path}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-zinc-700/50' : 'bg-slate-50'}`}>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Статус / IP</p>
            <p className={`text-sm font-mono ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
              {log.status_code} | {log.ip}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-zinc-700/50' : 'bg-slate-50'}`}>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Дата</p>
            <p className={`text-sm ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
              {new Date(log.created_at).toLocaleString('ru-RU')}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-zinc-700/50' : 'bg-slate-50'}`}>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>Статус отката</p>
            <p className={`text-sm font-semibold ${log.reverted ? 'text-amber-500' : log.before_state ? 'text-green-500' : isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              {log.reverted ? 'Откачено' : log.before_state ? 'Можно откатить' : 'Нет данных для отката'}
            </p>
          </div>
        </div>

        {renderJson(log.details, 'Детали')}
        {renderJson(log.before_state, 'Состояние ДО')}
        {renderJson(log.after_state, 'Состояние ПОСЛЕ')}

        {log.before_state && !log.reverted && (
          <div className="mt-4 pt-4 border-t border-dashed flex justify-end" style={{ borderColor: isDark ? '#3f3f46' : '#e2e8f0' }}>
            <Button
              onClick={() => onRevert(log.id)}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
              data-testid={`revert-log-${log.id}`}
            >
              <RotateCcw className="w-4 h-4" />
              Откатить изменение
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export const LogsTab = ({ isDark = false }) => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (search) params.append('search', search);
      if (methodFilter) params.append('method', methodFilter);
      const res = await axios.get(`${API}/admin/action-logs?${params}`);
      setLogs(res.data.logs || []);
      setTotalPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, methodFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/action-logs/stats`);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch log stats', err);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleRevert = async (logId) => {
    if (!window.confirm('Вы уверены, что хотите откатить это изменение?')) return;
    try {
      await axios.post(`${API}/admin/action-logs/${logId}/revert`);
      toast.success('Изменение успешно откачено');
      setSelectedLog(null);
      fetchLogs();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отката');
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Очистить ВСЕ логи? Это действие нельзя отменить.')) return;
    try {
      await axios.delete(`${API}/admin/action-logs/clear`);
      toast.success('Логи очищены');
      fetchLogs();
      fetchStats();
    } catch (err) {
      toast.error('Ошибка очистки');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-6" data-testid="logs-tab">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl ${isDark ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-teal-50 border border-teal-100'}`}>
            <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              <Activity className="w-4 h-4" />
              <span className="text-xs font-medium">Всего логов</span>
            </div>
            <p className={`text-2xl font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>{stats.total}</p>
          </div>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
            <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Сегодня</span>
            </div>
            <p className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{stats.today}</p>
          </div>
          <div className={`p-4 rounded-xl ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100'}`}>
            <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              <RotateCcw className="w-4 h-4" />
              <span className="text-xs font-medium">Можно откатить</span>
            </div>
            <p className={`text-2xl font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{stats.revertable}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по действию, пути, пользователю..."
                className={`pl-10 ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}`}
                data-testid="logs-search-input"
              />
            </div>
          </form>
          <div className="flex gap-2">
            {['', 'GET', 'POST', 'PUT', 'DELETE'].map(m => (
              <button
                key={m || 'all'}
                onClick={() => { setMethodFilter(m); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  methodFilter === m
                    ? isDark ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-teal-500 text-white'
                    : isDark ? 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                data-testid={`filter-method-${m || 'all'}`}
              >
                {m || 'Все'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleClearLogs} className="text-red-500 hover:text-red-600 hover:bg-red-50" data-testid="clear-logs-btn">
            <Trash2 className="w-4 h-4 mr-1" />
            Очистить
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-white border border-slate-200'}`}>
        {loading ? (
          <div className={`p-12 text-center ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
            <Activity className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p>Загрузка логов...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className={`p-12 text-center ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
            <ScrollText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Логи пока пусты</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? 'bg-zinc-800 border-b border-zinc-700' : 'bg-slate-50 border-b border-slate-200'}>
                  <th className={`text-left py-3 px-4 text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Время</th>
                  <th className={`text-left py-3 px-4 text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Действие</th>
                  <th className={`text-left py-3 px-4 text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Пользователь</th>
                  <th className={`text-left py-3 px-4 text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Метод</th>
                  <th className={`text-left py-3 px-4 text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Путь</th>
                  <th className={`text-center py-3 px-4 text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Статус</th>
                  <th className={`text-center py-3 px-4 text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`border-b cursor-pointer transition-colors ${
                      isDark 
                        ? 'border-zinc-700/50 hover:bg-zinc-700/30' 
                        : 'border-slate-100 hover:bg-slate-50'
                    } ${log.reverted ? 'opacity-50' : ''}`}
                    onClick={() => setSelectedLog(log)}
                    data-testid={`log-row-${log.id}`}
                  >
                    <td className={`py-2.5 px-4 font-mono text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      {formatTime(log.created_at)}
                    </td>
                    <td className={`py-2.5 px-4 ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                      <div className="flex items-center gap-2">
                        {log.before_state && !log.reverted && (
                          <RotateCcw className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" title="Можно откатить" />
                        )}
                        {log.reverted && (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" title="Откачено" />
                        )}
                        <span className="truncate max-w-[180px]">{log.action}</span>
                      </div>
                    </td>
                    <td className={`py-2.5 px-4 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                      <div className="flex items-center gap-1.5">
                        {log.user_role === 'admin' && <Shield className="w-3.5 h-3.5 text-teal-500" />}
                        <span className="truncate max-w-[120px]">{log.user_name || '—'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[log.method] || 'bg-gray-100 text-gray-600'}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className={`py-2.5 px-4 font-mono text-xs max-w-[200px] truncate ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      {log.path}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`text-xs font-mono ${
                        log.status_code >= 400 ? 'text-red-500' : log.status_code >= 300 ? 'text-amber-500' : 'text-green-500'
                      }`}>
                        {log.status_code}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Eye className={`w-4 h-4 inline ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'bg-zinc-800 border-t border-zinc-700' : 'bg-slate-50 border-t border-slate-200'}`}>
            <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              Показано {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} из {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="logs-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                data-testid="logs-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <LogDetailModal
            log={selectedLog}
            onClose={() => setSelectedLog(null)}
            onRevert={handleRevert}
            isDark={isDark}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LogsTab;
