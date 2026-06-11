import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Bot, RefreshCw, CheckCircle, XCircle, AlertCircle, 
  Send, Globe, Key, MessageSquare, Link as LinkIcon, Trash2, Webhook
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TelegramDiagnosticsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // 'set'|'delete'|'test'

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchDiagnostics();
  }, [user, authLoading, navigate]);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/telegram/diagnostics`);
      setData(res.data);
    } catch (err) {
      toast.error('Не удалось загрузить диагностику');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupWebhook = async () => {
    setActionLoading('set');
    try {
      const res = await axios.post(`${API}/admin/chat/setup-telegram-webhook`);
      toast.success(`Webhook установлен: ${res.data.url}`);
      fetchDiagnostics();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка установки webhook');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteWebhook = async () => {
    setActionLoading('delete');
    try {
      await axios.post(`${API}/admin/telegram/delete-webhook`);
      toast.success('Webhook удалён');
      fetchDiagnostics();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestMessage = async () => {
    setActionLoading('test');
    try {
      const res = await axios.post(`${API}/admin/telegram/test-message`);
      toast.success(`Сообщение отправлено в чат ${res.data.chat_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки');
    } finally {
      setActionLoading(null);
    }
  };

  if (!user || user.role !== 'admin') return null;

  const Check = ({ ok, label, hint }) => (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white">
      {ok ? (
        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>{label}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50" data-testid="telegram-diagnostics-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Диагностика Telegram</h1>
            <p className="text-sm text-slate-500">Проверка работы бота, webhook и отправки сообщений</p>
          </div>
          <Button
            variant="outline"
            onClick={fetchDiagnostics}
            disabled={loading}
            className="ml-auto rounded-xl"
            data-testid="refresh-diagnostics-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-3 border-sky-500/30 border-t-sky-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Checks summary */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm p-5"
            >
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Состояние</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                <Check
                  ok={data.checks.token_configured}
                  label="TELEGRAM_CHAT_BOT_TOKEN"
                  hint={data.checks.token_configured ? 'Токен задан в окружении' : 'Не задан — нужно добавить в env'}
                />
                <Check
                  ok={data.checks.backend_url_configured}
                  label="BACKEND_URL"
                  hint={data.env.backend_url || 'Не задан в окружении'}
                />
                <Check
                  ok={data.checks.webhook_matches}
                  label="Webhook URL совпадает"
                  hint={data.checks.webhook_matches ? 'Telegram отправляет в это окружение' : 'Webhook указывает на другой URL'}
                />
                <Check
                  ok={data.checks.admin_chat_id_present}
                  label="admin_chat_id"
                  hint={data.admin_chat_id ? `Chat: ${data.admin_chat_id}` : 'Не привязан — отправьте /start боту'}
                />
              </div>
            </motion.section>

            {/* Errors */}
            {data.errors && data.errors.length > 0 && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-rose-50 border border-rose-200 rounded-2xl p-5"
              >
                <h2 className="text-sm font-bold text-rose-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Ошибки
                </h2>
                <ul className="space-y-1 text-sm text-rose-700">
                  {data.errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </motion.section>
            )}

            {/* Env / URL block */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl shadow-sm p-5"
            >
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Окружение
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3 flex-wrap">
                  <span className="text-slate-500">BACKEND_URL:</span>
                  <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{data.env.backend_url || '—'}</code>
                </div>
                <div className="flex justify-between gap-3 flex-wrap">
                  <span className="text-slate-500">Ожидаемый webhook:</span>
                  <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded break-all">{data.expected_webhook_url || '—'}</code>
                </div>
                <div className="flex justify-between gap-3 flex-wrap">
                  <span className="text-slate-500">Текущий webhook у Telegram:</span>
                  <code className={`font-mono text-xs px-2 py-1 rounded break-all ${data.checks.webhook_matches ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} data-testid="current-webhook-url">
                    {data.webhook_info?.url || '— (не установлен)'}
                  </code>
                </div>
                {data.webhook_info?.pending_update_count > 0 && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Pending updates:</span>
                    <span className="font-semibold text-amber-600">{data.webhook_info.pending_update_count}</span>
                  </div>
                )}
                {data.webhook_info?.last_error_message && (
                  <div className="mt-2 p-2 bg-rose-50 rounded-lg text-xs text-rose-700">
                    Last error: {data.webhook_info.last_error_message}
                  </div>
                )}
              </div>
            </motion.section>

            {/* Bot info */}
            {data.bot_info && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl shadow-sm p-5"
              >
                <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Bot className="w-4 h-4" /> Информация о боте
                </h2>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Имя:</span><span className="font-medium">{data.bot_info.first_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Username:</span><code className="font-mono text-xs">@{data.bot_info.username}</code></div>
                  <div className="flex justify-between"><span className="text-slate-500">Bot ID:</span><code className="font-mono text-xs">{data.bot_info.id}</code></div>
                </div>
              </motion.section>
            )}

            {/* Chat ID */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl shadow-sm p-5"
            >
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Привязка к админу
              </h2>
              {data.admin_chat_id ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">admin_chat_id:</span><code className="font-mono text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">{data.admin_chat_id}</code></div>
                  {data.chat_settings?.admin_username && (
                    <div className="flex justify-between"><span className="text-slate-500">Username:</span><span className="font-medium">@{data.chat_settings.admin_username}</span></div>
                  )}
                  {data.chat_settings?.updated_at && (
                    <div className="flex justify-between"><span className="text-slate-500">Обновлено:</span><span className="text-xs text-slate-400">{new Date(data.chat_settings.updated_at).toLocaleString('ru-RU')}</span></div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  <p className="font-semibold mb-1">admin_chat_id не задан</p>
                  <p>Откройте Telegram-бота {data.bot_info?.username ? `@${data.bot_info.username}` : ''} и отправьте ему <code className="bg-white px-1.5 py-0.5 rounded">/start</code>. Затем нажмите «Обновить» здесь.</p>
                </div>
              )}
            </motion.section>

            {/* Actions */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-sm p-5"
            >
              <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Действия</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                <Button
                  onClick={handleSetupWebhook}
                  disabled={actionLoading === 'set' || !data.checks.token_configured || !data.checks.backend_url_configured}
                  className="bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white rounded-xl"
                  data-testid="setup-webhook-btn"
                >
                  <Webhook className="w-4 h-4 mr-2" />
                  {actionLoading === 'set' ? 'Установка...' : 'Установить webhook'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteWebhook}
                  disabled={actionLoading === 'delete'}
                  className="border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl"
                  data-testid="delete-webhook-btn"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {actionLoading === 'delete' ? '...' : 'Удалить webhook'}
                </Button>
                <Button
                  onClick={handleTestMessage}
                  disabled={actionLoading === 'test' || !data.admin_chat_id}
                  className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl"
                  data-testid="test-message-btn"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {actionLoading === 'test' ? '...' : 'Тестовое сообщение'}
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                «Установить webhook» нужно нажать после деплоя на production или смены домена.
                «Тестовое сообщение» отправит сообщение от бота в Telegram-чат админа.
              </p>
            </motion.section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
