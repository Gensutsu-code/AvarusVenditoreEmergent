import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Pencil, Save, X, Gift, History, Copy, CheckCircle, Camera, Trash2, Clock, Send, Mail, Lock, Phone, MapPin, Award } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Animated Progress Bar Component for Yearly Orders
const YearlyProgressBar = ({ currentAmount, yearGoal = 100000 }) => {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const percentage = Math.min(100, (currentAmount / yearGoal) * 100);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(percentage), 100);
    return () => clearTimeout(timer);
  }, [percentage]);
  
  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price);
  
  return (
    <div className="relative">
      <div className="h-6 bg-zinc-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-green-400 via-green-500 to-green-600 rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${animatedWidth}%` }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
        </div>
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <span className="font-mono font-semibold text-green-600">{formatPrice(currentAmount)} ₽</span>
        <span className="text-zinc-400">цель: {formatPrice(yearGoal)} ₽</span>
      </div>
    </div>
  );
};

export default function AccountPage() {
  const { user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  
  // Bonus state
  const [bonusPrograms, setBonusPrograms] = useState([]);
  const [bonusHistory, setBonusHistory] = useState([]);
  const [loadingBonus, setLoadingBonus] = useState(true);
  const [requestingBonus, setRequestingBonus] = useState({});
  const [copiedCode, setCopiedCode] = useState(null);
  const [redeemingPrize, setRedeemingPrize] = useState({});
  const [expandedProgram, setExpandedProgram] = useState(null);

  useEffect(() => {
    // Wait for auth loading to complete before checking user
    if (loading) return;
    
    if (!user) {
      navigate('/login');
      return;
    }
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
    fetchBonusData();
  }, [user, loading, navigate]);

  const fetchBonusData = async () => {
    try {
      const [programsRes, historyRes] = await Promise.all([
        axios.get(`${API}/bonus/programs`),
        axios.get(`${API}/bonus/history`)
      ]);
      setBonusPrograms(programsRes.data.programs || []);
      setBonusHistory(historyRes.data.history || []);
    } catch (err) {
      console.error('Failed to fetch bonus data', err);
    } finally {
      setLoadingBonus(false);
    }
  };

  const handleRequestBonus = async (programId) => {
    setRequestingBonus(prev => ({ ...prev, [programId]: true }));
    try {
      const res = await axios.post(`${API}/bonus/request/${programId}`);
      toast.success(res.data.message);
      fetchBonusData(); // Refresh data
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки запроса');
    } finally {
      setRequestingBonus(prev => ({ ...prev, [programId]: false }));
    }
  };

  const handleRedeemPrize = async (programId, prizeId, prizeName, pointsCost) => {
    if (!window.confirm(`Обменять ${pointsCost} баллов на «${prizeName}»?`)) return;
    
    const key = `${programId}_${prizeId}`;
    setRedeemingPrize(prev => ({ ...prev, [key]: true }));
    try {
      const res = await axios.post(`${API}/bonus/redeem-prize/${programId}/${prizeId}`);
      toast.success(res.data.message);
      fetchBonusData(); // Refresh data
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка обмена');
    } finally {
      setRedeemingPrize(prev => ({ ...prev, [key]: false }));
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
    // Validate password fields if changing password
    if (formData.new_password || formData.current_password) {
      if (!formData.current_password) {
        toast.error('Введите текущий пароль');
        return;
      }
      if (!formData.new_password) {
        toast.error('Введите новый пароль');
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
    }

    setSaving(true);
    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address
      };
      
      // Only include password fields if changing password
      if (formData.new_password) {
        updateData.current_password = formData.current_password;
        updateData.new_password = formData.new_password;
      }
      
      await axios.put(`${API}/auth/profile`, updateData);
      toast.success('Профиль обновлён');
      setIsEditing(false);
      setShowPasswordFields(false);
      setFormData(prev => ({...prev, current_password: '', new_password: '', confirm_password: ''}));
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
    setShowPasswordFields(false);
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
          {/* User Profile Card - Enhanced */}
          <div className="border border-zinc-200 bg-white overflow-hidden">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-6 py-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Large Avatar */}
                <div className="relative group flex-shrink-0">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <div className="w-24 h-24 sm:w-28 sm:h-28 bg-zinc-700 flex items-center justify-center rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url.startsWith('http') ? user.avatar_url : `${BACKEND_URL}${user.avatar_url}`} 
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-12 h-12 text-zinc-400" />
                    )}
                  </div>
                  {/* Avatar actions on hover */}
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => avatarInputRef.current?.click()}>
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  {user.avatar_url && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteAvatar(); }}
                      className="absolute -bottom-1 -right-1 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-lg"
                      title="Удалить фото"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center">
                      <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                
                {/* User Info - Large & Prominent */}
                {!isEditing && (
                  <div className="text-center sm:text-left flex-1">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2" data-testid="user-name">
                      {user.name}
                    </h2>
                    <div className="space-y-1.5">
                      <p className="text-zinc-300 flex items-center justify-center sm:justify-start gap-2">
                        <Mail className="w-4 h-4" />
                        <span data-testid="user-email">{user.email}</span>
                      </p>
                      {user.phone && (
                        <p className="text-zinc-300 flex items-center justify-center sm:justify-start gap-2">
                          <Phone className="w-4 h-4" />
                          <span>{user.phone}</span>
                        </p>
                      )}
                      {user.address && (
                        <p className="text-zinc-400 flex items-center justify-center sm:justify-start gap-2 text-sm">
                          <MapPin className="w-4 h-4" />
                          <span>{user.address}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Small Edit Button */}
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="absolute top-4 right-4 sm:static p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    data-testid="edit-profile-btn"
                    title="Редактировать профиль"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Edit Form */}
            {isEditing && (
              <div className="p-6 space-y-5" data-testid="profile-edit-form">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-1">
                      <User className="w-3 h-3" /> ФИО
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ваше полное имя"
                      className="mt-1"
                      data-testid="profile-name-input"
                    />
                  </div>
                  
                  {/* Email */}
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      className="mt-1"
                      data-testid="profile-email-input"
                    />
                  </div>
                  
                  {/* Phone */}
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Телефон
                    </Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+7 (___) ___-__-__"
                      className="mt-1"
                      data-testid="profile-phone-input"
                    />
                  </div>
                  
                  {/* Address */}
                  <div>
                    <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Адрес доставки
                    </Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Город, улица, дом, квартира"
                      className="mt-1"
                      data-testid="profile-address-input"
                    />
                  </div>
                </div>
                
                {/* Password Change Section */}
                <div className="border-t border-zinc-200 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordFields(!showPasswordFields)}
                    className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900"
                  >
                    <Lock className="w-4 h-4" />
                    {showPasswordFields ? 'Скрыть смену пароля' : 'Сменить пароль'}
                  </button>
                  
                  {showPasswordFields && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <Label className="text-xs font-bold uppercase text-zinc-500">Текущий пароль</Label>
                        <Input
                          type="password"
                          value={formData.current_password}
                          onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                          placeholder="••••••••"
                          className="mt-1"
                          data-testid="profile-current-password-input"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold uppercase text-zinc-500">Новый пароль</Label>
                        <Input
                          type="password"
                          value={formData.new_password}
                          onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                          placeholder="••••••••"
                          className="mt-1"
                          data-testid="profile-new-password-input"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold uppercase text-zinc-500">Подтвердите пароль</Label>
                        <Input
                          type="password"
                          value={formData.confirm_password}
                          onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                          placeholder="••••••••"
                          className="mt-1"
                          data-testid="profile-confirm-password-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={saving}
                    className="bg-orange-500 hover:bg-orange-600"
                    data-testid="save-profile-btn"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Сохранение...' : 'Сохранить изменения'}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <X className="w-4 h-4 mr-2" />
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bonus Programs Section - Redesigned */}
          {bonusPrograms.length > 0 && (
            <div className="space-y-4" data-testid="bonus-section">
              {/* Individual Bonus Programs */}
              {bonusPrograms.map((program) => {
                const yearlyTotal = program.yearly_total || 0;
                const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price);
                
                // Sort levels for display
                const sortedLevels = [...(program.levels || [])].sort((a, b) => a.min_points - b.min_points);
                
                return (
                  <div key={program.id} className="border border-zinc-200 bg-white overflow-hidden">
                    {/* Program Header */}
                    <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50">
                      <div className="flex items-center gap-3">
                        {program.image_url ? (
                          <img 
                            src={program.image_url} 
                            alt="Bonus" 
                            className="w-10 h-10 rounded-full object-cover border border-zinc-200"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <Award className="w-5 h-5 text-orange-500" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-bold text-zinc-800">{program.title || 'Бонусная программа'}</h3>
                          <p className="text-zinc-500 text-sm">{program.description || 'Программа лояльности с уровнями!'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Levels Section */}
                    {program.levels && program.levels.length > 0 && (
                      <div className="px-6 py-4 border-b border-zinc-100" data-testid="levels-section">
                        {/* Current Level Badge */}
                        {program.current_level && (
                          <div 
                            className="flex items-center justify-between mb-4 p-3 rounded-lg"
                            style={{ backgroundColor: program.current_level.color + '15' }}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                style={{ backgroundColor: program.current_level.color }}
                              >
                                {program.current_level.name?.charAt(0) || '★'}
                              </div>
                              <div>
                                <p className="font-bold" style={{ color: program.current_level.color }}>
                                  Ваш уровень: {program.current_level.name}
                                </p>
                                {program.current_level.benefits && (
                                  <p className="text-xs text-zinc-500">{program.current_level.benefits}</p>
                                )}
                              </div>
                            </div>
                            {program.current_level.cashback_percent > 0 && (
                              <div className="text-right">
                                <p className="text-2xl font-bold" style={{ color: program.current_level.color }}>
                                  {program.current_level.cashback_percent}%
                                </p>
                                <p className="text-xs text-zinc-500">кешбэк</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* All Levels Visual */}
                        <div>
                          <p className="text-xs font-medium text-zinc-500 uppercase mb-2">Уровни программы</p>
                          <div className="flex gap-1 flex-wrap">
                            {sortedLevels.map((level) => {
                              const isActive = program.current_level?.id === level.id;
                              const isAchieved = yearlyTotal >= level.min_points;
                              return (
                                <div 
                                  key={level.id}
                                  className={`flex-1 min-w-[80px] p-2 rounded-lg text-center transition-all ${
                                    isActive 
                                      ? 'text-white shadow-lg scale-105' 
                                      : isAchieved 
                                        ? 'text-white opacity-70' 
                                        : 'bg-zinc-100 text-zinc-400'
                                  }`}
                                  style={isActive || isAchieved ? { backgroundColor: level.color } : {}}
                                >
                                  <p className="font-bold text-sm">{level.name}</p>
                                  <p className="text-xs opacity-80">
                                    {level.cashback_percent > 0 ? `${level.cashback_percent}%` : ''}
                                  </p>
                                  <p className="text-xs opacity-60 mt-1">от {formatPrice(level.min_points)} ₽</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  
                    {/* Content */}
                    <div className="p-6">
                    
                    {/* Full Description */}
                    {program.full_description && (
                      <div className="mb-4 p-4 bg-zinc-50 rounded-lg">
                        <button 
                          onClick={() => setExpandedProgram(expandedProgram === program.id ? null : program.id)}
                          className="flex items-center justify-between w-full text-left"
                        >
                          <span className="text-sm font-medium text-zinc-700">Подробнее о программе</span>
                          <span className="text-zinc-400">{expandedProgram === program.id ? '▲' : '▼'}</span>
                        </button>
                        {expandedProgram === program.id && (
                          <div className="mt-3 pt-3 border-t border-zinc-200">
                            <p className="text-sm text-zinc-600 whitespace-pre-line">{program.full_description}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Prizes Section */}
                    {program.prizes && program.prizes.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-zinc-800 mb-3 flex items-center gap-2">
                          <Award className="w-5 h-5 text-orange-500" />
                          Призы
                        </h4>
                        <div className="grid gap-3">
                          {program.prizes.filter(p => p.enabled).map((prize) => {
                            const canAfford = (program.bonus_points || 0) >= prize.points_cost;
                            const isRedeeming = redeemingPrize[`${program.id}_${prize.id}`];
                            const isAvailable = prize.quantity === -1 || prize.quantity > 0;
                            
                            return (
                              <div 
                                key={prize.id} 
                                className={`flex items-center gap-4 p-4 rounded-lg border ${
                                  canAfford && isAvailable 
                                    ? 'border-green-200 bg-green-50' 
                                    : 'border-zinc-200 bg-zinc-50'
                                }`}
                              >
                                {prize.image_url ? (
                                  <img 
                                    src={prize.image_url} 
                                    alt={prize.name}
                                    className="w-16 h-16 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-orange-100 flex items-center justify-center">
                                    <Gift className="w-8 h-8 text-orange-500" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-semibold text-zinc-800">{prize.name}</h5>
                                  {prize.description && (
                                    <p className="text-sm text-zinc-500 truncate">{prize.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-bold text-orange-600">{prize.points_cost} баллов</span>
                                    {prize.quantity >= 0 && (
                                      <span className="text-xs text-zinc-400">
                                        (осталось: {prize.quantity})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  onClick={() => handleRedeemPrize(program.id, prize.id, prize.name, prize.points_cost)}
                                  disabled={!canAfford || !isAvailable || isRedeeming}
                                  size="sm"
                                  className={`whitespace-nowrap ${
                                    canAfford && isAvailable
                                      ? 'bg-green-500 hover:bg-green-600'
                                      : 'bg-zinc-300 cursor-not-allowed'
                                  }`}
                                >
                                  {isRedeeming ? '...' : !isAvailable ? 'Нет в наличии' : canAfford ? 'Получить' : 'Недостаточно'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Request Bonus Button or Status */}
                    {program.bonus_requested ? (
                      <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-center gap-2 text-orange-600 mb-2">
                          <Clock className="w-5 h-5 animate-pulse" />
                          <span className="font-bold">Запрос отправлен!</span>
                        </div>
                        <p className="text-sm text-orange-700">
                          Администратор скоро свяжется с вами и выдаст промокод.
                        </p>
                        {program.request_date && (
                          <p className="text-xs text-orange-500 mt-2">
                            Запрос от {formatDate(program.request_date)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Button 
                        onClick={() => handleRequestBonus(program.id)}
                        disabled={requestingBonus[program.id] || (program.bonus_points || 0) === 0}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 disabled:opacity-50"
                        data-testid={`request-bonus-btn-${program.id}`}
                      >
                        <Send className="w-5 h-5 mr-2" />
                        {requestingBonus[program.id] ? 'Отправка...' : 'Запросить бонус'}
                      </Button>
                    )}
                  </div>
                </div>
              );})}
              
              {/* Bonus History - received promo codes */}
              {bonusHistory.length > 0 && (
                <div className="border border-zinc-200 bg-white overflow-hidden">
                  <button 
                    className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-zinc-50 transition-colors"
                    onClick={() => document.getElementById('bonus-history').classList.toggle('hidden')}
                  >
                    <span className="flex items-center gap-2 font-medium text-sm">
                      <History className="w-4 h-4 text-zinc-400" />
                      Полученные промокоды ({bonusHistory.length})
                    </span>
                    <span className="text-zinc-400">▼</span>
                  </button>
                  
                  <div id="bonus-history" className="hidden border-t border-zinc-100">
                    {bonusHistory.map((item) => (
                      <div key={item.id} className="px-6 py-3 flex items-center justify-between border-b border-zinc-100 last:border-0">
                        <div>
                          <p className="text-sm font-medium">
                            {item.program_title || 'Бонус за накопления'}
                          </p>
                          <p className="text-xs text-zinc-400">{formatDate(item.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => copyPromoCode(item.bonus_code)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-mono ${
                              copiedCode === item.bonus_code 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                            data-testid={`copy-promo-${item.id}`}
                          >
                            {copiedCode === item.bonus_code ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                            {item.bonus_code}
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
