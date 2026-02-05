import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Lock, Phone, MapPin, Save, Eye, EyeOff, Camera, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AccountPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
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
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    // Redirect admin to admin profile
    if (user.role === 'admin') {
      navigate('/admin/profile');
      return;
    }
    setFormData(prev => ({
      ...prev,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || ''
    }));
  }, [user, authLoading, navigate]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/auth/profile`, {
        name: formData.name,
        phone: formData.phone,
        address: formData.address
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
      await axios.put(`${API}/user/password`, {
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
      await axios.post(`${API}/user/avatar`, formData, {
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
      await axios.delete(`${API}/user/avatar`);
      toast.success('Фото удалено');
      refreshUser();
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="account-page">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-6">
          Мой профиль
        </h1>

        <div className="space-y-6">
          {/* Avatar & Profile Info Card */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-6">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-4 border-white/30">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-white" />
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      {user?.avatar_url && (
                        <button
                          onClick={handleDeleteAvatar}
                          className="p-2 bg-red-500/80 rounded-full text-white hover:bg-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-white">
                  <h2 className="text-xl font-bold">{user?.name || 'Пользователь'}</h2>
                  <p className="text-orange-200 text-sm">{user?.email}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Имя
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Введите имя"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  value={formData.email}
                  disabled
                  className="mt-1 bg-zinc-50 cursor-not-allowed"
                />
                <p className="text-xs text-zinc-400 mt-1">Email нельзя изменить</p>
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Телефон
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+7 (XXX) XXX-XX-XX"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Адрес доставки
                </Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Город, улица, дом, квартира"
                  className="mt-1"
                />
              </div>
              
              <Button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </div>
          </div>

          {/* Password Change Card */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-zinc-700 to-zinc-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Безопасность</h2>
                    <p className="text-zinc-300 text-sm">Смена пароля</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="text-white hover:bg-white/10"
                >
                  {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </Button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Текущий пароль</Label>
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={formData.current_password}
                  onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                  placeholder="••••••••"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Новый пароль</Label>
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={formData.new_password}
                  onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                  placeholder="Минимум 6 символов"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Подтвердите новый пароль</Label>
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  placeholder="Повторите пароль"
                  className="mt-1"
                />
              </div>
              
              <Button 
                onClick={handleChangePassword}
                disabled={saving || !formData.current_password || !formData.new_password}
                variant="outline"
                className="w-full"
              >
                <Lock className="w-4 h-4 mr-2" />
                {saving ? 'Изменение...' : 'Изменить пароль'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
