import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-950 relative overflow-hidden" data-testid="login-page">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-zinc-950 to-zinc-950" />
      <motion.div 
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-orange-500/5 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div 
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/5 blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, delay: 2 }}
      />

      <motion.div 
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Link to="/" className="inline-block">
            <motion.h1 
              className="text-2xl font-bold uppercase tracking-tight bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent"
              whileHover={{ scale: 1.02 }}
            >
              avopt.store
            </motion.h1>
          </Link>
          <p className="text-sm text-zinc-500 mt-1">Avarus-Venditore</p>
        </motion.div>

        <motion.div 
          className="glass-card p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <LogIn className="w-5 h-5 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100">Вход в аккаунт</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Mail className="w-3 h-3" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="example@mail.ru"
                className="mt-2 h-12 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 rounded-xl focus:border-orange-500/50 focus:ring-orange-500/20"
                required
                data-testid="login-email"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Lock className="w-3 h-3" /> Пароль
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="mt-2 h-12 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 rounded-xl focus:border-orange-500/50 focus:ring-orange-500/20"
                required
                data-testid="login-password"
              />
            </div>

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button 
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold uppercase tracking-wide h-12 rounded-xl shadow-glow transition-all duration-300"
                data-testid="login-submit"
              >
                {loading ? (
                  <motion.div 
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <>
                    Войти
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </motion.div>
          </form>
        </motion.div>

        <motion.p 
          className="text-center text-zinc-500 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Нет аккаунта?{' '}
          <Link to="/register" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors">
            Регистрация
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
