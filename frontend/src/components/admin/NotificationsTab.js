import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Save, Mail, Send, Bell } from 'lucide-react';

export default function NotificationsTab({
  notificationSettings,
  setNotificationSettings,
  testEmail,
  setTestEmail,
  bulkEmailForm,
  setBulkEmailForm,
  sendingEmail,
  users,
  handleSaveNotificationSettings,
  handleSendTestEmail,
  handleSendBulkEmail,
  isDark = false
}) {
  return (
    <div className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : ''}`}>Email-уведомления</h2>
          <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Настройте автоматические email-уведомления для клиентов</p>
        </div>

        {/* Resend Status */}
        <div className={`p-4 rounded-lg border ${
          notificationSettings.resend_configured 
            ? isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
            : isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${notificationSettings.resend_configured ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <div>
              <p className={`font-medium ${
                notificationSettings.resend_configured 
                  ? isDark ? 'text-green-400' : 'text-green-800'
                  : isDark ? 'text-yellow-400' : 'text-yellow-800'
              }`}>
                {notificationSettings.resend_configured ? 'Resend API настроен' : 'Resend API не настроен'}
              </p>
              <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                {notificationSettings.resend_configured 
                  ? 'Email-уведомления будут отправляться автоматически' 
                  : 'Добавьте RESEND_API_KEY в настройки сервера для активации'}
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className={`rounded-lg p-6 space-y-4 ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'bg-white border border-zinc-200'}`}>
          <h3 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            <Bell className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
            Типы уведомлений
          </h3>

          <div className="space-y-4">
            <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-zinc-800/30 border border-zinc-700/30' : 'bg-zinc-50'}`}>
              <div>
                <p className={`font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Подтверждение заказа</p>
                <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Отправляется после оформления заказа</p>
              </div>
              <Switch
                checked={notificationSettings.order_confirmation_enabled}
                onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, order_confirmation_enabled: checked })}
                data-testid="notif-order-confirmation"
              />
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-zinc-800/30 border border-zinc-700/30' : 'bg-zinc-50'}`}>
              <div>
                <p className={`font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Статус заказа</p>
                <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Отправляется при изменении статуса</p>
              </div>
              <Switch
                checked={notificationSettings.order_status_enabled}
                onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, order_status_enabled: checked })}
                data-testid="notif-order-status"
              />
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-zinc-800/30 border border-zinc-700/30' : 'bg-zinc-50'}`}>
              <div>
                <p className={`font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Промо-рассылки</p>
                <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Разрешить отправку промо-писем</p>
              </div>
              <Switch
                checked={notificationSettings.promotions_enabled}
                onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, promotions_enabled: checked })}
                data-testid="notif-promotions"
              />
            </div>
          </div>

          <Button
            onClick={handleSaveNotificationSettings}
            className={`w-full mt-4 ${isDark ? 'bg-teal-500/90 hover:bg-teal-500' : 'bg-teal-500 hover:bg-teal-600'}`}
            data-testid="save-notification-settings"
          >
            <Save className="w-4 h-4 mr-2" />
            Сохранить настройки
          </Button>
        </div>

        {/* Test Email */}
        <div className={`rounded-lg p-6 ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'bg-white border border-zinc-200'}`}>
          <h3 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            <Mail className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            Тестовое письмо
          </h3>
          <div className="flex gap-3">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="email@example.com"
              className={`flex-1 ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-600' : ''}`}
              data-testid="test-email-input"
            />
            <Button
              onClick={handleSendTestEmail}
              disabled={sendingEmail || !notificationSettings.resend_configured}
              className="bg-blue-500 hover:bg-blue-600"
              data-testid="send-test-email-btn"
            >
              {sendingEmail ? 'Отправка...' : 'Отправить тест'}
            </Button>
          </div>
        </div>

        {/* Bulk Email */}
        <div className={`rounded-lg p-6 ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50 backdrop-blur-sm' : 'bg-white border border-zinc-200'}`}>
          <h3 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            <Send className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
            Массовая рассылка
          </h3>
          <div className="space-y-4">
            <div>
              <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Тема письма</Label>
              <Input
                value={bulkEmailForm.subject}
                onChange={(e) => setBulkEmailForm({ ...bulkEmailForm, subject: e.target.value })}
                placeholder="Специальное предложение от AVOPT.STORE!"
                className={`mt-1 ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-600' : ''}`}
                data-testid="bulk-email-subject"
              />
            </div>
            <div>
              <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Содержание письма (HTML)</Label>
              <Textarea
                value={bulkEmailForm.html_content}
                onChange={(e) => setBulkEmailForm({ ...bulkEmailForm, html_content: e.target.value })}
                placeholder="<p>Уважаемые клиенты!</p><p>Рады сообщить вам о...</p>"
                className={`mt-1 min-h-[150px] font-mono text-sm ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-600' : ''}`}
                data-testid="bulk-email-content"
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Поддерживается HTML-разметка. Письмо будет оформлено в фирменном стиле.</p>
            </div>
            <Button
              onClick={handleSendBulkEmail}
              disabled={sendingEmail || !notificationSettings.resend_configured || !notificationSettings.promotions_enabled}
              className="w-full bg-purple-500 hover:bg-purple-600"
              data-testid="send-bulk-email-btn"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendingEmail ? 'Отправка...' : `Отправить всем (${users.length} получателей)`}
            </Button>
            {!notificationSettings.promotions_enabled && (
              <p className={`text-sm text-center ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>Промо-рассылки отключены в настройках</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
