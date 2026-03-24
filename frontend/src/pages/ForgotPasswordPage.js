import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ForgotPasswordPage() {
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Введите email'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className={`w-full max-w-md p-8 rounded-2xl border ${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-slate-200'}`} data-testid="forgot-password-page">
        {sent ? (
          <div className="text-center space-y-4">
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${isDark ? 'bg-teal-500/20' : 'bg-teal-500/10'}`}>
              <Check className={`w-7 h-7 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>Письмо отправлено</h2>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Если аккаунт с email <strong>{email}</strong> существует, вы получите ссылку для сброса пароля.
            </p>
            <Link to="/login" className={`inline-flex items-center gap-2 text-sm font-medium ${isDark ? 'text-teal-400' : 'text-teal-600'} hover:underline`}>
              <ArrowLeft className="w-4 h-4" />
              Вернуться к входу
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                <Mail className={`w-7 h-7 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
              </div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>Восстановление пароля</h2>
              <p className={`text-sm mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>Введите email для получения ссылки сброса</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                className={isDark ? 'bg-zinc-800/50 border-zinc-700 text-zinc-100' : ''}
                data-testid="forgot-email-input"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-teal-500 hover:bg-teal-600 text-white" data-testid="forgot-submit-btn">
                {loading ? 'Отправка...' : 'Отправить ссылку'}
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
