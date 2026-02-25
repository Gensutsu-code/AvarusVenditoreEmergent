import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Lock, Phone, MapPin, Save, Eye, EyeOff, Camera, Trash2, MessageSquare, Wallet, CreditCard, Plus, History, Sparkles, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AccountPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    address_comment: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  
  // Balance states
  const [balance, setBalance] = useState(0);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupMethod, setTopupMethod] = useState('card');
  const [cryptoChain, setCryptoChain] = useState('eth');
  const [cryptoWallets, setCryptoWallets] = useState({});
  const [prepaymentSettings, setPrepaymentSettings] = useState({});
  const [topupLoading, setTopupLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role === 'admin') {
      navigate('/admin/profile');
      return;
    }
    setFormData(prev => ({
      ...prev,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      address_comment: user.address_comment || ''
    }));
    
    fetchBalance();
    fetchPrepaymentSettings();
    fetchCryptoWallets();
  }, [user, authLoading, navigate]);

  const fetchBalance = async () => {
    try {
      const res = await axios.get(`${API}/user/balance`);
      setBalance(res.data.balance || 0);
    } catch (err) {}
  };

  const fetchBalanceHistory = async () => {
    try {
      const res = await axios.get(`${API}/user/balance/history`);
      setBalanceHistory(res.data.transactions || []);
    } catch (err) {}
  };

  const fetchPrepaymentSettings = async () => {
    try {
      const res = await axios.get(`${API}/prepayment-settings`);
      setPrepaymentSettings(res.data);
    } catch (err) {}
  };

  const fetchCryptoWallets = async () => {
    try {
      const res = await axios.get(`${API}/crypto-wallets`);
      setCryptoWallets(res.data);
    } catch (err) {}
  };

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount);
    if (!amount || amount < (prepaymentSettings.min_topup_amount || 500)) {
      toast.error(`Минимальная сумма: ${prepaymentSettings.min_topup_amount || 500}₽`);
      return;
    }
    if (amount > (prepaymentSettings.max_topup_amount || 100000)) {
      toast.error(`Максимальная сумма: ${prepaymentSettings.max_topup_amount || 100000}₽`);
      return;
    }
    
    setTopupLoading(true);
    try {
      const res = await axios.post(`${API}/user/balance/topup`, {
        amount,
        method: topupMethod,
        crypto_chain: topupMethod === 'crypto' ? cryptoChain : null
      });
      
      if (res.data.status === 'completed') {
        toast.success(res.data.message);
        setBalance(res.data.new_balance);
        setShowTopupModal(false);
        setTopupAmount('');
      } else if (res.data.status === 'pending') {
        toast.info(`Переведите средства на адрес и подтвердите транзакцию`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка пополнения');
    } finally {
      setTopupLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/auth/profile`, {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        address_comment: formData.address_comment
      });
      toast.success('Профиль обновлён');
      refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!formData.current_password || !formData.new_password) {
      toast.error('Заполните все поля пароля');
      return;
    }
    if (formData.new_password !== formData.confirm_password) {
      toast.error('Пароли не совпадают');
      return;
    }
    if (formData.new_password.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/auth/profile`, {
        current_password: formData.current_password,
        new_password: formData.new_password
      });
      toast.success('Пароль изменён');
      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка смены пароля');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/users/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Фото обновлено');
      refreshUser();
    } catch (err) {
      toast.error('Ошибка загрузки фото');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm('Удалить фото профиля?')) return;
    
    try {
      await axios.delete(`${API}/users/avatar`);
      toast.success('Фото удалено');
      refreshUser();
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-950' : ''}`}>
        <motion.div 
          className={`w-8 h-8 border-2 ${isDark ? 'border-orange-500' : 'border-green-500'} border-t-transparent rounded-full`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : ''}`} data-testid="account-page">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className={`absolute top-20 right-20 w-96 h-96 rounded-full ${isDark ? 'bg-orange-500/5' : 'bg-green-400/20'} blur-3xl`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className={`absolute bottom-20 left-20 w-80 h-80 rounded-full ${isDark ? 'bg-purple-500/5' : 'bg-pink-400/20'} blur-3xl`}
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.h1 
          className={`text-2xl md:text-3xl font-bold tracking-tight uppercase mb-8 ${isDark ? 'text-white' : 'text-slate-800'}`}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className={`bg-gradient-to-r ${isDark ? 'from-orange-400 to-orange-600' : 'from-green-500 to-emerald-600'} bg-clip-text text-transparent`}>
            Мой профиль
          </span>
        </motion.h1>

        <div className="space-y-6">
          {/* Balance Card */}
          {prepaymentSettings.prepayment_enabled !== false && (
            <motion.div 
              className="glass-card p-6 relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {/* Animated gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-purple-500/10 to-transparent" />
              <motion.div 
                className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
              
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-purple-300/80 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Баланс
                  </p>
                  <motion.p 
                    className="text-4xl font-bold mt-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent"
                    data-testid="balance-amount"
                    key={balance}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {balance.toLocaleString('ru-RU')} ₽
                  </motion.p>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => { fetchBalanceHistory(); setShowHistoryModal(true); }}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-purple-300 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    data-testid="balance-history-btn"
                  >
                    <History className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    onClick={() => setShowTopupModal(true)}
                    className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all duration-300"
                    whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(168, 85, 247, 0.4)' }}
                    whileTap={{ scale: 0.98 }}
                    data-testid="topup-btn"
                  >
                    <Plus className="w-4 h-4" />
                    Пополнить
                  </motion.button>
                </div>
              </div>
              <p className="relative text-purple-300/60 text-xs mt-4">
                Оплачивайте заказы с баланса без комиссии
              </p>
            </motion.div>
          )}

          {/* Avatar & Profile Info Card */}
          <motion.div 
            className="glass-card overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-r from-orange-600/30 via-orange-500/20 to-transparent px-6 py-8">
              <motion.div 
                className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 5, repeat: Infinity }}
              />
              
              <div className="relative flex items-center gap-5">
                {/* Avatar */}
                <motion.div 
                  className="relative group"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-24 h-24 rounded-2xl bg-zinc-800/80 backdrop-blur-sm flex items-center justify-center overflow-hidden border-2 border-orange-500/30 shadow-lg shadow-orange-500/10">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-orange-400/60" />
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <AnimatePresence>
                    <motion.div 
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 rounded-2xl"
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                    >
                      <div className="flex gap-2">
                        <motion.button
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="p-2 bg-orange-500/80 rounded-xl text-white hover:bg-orange-500"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Camera className="w-5 h-5" />
                        </motion.button>
                        {user?.avatar_url && (
                          <motion.button
                            onClick={handleDeleteAvatar}
                            className="p-2 bg-red-500/80 rounded-xl text-white hover:bg-red-500"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 className="w-5 h-5" />
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
                
                <div>
                  <h2 className="text-2xl font-bold text-white">{user?.name || 'Пользователь'}</h2>
                  <p className="text-orange-300/70 text-sm mt-1">{user?.email}</p>
                </div>
              </div>
            </div>
            
            {/* Form fields */}
            <div className="p-6 space-y-5">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" />
                  Имя
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Введите имя"
                  className="glass-input h-12 text-white placeholder:text-zinc-500"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  value={formData.email}
                  disabled
                  className="glass-input h-12 text-zinc-400 bg-zinc-800/30 cursor-not-allowed"
                />
                <p className="text-xs text-zinc-600 mt-1">Email нельзя изменить</p>
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4" />
                  Телефон
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+7 (XXX) XXX-XX-XX"
                  className="glass-input h-12 text-white placeholder:text-zinc-500"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4" />
                  Адрес доставки
                </Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Город, улица, дом, квартира"
                  className="glass-input h-12 text-white placeholder:text-zinc-500"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4" />
                  Комментарий к адресу
                </Label>
                <Textarea
                  value={formData.address_comment}
                  onChange={(e) => setFormData({ ...formData, address_comment: e.target.value })}
                  placeholder="Код домофона, этаж, ориентиры..."
                  className="glass-input min-h-[80px] text-white placeholder:text-zinc-500"
                />
              </div>
              
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Button 
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold uppercase tracking-wide rounded-xl shadow-lg shadow-orange-500/20 transition-all duration-300"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить изменения'}
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Password Change Card */}
          <motion.div 
            className="glass-card overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="relative bg-gradient-to-r from-zinc-800/50 to-transparent px-6 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-zinc-700/50 flex items-center justify-center border border-zinc-600/30">
                    <Shield className="w-7 h-7 text-zinc-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Безопасность</h2>
                    <p className="text-zinc-500 text-sm">Смена пароля</p>
                  </div>
                </div>
                <motion.button
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </motion.button>
              </div>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Текущий пароль</Label>
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={formData.current_password}
                  onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                  placeholder="••••••••"
                  className="glass-input h-12 text-white placeholder:text-zinc-600"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Новый пароль</Label>
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={formData.new_password}
                  onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                  placeholder="Минимум 6 символов"
                  className="glass-input h-12 text-white placeholder:text-zinc-600"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Подтвердите новый пароль</Label>
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  placeholder="Повторите пароль"
                  className="glass-input h-12 text-white placeholder:text-zinc-600"
                />
              </div>
              
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Button 
                  onClick={handleChangePassword}
                  disabled={saving || !formData.current_password || !formData.new_password}
                  variant="outline"
                  className="w-full h-12 border-zinc-700 text-zinc-300 hover:bg-zinc-800/50 rounded-xl font-medium transition-all duration-300"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {saving ? 'Изменение...' : 'Изменить пароль'}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Topup Modal */}
      <Dialog open={showTopupModal} onOpenChange={setShowTopupModal}>
        <DialogContent className="max-w-md bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl" data-testid="topup-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              Пополнение баланса
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-5 mt-4">
            <div>
              <Label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Сумма пополнения (₽)</Label>
              <Input
                type="number"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder={`Мин. ${prepaymentSettings.min_topup_amount || 500}₽`}
                className="glass-input h-14 text-xl text-white placeholder:text-zinc-600"
                data-testid="topup-amount-input"
              />
              <p className="text-xs text-zinc-500 mt-2">
                Мин: {prepaymentSettings.min_topup_amount || 500}₽ / Макс: {(prepaymentSettings.max_topup_amount || 100000).toLocaleString('ru-RU')}₽
              </p>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2 flex-wrap">
              {[1000, 3000, 5000, 10000].map(amount => (
                <motion.button
                  key={amount}
                  onClick={() => setTopupAmount(amount.toString())}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                    topupAmount === amount.toString() 
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' 
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                  } border`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {amount.toLocaleString('ru-RU')}₽
                </motion.button>
              ))}
            </div>

            <div>
              <Label className="text-xs font-bold uppercase text-zinc-500 mb-3 block">Способ оплаты</Label>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => setTopupMethod('card')}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all duration-300 ${
                    topupMethod === 'card' 
                      ? 'bg-purple-500/10 border-purple-500/50' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid="topup-card-method"
                >
                  <CreditCard className={`w-6 h-6 ${topupMethod === 'card' ? 'text-purple-400' : 'text-zinc-500'}`} />
                  <span className={`text-sm font-medium ${topupMethod === 'card' ? 'text-purple-300' : 'text-zinc-400'}`}>Карта</span>
                  <span className="text-xs text-zinc-600">Моментально</span>
                </motion.button>
                <motion.button
                  onClick={() => setTopupMethod('crypto')}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all duration-300 ${
                    topupMethod === 'crypto' 
                      ? 'bg-purple-500/10 border-purple-500/50' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid="topup-crypto-method"
                >
                  <Wallet className={`w-6 h-6 ${topupMethod === 'crypto' ? 'text-purple-400' : 'text-zinc-500'}`} />
                  <span className={`text-sm font-medium ${topupMethod === 'crypto' ? 'text-purple-300' : 'text-zinc-400'}`}>Криптовалюта</span>
                  <span className="text-xs text-zinc-600">USDT, ETH</span>
                </motion.button>
              </div>
            </div>

            {topupMethod === 'crypto' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Сеть</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'eth', name: 'ETH', address: cryptoWallets.eth_address },
                    { id: 'bsc', name: 'BSC', address: cryptoWallets.bsc_address },
                    { id: 'base', name: 'Base', address: cryptoWallets.base_address },
                    { id: 'trc', name: 'TRC20', address: cryptoWallets.trc_address }
                  ].filter(c => c.address).map(chain => (
                    <motion.button
                      key={chain.id}
                      onClick={() => setCryptoChain(chain.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                        cryptoChain === chain.id 
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' 
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                      } border`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {chain.name}
                    </motion.button>
                  ))}
                </div>
                {cryptoWallets[`${cryptoChain}_address`] && (
                  <div className="mt-3 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                    <p className="text-xs text-zinc-500 mb-1">Адрес для перевода:</p>
                    <p className="font-mono text-xs break-all text-zinc-300 select-all">
                      {cryptoWallets[`${cryptoChain}_address`]}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Button
                onClick={handleTopup}
                disabled={topupLoading || !topupAmount}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all duration-300"
                data-testid="confirm-topup-btn"
              >
                {topupLoading ? 'Обработка...' : `Пополнить на ${topupAmount ? parseFloat(topupAmount).toLocaleString('ru-RU') : 0}₽`}
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl" data-testid="history-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <History className="w-5 h-5 text-white" />
              </div>
              История баланса
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto mt-4">
            {balanceHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-zinc-500">История операций пуста</p>
              </div>
            ) : (
              <div className="space-y-3">
                {balanceHistory.map((tx, index) => (
                  <motion.div 
                    key={tx.id} 
                    className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/30"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        tx.type === 'topup' ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}>
                        {tx.type === 'topup' ? (
                          <Plus className="w-5 h-5 text-green-400" />
                        ) : (
                          <CreditCard className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-200">{tx.description || tx.type}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(tx.created_at).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    </div>
                    <div className={`font-bold text-lg ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('ru-RU')}₽
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
