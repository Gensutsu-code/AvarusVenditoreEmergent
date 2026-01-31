import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Pencil, Save, X, Gift, TrendingUp, Award, History, Copy, CheckCircle, Camera, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Animated Progress Bar Component
const BonusProgressBar = ({ percentage, currentAmount, goalAmount }) => {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(percentage), 100);
    return () => clearTimeout(timer);
  }, [percentage]);
  
  return (
    <div className="relative">
      <div className="h-6 bg-zinc-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${animatedWidth}%` }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
        </div>
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <span className="font-mono font-semibold text-orange-600">{currentAmount.toFixed(0)} ₽</span>
        <span className="text-zinc-400">из {goalAmount.toFixed(0)} ₽</span>
      </div>
    </div>
  );
};

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    address: ''
  });
  
  // Bonus state
  const [bonusProgress, setBonusProgress] = useState(null);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [loadingBonus, setLoadingBonus] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    setProfileForm({
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || ''
    });
    fetchBonusData();
  }, [user, navigate]);

  const fetchBonusData = async () => {
    try {
      const [progressRes, historyRes] = await Promise.all([
        axios.get(`${API}/bonus/progress`),
        axios.get(`${API}/bonus/history`)
      ]);
      setBonusProgress(progressRes.data);
      setBonusHistory(historyRes.data.history || []);
    } catch (err) {
      console.error('Failed to fetch bonus data', err);
    } finally {
      setLoadingBonus(false);
    }
  };

  const handleClaimBonus = async () => {
    setClaiming(true);
    try {
      const res = await axios.post(`${API}/bonus/claim`);
      toast.success(res.data.message);
      fetchBonusData(); // Refresh data
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка получения бонуса');
    } finally {
      setClaiming(false);
    }
  };

  const copyPromoCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Промокод скопирован');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Изображение слишком большое (макс. 5МБ)');
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
      if (refreshUser) {
        await refreshUser();
      }
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
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/auth/profile`, profileForm);
      toast.success('Профиль обновлён');
      setIsEditing(false);
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setProfileForm({
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || ''
    });
    setIsEditing(false);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="account-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900">
            Личный кабинет
          </h1>
        </div>

        <div className="grid gap-6">
          {/* User info */}
          <div className="border border-zinc-200 p-6 bg-white">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                {/* Avatar with upload */}
                <div className="relative group">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <div className="w-16 h-16 bg-zinc-100 flex items-center justify-center rounded-full overflow-hidden border-2 border-zinc-200">
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url.startsWith('http') ? user.avatar_url : `${BACKEND_URL}${user.avatar_url}`} 
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-zinc-400" />
                    )}
                  </div>
                  {/* Avatar actions on hover */}
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white"
                      title="Загрузить фото"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                    {user.avatar_url && (
                      <button
                        onClick={handleDeleteAvatar}
                        className="p-1.5 bg-white/20 hover:bg-red-500/50 rounded-full text-white"
                        title="Удалить фото"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                
                {!isEditing && (
                  <div>
                    <h2 className="font-semibold text-zinc-900" data-testid="user-name">{user.name}</h2>
                    <p className="text-sm text-zinc-500" data-testid="user-email">{user.email}</p>
                    {user.phone && <p className="text-sm text-zinc-500">{user.phone}</p>}
                    {user.address && <p className="text-sm text-zinc-500">{user.address}</p>}
                  </div>
                )}
              </div>
              {!isEditing && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  data-testid="edit-profile-btn"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Редактировать
                </Button>
              )}
            </div>

            {isEditing && (
              <div className="space-y-4" data-testid="profile-edit-form">
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Имя</Label>
                  <Input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="Ваше имя"
                    className="mt-1"
                    data-testid="profile-name-input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Телефон</Label>
                  <Input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="+7 (___) ___-__-__"
                    className="mt-1"
                    data-testid="profile-phone-input"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-zinc-500">Адрес доставки</Label>
                  <Input
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="Город, улица, дом, квартира"
                    className="mt-1"
                    data-testid="profile-address-input"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={saving}
                    className="bg-orange-500 hover:bg-orange-600"
                    data-testid="save-profile-btn"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <X className="w-4 h-4 mr-2" />
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bonus Program Section */}
          {bonusProgress && bonusProgress.enabled && (
            <div className="border border-zinc-200 bg-white overflow-hidden" data-testid="bonus-section">
              {/* Bonus Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Бонусная программа</h3>
                    <p className="text-orange-100 text-sm">Накопите {bonusProgress.goal_amount} ₽ и получите промокод на {bonusProgress.reward_value} ₽</p>
                  </div>
                </div>
              </div>
              
              {/* Progress Section */}
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700">Ваш прогресс</span>
                    <span className="text-lg font-bold text-orange-600">{bonusProgress.percentage.toFixed(0)}%</span>
                  </div>
                  <BonusProgressBar 
                    percentage={bonusProgress.percentage} 
                    currentAmount={bonusProgress.current_amount}
                    goalAmount={bonusProgress.goal_amount}
                  />
                </div>
                
                {/* Info cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-zinc-50 p-3 rounded-lg text-center">
                    <TrendingUp className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                    <p className="text-xs text-zinc-500">Всего накоплено</p>
                    <p className="font-bold text-zinc-900">{bonusProgress.total_earned.toFixed(0)} ₽</p>
                  </div>
                  <div className="bg-zinc-50 p-3 rounded-lg text-center">
                    <Award className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                    <p className="text-xs text-zinc-500">Бонусов получено</p>
                    <p className="font-bold text-zinc-900">{bonusProgress.rewards_claimed}</p>
                  </div>
                  <div className="bg-zinc-50 p-3 rounded-lg text-center">
                    <Gift className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                    <p className="text-xs text-zinc-500">Начисление</p>
                    <p className="font-bold text-zinc-900">{bonusProgress.contribution_percent}% от заказа</p>
                  </div>
                </div>
                
                {/* Claim button */}
                {bonusProgress.can_claim ? (
                  <Button 
                    onClick={handleClaimBonus}
                    disabled={claiming}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3"
                    data-testid="claim-bonus-btn"
                  >
                    <Gift className="w-5 h-5 mr-2" />
                    {claiming ? 'Получение...' : `Получить бонус ${bonusProgress.reward_value} ₽!`}
                  </Button>
                ) : (
                  <div className="text-center p-4 bg-zinc-50 rounded-lg">
                    <p className="text-sm text-zinc-500">
                      До бонуса осталось накопить: <span className="font-bold text-orange-600">{(bonusProgress.goal_amount - bonusProgress.current_amount).toFixed(0)} ₽</span>
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Это примерно {Math.ceil((bonusProgress.goal_amount - bonusProgress.current_amount) / (bonusProgress.contribution_percent / 100) / 1000)} заказов по 1000 ₽
                    </p>
                  </div>
                )}
              </div>
              
              {/* Bonus History */}
              {bonusHistory.length > 0 && (
                <div className="border-t border-zinc-200">
                  <button 
                    className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-zinc-50 transition-colors"
                    onClick={() => document.getElementById('bonus-history').classList.toggle('hidden')}
                  >
                    <span className="flex items-center gap-2 font-medium text-sm">
                      <History className="w-4 h-4 text-zinc-400" />
                      История бонусов ({bonusHistory.length})
                    </span>
                    <span className="text-zinc-400">▼</span>
                  </button>
                  
                  <div id="bonus-history" className="hidden border-t border-zinc-100">
                    {bonusHistory.map((item) => (
                      <div key={item.id} className="px-6 py-3 flex items-center justify-between border-b border-zinc-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium">
                            {item.reward_type === 'gift' ? '🎁 Подарочный бонус' : '🏆 Бонус за накопления'}
                          </p>
                          <p className="text-xs text-zinc-400">{formatDate(item.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-green-600">+{item.reward_value} ₽</span>
                          <button
                            onClick={() => copyPromoCode(item.promo_code)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
                              copiedCode === item.promo_code 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                            data-testid={`copy-promo-${item.id}`}
                          >
                            {copiedCode === item.promo_code ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {item.promo_code}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading state for bonus */}
          {loadingBonus && (
            <div className="border border-zinc-200 p-6 bg-white animate-pulse">
              <div className="h-4 bg-zinc-200 rounded w-1/3 mb-4"></div>
              <div className="h-6 bg-zinc-200 rounded w-full mb-4"></div>
              <div className="h-4 bg-zinc-200 rounded w-1/2"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
