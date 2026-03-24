import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Check, ArrowLeft } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ResetPasswordPage() {
  const { isDark } = useTheme();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center space-y-3">
          <p className={`${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Недействительная ссылка сброса пароля</p>
          <Link to="/login" className="text-teal-500 hover:underline text-sm">Перейти к входу</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Пароль минимум 6 символов'); return; }
    if (password !== confirm) { setError('Пароли не совпадают'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { token, password });
      setDone(true);
      toast.success('Пароль изменён');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка сброса пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className={`w-full max-w-md p-8 rounded-2xl border ${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200'}`} data-testid="reset-password-page">
        {done ? (
          <div className="text-center space-y-4">
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${isDark ? 'bg-green-500/20' : 'bg-green-500/10'}`}>
              <Check className={`w-7 h-7 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
            </div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>Пароль изменён</h2>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Перенаправляем на страницу входа...</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                <Lock className={`w-7 h-7 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
              </div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>Новый пароль</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Новый пароль"
                className={isDark ? 'bg-zinc-800/50 border-zinc-700 text-zinc-100' : ''}
                data-testid="reset-password-input"
              />
              <Input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Подтверждение пароля"
                className={isDark ? 'bg-zinc-800/50 border-zinc-700 text-zinc-100' : ''}
                data-testid="reset-confirm-input"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-teal-500 hover:bg-teal-600 text-white" data-testid="reset-submit-btn">
                {loading ? 'Сохранение...' : 'Сохранить пароль'}
              </Button>
            </form>
            <div className="text-center mt-4">
              <Link to="/login" className={`text-sm ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-500 hover:text-slate-700'}`}>
                <ArrowLeft className="w-3 h-3 inline mr-1" />
                Назад к входу
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
