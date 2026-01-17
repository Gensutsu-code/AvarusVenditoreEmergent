import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(form.email, form.password);
      toast.success('Добро пожаловать!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-xl font-bold uppercase tracking-tight text-zinc-900">
            avopt.store
          </Link>
          <p className="text-sm text-zinc-400 mt-1">Avarus-Venditore</p>
          <h1 className="text-2xl font-bold text-zinc-900 mt-6">Вход</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 border border-zinc-200 p-8">
          <div>
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="example@mail.ru"
              className="mt-2 h-12 bg-zinc-50"
              required
              data-testid="login-email"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Пароль
            </Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="mt-2 h-12 bg-zinc-50"
              required
              data-testid="login-password"
            />
          </div>

          <Button 
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide h-12"
            data-testid="login-submit"
          >
            {loading ? 'Вход...' : 'Войти'}
          </Button>
        </form>

        <p className="text-center text-zinc-500 mt-6">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-orange-500 hover:text-orange-600 font-semibold">
            Регистрация
          </Link>
        </p>
      </div>
    </div>
  );
}
