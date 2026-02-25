import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Save, Send } from 'lucide-react';

export default function TelegramTab({
  telegramSettings,
  setTelegramSettings,
  handleSaveTelegram,
  handleTestTelegram,
  isDark = false
}) {
  return (
    <div className="p-6">
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
          <Button onClick={handleSaveTelegram} className="bg-orange-500 hover:bg-orange-600">
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
    </div>
  );
}
