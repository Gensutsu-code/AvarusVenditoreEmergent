import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (form.password !== form.confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    if (form.password.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }

    setLoading(true);
    
    try {
      await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password
      });
      toast.success('Регистрация успешна!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" data-testid="register-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-xl font-bold uppercase tracking-tight text-zinc-900">
            avopt.store
          </Link>
          <p className="text-sm text-zinc-400 mt-1">Avarus-Venditore</p>
          <h1 className="text-2xl font-bold text-zinc-900 mt-6">Регистрация</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 border border-zinc-200 p-8">
          <div>
            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Имя *
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ваше имя"
              className="mt-2 h-12 bg-zinc-50"
              required
              data-testid="register-name"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="example@mail.ru"
              className="mt-2 h-12 bg-zinc-50"
              required
              data-testid="register-email"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Телефон
            </Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+7 (___) ___-__-__"
              className="mt-2 h-12 bg-zinc-50"
              data-testid="register-phone"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Пароль *
            </Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Минимум 6 символов"
              className="mt-2 h-12 bg-zinc-50"
              required
              data-testid="register-password"
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Подтвердите пароль *
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Повторите пароль"
              className="mt-2 h-12 bg-zinc-50"
              required
              data-testid="register-confirm-password"
            />
          </div>

          <Button 
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide h-12"
            data-testid="register-submit"
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </Button>
        </form>

        <p className="text-center text-zinc-500 mt-6">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-orange-500 hover:text-orange-600 font-semibold">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
