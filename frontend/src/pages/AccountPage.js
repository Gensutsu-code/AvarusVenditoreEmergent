import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Pencil, Save, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    address: ''
  });

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
  }, [user, navigate]);

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

  if (!user) return null;

  return (
    <div className="min-h-screen" data-testid="account-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900">
            Личный кабинет
          </h1>
        </div>

        {/* User info */}
        <div className="border border-zinc-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-100 flex items-center justify-center">
                <User className="w-6 h-6 text-zinc-400" />
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
      </div>
    </div>
  );
}
