import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Save, Send, RefreshCw, Bot, CheckCircle, XCircle, AlertCircle, Globe, MessageSquare, Webhook, Trash2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TelegramTab({
  telegramSettings,
  setTelegramSettings,
  handleSaveTelegram,
  handleTestTelegram,
  isDark = false
}) {
  const [diag, setDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const fetchDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const res = await axios.get(`${API}/admin/telegram/diagnostics`);
      setDiag(res.data);
    } catch (err) {
      toast.error('Не удалось загрузить диагностику');
    } finally {
      setDiagLoading(false);
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

  const handleDiagTest = async () => {
    setActionLoading('test');
    try {
      const res = await axios.post(`${API}/admin/telegram/test-message`);
      toast.success(`Сообщение отправлено в чат ${res.data.chat_id}`);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Ошибка отправки';
      // Surface common error: bot blocked
      if (detail.toLowerCase().includes('blocked')) {
        toast.error('Бот заблокирован пользователем в Telegram. Разблокируйте бота и снова отправьте /start');
      } else {
        toast.error(detail);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const Check = ({ ok, label, hint }) => (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${isDark ? 'border-zinc-700 bg-zinc-900/50' : 'border-slate-200 bg-white'}`}>
      {ok ? (
        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>{label}</p>
        {hint && <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>{hint}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-8">
      {/* Settings block (existing) */}
      <div className="max-w-xl space-y-6">
        <div>
          <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-zinc-100' : ''}`}>Уведомления в Telegram</h2>
          <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'} mb-4`}>
            Получайте уведомления о новых заказах в Telegram. Создайте бота через @BotFather и получите токен.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={telegramSettings?.enabled || false}
            onCheckedChange={(checked) => setTelegramSettings({ ...telegramSettings, enabled: checked })}
          />
          <Label className={isDark ? 'text-zinc-300' : ''}>Включить уведомления</Label>
        </div>

        <div>
          <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Bot Token</Label>
          <Input
            value={telegramSettings?.bot_token || ''}
            onChange={(e) => setTelegramSettings({ ...telegramSettings, bot_token: e.target.value })}
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            className={`mt-1 font-mono text-sm ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}`}
          />
          <p className={`text-xs mt-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Получите токен у @BotFather в Telegram</p>
        </div>

        <div>
          <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Chat ID</Label>
          <Input
            value={telegramSettings?.chat_id || ''}
            onChange={(e) => setTelegramSettings({ ...telegramSettings, chat_id: e.target.value })}
            placeholder="-1001234567890"
            className={`mt-1 font-mono text-sm ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}`}
          />
          <p className={`text-xs mt-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>ID чата или канала для уведомлений. Узнайте его через @userinfobot</p>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSaveTelegram} className="bg-teal-500 hover:bg-teal-600">
            <Save className="w-4 h-4 mr-2" />
            Сохранить
          </Button>
          {handleTestTelegram && (
            <Button
              variant="outline"
              onClick={handleTestTelegram}
              disabled={!telegramSettings?.enabled || !telegramSettings?.bot_token || !telegramSettings?.chat_id}
              className={isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : ''}
            >
              <Send className="w-4 h-4 mr-2" />
              Тест
            </Button>
          )}
        </div>
      </div>

      {/* Diagnostics block */}
      <div className={`pt-6 border-t ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow shadow-sky-500/30">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>Диагностика чат-бота</h2>
              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Проверка webhook, токена и связи</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={fetchDiagnostics}
            disabled={diagLoading}
            className="rounded-xl"
            data-testid="refresh-diagnostics-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${diagLoading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>

        {diagLoading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : diag ? (
          <div className="space-y-4">
            {/* Checks */}
            <div className="grid sm:grid-cols-2 gap-2">
              <Check
                ok={diag.checks.token_configured}
                label="TELEGRAM_CHAT_BOT_TOKEN"
                hint={diag.checks.token_configured ? 'Токен задан в окружении' : 'Не задан — добавьте в env'}
              />
              <Check
                ok={diag.checks.backend_url_configured}
                label="BACKEND_URL"
                hint={diag.env.backend_url || 'Не задан в окружении'}
              />
              <Check
                ok={diag.checks.webhook_matches}
                label="Webhook URL совпадает"
                hint={diag.checks.webhook_matches ? 'Telegram отправляет в это окружение' : 'Webhook указывает на другой URL'}
              />
              <Check
                ok={diag.checks.admin_chat_id_present}
                label="admin_chat_id"
                hint={diag.admin_chat_id ? `Chat: ${diag.admin_chat_id}` : 'Не привязан — отправьте /start боту'}
              />
            </div>

            {/* Errors */}
            {diag.errors && diag.errors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <p className="text-xs font-bold text-rose-700 mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Ошибки Telegram
                </p>
                <ul className="text-xs text-rose-700 space-y-0.5">
                  {diag.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}

            {/* Webhook info */}
            <div className={`rounded-xl p-4 text-sm space-y-2 ${isDark ? 'bg-zinc-900/50 border border-zinc-700' : 'bg-slate-50 border border-slate-200'}`}>
              <p className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                <Globe className="w-3.5 h-3.5" /> Webhook & окружение
              </p>
              <div className="flex justify-between gap-3 flex-wrap text-xs">
                <span className={isDark ? 'text-zinc-500' : 'text-slate-500'}>BACKEND_URL (авто):</span>
                <code className={`font-mono px-2 py-0.5 rounded ${isDark ? 'bg-zinc-800' : 'bg-white'}`}>{diag.env.backend_url || '—'}</code>
              </div>
              {diag.env.env_var_backend_url && diag.env.env_var_backend_url !== diag.env.backend_url && (
                <div className="flex justify-between gap-3 flex-wrap text-xs">
                  <span className={isDark ? 'text-zinc-500' : 'text-slate-500'}>BACKEND_URL (env, устарел):</span>
                  <code className="font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-700">{diag.env.env_var_backend_url}</code>
                </div>
              )}
              <div className="flex justify-between gap-3 flex-wrap text-xs">
                <span className={isDark ? 'text-zinc-500' : 'text-slate-500'}>Ожидаемый webhook:</span>
                <code className={`font-mono px-2 py-0.5 rounded break-all ${isDark ? 'bg-zinc-800' : 'bg-white'}`}>{diag.expected_webhook_url || '—'}</code>
              </div>
              <div className="flex justify-between gap-3 flex-wrap text-xs">
                <span className={isDark ? 'text-zinc-500' : 'text-slate-500'}>Текущий у Telegram:</span>
                <code className={`font-mono px-2 py-0.5 rounded break-all ${diag.checks.webhook_matches ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} data-testid="current-webhook-url">
                  {diag.webhook_info?.url || '— (не установлен)'}
                </code>
              </div>
              {diag.webhook_info?.last_error_message && (
                <div className="p-2 bg-rose-50 rounded text-xs text-rose-700 mt-2">
                  Last error: {diag.webhook_info.last_error_message}
                </div>
              )}
            </div>

            {/* Bot info + chat_id */}
            {diag.bot_info && (
              <div className={`rounded-xl p-4 text-sm ${isDark ? 'bg-zinc-900/50 border border-zinc-700' : 'bg-slate-50 border border-slate-200'}`}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                  <MessageSquare className="w-3.5 h-3.5" /> Бот и привязка
                </p>
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between gap-3 flex-wrap">
                    <span className={isDark ? 'text-zinc-500' : 'text-slate-500'}>Username:</span>
                    <code className={`font-mono px-2 py-0.5 rounded ${isDark ? 'bg-zinc-800' : 'bg-white'}`}>@{diag.bot_info.username}</code>
                  </div>
                  <div className="flex justify-between gap-3 flex-wrap">
                    <span className={isDark ? 'text-zinc-500' : 'text-slate-500'}>admin_chat_id:</span>
                    <code className={`font-mono px-2 py-0.5 rounded ${diag.admin_chat_id ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {diag.admin_chat_id || 'не привязан'}
                    </code>
                  </div>
                </div>
                {!diag.admin_chat_id && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                    Откройте <code className="bg-white px-1 rounded">@{diag.bot_info.username}</code> в Telegram и отправьте <code className="bg-white px-1 rounded">/start</code>.
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="grid sm:grid-cols-3 gap-3">
              <Button
                onClick={handleSetupWebhook}
                disabled={actionLoading === 'set' || !diag.checks.token_configured || !diag.checks.backend_url_configured}
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
                Удалить
              </Button>
              <Button
                onClick={handleDiagTest}
                disabled={actionLoading === 'test' || !diag.admin_chat_id}
                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl"
                data-testid="test-message-btn"
              >
                <Send className="w-4 h-4 mr-2" />
                Тест в Telegram
              </Button>
            </div>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              «Установить webhook» нужно нажать после деплоя или смены домена. «Тест в Telegram» отправит сообщение от бота — если придёт, связь работает.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
