import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Save, Mail, Send, Bell, Users, Search, CheckSquare, Square, X } from 'lucide-react';

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
  const [sendMode, setSendMode] = useState('all'); // 'all' or 'selected'
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  const filteredUsers = (users || []).filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const toggleUser = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAll = () => {
    setSelectedUserIds(filteredUsers.map(u => u.id));
  };

  const deselectAll = () => {
    setSelectedUserIds([]);
  };

  const handleSend = () => {
    if (sendMode === 'selected' && selectedUserIds.length > 0) {
      handleSendBulkEmail(selectedUserIds);
    } else {
      handleSendBulkEmail(null);
    }
  };

  const recipientCount = sendMode === 'all' ? (users || []).length : selectedUserIds.length;

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

            {/* Send Mode Toggle */}
            <div className={`rounded-lg p-4 ${isDark ? 'bg-zinc-900/50 border border-zinc-700/50' : 'bg-zinc-50 border border-zinc-200'}`}>
              <Label className={`text-xs font-bold uppercase mb-3 block ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                Получатели
              </Label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => { setSendMode('all'); setSelectedUserIds([]); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    sendMode === 'all'
                      ? 'bg-purple-500 text-white'
                      : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                  }`}
                  data-testid="send-mode-all"
                >
                  <Users className="w-4 h-4" />
                  Все ({(users || []).length})
                </button>
                <button
                  onClick={() => setSendMode('selected')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    sendMode === 'selected'
                      ? 'bg-purple-500 text-white'
                      : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                  }`}
                  data-testid="send-mode-selected"
                >
                  <CheckSquare className="w-4 h-4" />
                  Выборочно {selectedUserIds.length > 0 && `(${selectedUserIds.length})`}
                </button>
              </div>

              {/* User Selection List */}
              {sendMode === 'selected' && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                      <Input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Поиск по имени или email..."
                        className={`pl-8 h-8 text-sm ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600' : ''}`}
                        data-testid="user-search-input"
                      />
                      {userSearch && (
                        <button 
                          onClick={() => setUserSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                        >
                          <X className={`w-3 h-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={selectAll}
                      className={`text-xs px-2 py-1 rounded ${isDark ? 'text-teal-400 hover:bg-zinc-700' : 'text-teal-600 hover:bg-teal-50'}`}
                      data-testid="select-all-users"
                    >
                      Выбрать все
                    </button>
                    <button
                      onClick={deselectAll}
                      className={`text-xs px-2 py-1 rounded ${isDark ? 'text-zinc-400 hover:bg-zinc-700' : 'text-zinc-500 hover:bg-zinc-100'}`}
                      data-testid="deselect-all-users"
                    >
                      Сбросить
                    </button>
                  </div>

                  <div className={`max-h-48 overflow-y-auto rounded-lg border ${isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-zinc-200 bg-white'}`}>
                    {filteredUsers.length === 0 ? (
                      <p className={`text-center py-4 text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        Пользователи не найдены
                      </p>
                    ) : (
                      filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => toggleUser(u.id)}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors border-b last:border-b-0 ${
                            isDark ? 'border-zinc-700/50 hover:bg-zinc-700/50' : 'border-zinc-100 hover:bg-zinc-50'
                          } ${selectedUserIds.includes(u.id) ? (isDark ? 'bg-purple-500/10' : 'bg-purple-50') : ''}`}
                          data-testid={`user-select-${u.id}`}
                        >
                          {selectedUserIds.includes(u.id) ? (
                            <CheckSquare className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          ) : (
                            <Square className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                              {u.name || 'Без имени'}
                            </p>
                            <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                              {u.email}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedUserIds.length > 0 && (
                    <p className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                      Выбрано: {selectedUserIds.length} из {(users || []).length}
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={handleSend}
              disabled={sendingEmail || !notificationSettings.resend_configured || !notificationSettings.promotions_enabled || (sendMode === 'selected' && selectedUserIds.length === 0)}
              className="w-full bg-purple-500 hover:bg-purple-600"
              data-testid="send-bulk-email-btn"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendingEmail ? 'Отправка...' : `Отправить (${recipientCount} получателей)`}
            </Button>
            {!notificationSettings.promotions_enabled && (
              <p className={`text-sm text-center ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>Промо-рассылки отключены в настройках</p>
            )}
            {sendMode === 'selected' && selectedUserIds.length === 0 && (
              <p className={`text-sm text-center ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Выберите хотя бы одного получателя</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
