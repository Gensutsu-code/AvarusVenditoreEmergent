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
  handleSendBulkEmail
}) {
  return (
    <div className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Email-уведомления</h2>
          <p className="text-sm text-zinc-500">Настройте автоматические email-уведомления для клиентов</p>
        </div>

        {/* Resend Status */}
        <div className={`p-4 rounded-lg border ${notificationSettings.resend_configured ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${notificationSettings.resend_configured ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <div>
              <p className={`font-medium ${notificationSettings.resend_configured ? 'text-green-800' : 'text-yellow-800'}`}>
                {notificationSettings.resend_configured ? 'Resend API настроен' : 'Resend API не настроен'}
              </p>
              <p className="text-sm text-zinc-500">
                {notificationSettings.resend_configured 
                  ? 'Email-уведомления будут отправляться автоматически' 
                  : 'Добавьте RESEND_API_KEY в настройки сервера для активации'}
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-500" />
            Типы уведомлений
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <div>
                <p className="font-medium text-zinc-900">Подтверждение заказа</p>
                <p className="text-sm text-zinc-500">Отправляется после оформления заказа</p>
              </div>
              <Switch
                checked={notificationSettings.order_confirmation_enabled}
                onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, order_confirmation_enabled: checked })}
                data-testid="notif-order-confirmation"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <div>
                <p className="font-medium text-zinc-900">Статус заказа</p>
                <p className="text-sm text-zinc-500">Отправляется при изменении статуса</p>
              </div>
              <Switch
                checked={notificationSettings.order_status_enabled}
                onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, order_status_enabled: checked })}
                data-testid="notif-order-status"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <div>
                <p className="font-medium text-zinc-900">Промо-рассылки</p>
                <p className="text-sm text-zinc-500">Разрешить отправку промо-писем</p>
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
            className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
            data-testid="save-notification-settings"
          >
            <Save className="w-4 h-4 mr-2" />
            Сохранить настройки
          </Button>
        </div>

        {/* Test Email */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6">
          <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-500" />
            Тестовое письмо
          </h3>
          <div className="flex gap-3">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1"
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
        <div className="bg-white border border-zinc-200 rounded-lg p-6">
          <h3 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-500" />
            Массовая рассылка
          </h3>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold uppercase text-zinc-500">Тема письма</Label>
              <Input
                value={bulkEmailForm.subject}
                onChange={(e) => setBulkEmailForm({ ...bulkEmailForm, subject: e.target.value })}
                placeholder="Специальное предложение от AVOPT.STORE!"
                className="mt-1"
                data-testid="bulk-email-subject"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase text-zinc-500">Содержание письма (HTML)</Label>
              <Textarea
                value={bulkEmailForm.html_content}
                onChange={(e) => setBulkEmailForm({ ...bulkEmailForm, html_content: e.target.value })}
                placeholder="<p>Уважаемые клиенты!</p><p>Рады сообщить вам о...</p>"
                className="mt-1 min-h-[150px] font-mono text-sm"
                data-testid="bulk-email-content"
              />
              <p className="text-xs text-zinc-400 mt-1">Поддерживается HTML-разметка. Письмо будет оформлено в фирменном стиле.</p>
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
              <p className="text-sm text-yellow-600 text-center">Промо-рассылки отключены в настройках</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
