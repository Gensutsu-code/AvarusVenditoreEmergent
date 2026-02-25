import { useState, useEffect } from 'react';
import axios from 'axios';
import { Wallet, Save, RefreshCw, ExternalLink, Check, AlertCircle, Copy, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SUPPORTED_CHAINS = [
  { id: 'bsc', name: 'BNB Smart Chain', explorer: 'https://bscscan.com/address/' },
  { id: 'base', name: 'Base', explorer: 'https://basescan.org/address/' },
  { id: 'polygon', name: 'Polygon', explorer: 'https://polygonscan.com/address/' }
];

export default function CryptoSettingsTab() {
  const [settings, setSettings] = useState({
    receiving_address: '',
    markup_percent: 3.0,
    crypto_enabled: true
  });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentRate, setCurrentRate] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchPayments();
    fetchCurrentRate();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API}/admin/crypto/settings`);
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to fetch crypto settings:', err);
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/crypto/payments?limit=20`);
      setPayments(res.data.payments || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentRate = async () => {
    try {
      const res = await axios.get(`${API}/crypto/price?amount_rub=1000`);
      setCurrentRate(res.data.rate);
    } catch (err) {
      console.error('Failed to fetch rate:', err);
    }
  };

  const handleSave = async () => {
    if (!settings.receiving_address) {
      toast.error('Укажите адрес кошелька для получения платежей');
      return;
    }

    // Basic address validation
    if (!settings.receiving_address.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error('Некорректный формат адреса кошелька (должен начинаться с 0x)');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/admin/crypto/settings`, settings);
      toast.success('Настройки криптоплатежей сохранены');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано!');
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('ru-RU');
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      failed: 'bg-red-100 text-red-700'
    };
    const labels = {
      completed: 'Оплачен',
      pending: 'Ожидает',
      failed: 'Ошибка'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="crypto-settings-tab">
      {/* Settings Section */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Настройки криптоплатежей</h2>
              <p className="text-teal-100 text-sm">USDT/USDC на BSC, Base, Polygon</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg">
            <div>
              <p className="font-medium">Криптоплатежи включены</p>
              <p className="text-sm text-zinc-500">Разрешить оплату через MetaMask</p>
            </div>
            <Switch
              checked={settings.crypto_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, crypto_enabled: checked })}
              data-testid="crypto-enabled-switch"
            />
          </div>

          {/* Receiving Address */}
          <div>
            <Label className="text-xs font-bold uppercase text-zinc-500">
              Адрес кошелька для получения платежей
            </Label>
            <p className="text-xs text-zinc-400 mb-2">
              Этот адрес будет использоваться для всех сетей (BSC, Base, Polygon)
            </p>
            <div className="flex gap-2">
              <Input
                value={settings.receiving_address}
                onChange={(e) => setSettings({ ...settings, receiving_address: e.target.value })}
                placeholder="0x..."
                className="font-mono"
                data-testid="receiving-address-input"
              />
              {settings.receiving_address && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(settings.receiving_address)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
            {settings.receiving_address && (
              <div className="flex gap-2 mt-2">
                {SUPPORTED_CHAINS.map(chain => (
                  <a
                    key={chain.id}
                    href={`${chain.explorer}${settings.receiving_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                  >
                    {chain.name} <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Markup */}
          <div>
            <Label className="text-xs font-bold uppercase text-zinc-500">
              Наценка к курсу (%)
            </Label>
            <div className="flex items-center gap-4 mt-2">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={settings.markup_percent || 3}
                onChange={(e) => setSettings({ ...settings, markup_percent: parseFloat(e.target.value) || 0 })}
                className="w-24"
                data-testid="markup-input"
              />
              {currentRate && (
                <p className="text-sm text-zinc-500">
                  Текущий курс: 1 USD = {currentRate.toFixed(2)} ₽
                </p>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Рекомендуется 3-5% для покрытия комиссий и волатильности
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-teal-500 hover:bg-teal-600"
            data-testid="save-crypto-settings-btn"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Как это работает
        </h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Клиент выбирает криптоплатёж и подключает MetaMask</li>
          <li>Система автоматически конвертирует сумму в USDT/USDC по курсу CoinGecko</li>
          <li>После оплаты транзакция автоматически верифицируется в блокчейне</li>
          <li>Средства поступают напрямую на ваш кошелёк</li>
        </ul>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-500" />
            Последние криптоплатежи
          </h3>
          <Button variant="outline" size="sm" onClick={fetchPayments} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>

        <div className="divide-y divide-zinc-100">
          {payments.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Криптоплатежей пока нет</p>
            </div>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="p-4 hover:bg-zinc-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{payment.user_name || payment.user_email}</span>
                      {getStatusBadge(payment.status)}
                    </div>
                    <p className="text-sm text-zinc-500">
                      {payment.token_amount?.toFixed(2)} {payment.token?.toUpperCase()} на {payment.chain?.toUpperCase()}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {formatDate(payment.created_at)}
                    </p>
                    {payment.tx_hash && (
                      <a
                        href={`https://${payment.chain === 'bsc' ? 'bscscan.com' : payment.chain === 'base' ? 'basescan.org' : 'polygonscan.com'}/tx/${payment.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"
                      >
                        TX: {payment.tx_hash.slice(0, 16)}... <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{payment.amount_usd?.toFixed(2)} USD</p>
                    <p className="text-sm text-zinc-500">{payment.amount_rub?.toLocaleString('ru-RU')} ₽</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
