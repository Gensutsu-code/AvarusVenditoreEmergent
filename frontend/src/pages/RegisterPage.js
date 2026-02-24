import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User, Phone, MapPin, ArrowRight, MessageSquare } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    address_comment: '',
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
        address: form.address,
        address_comment: form.address_comment,
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

  const inputClass = "mt-2 h-12 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 rounded-xl focus:border-orange-500/50 focus:ring-orange-500/20";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-zinc-950 relative overflow-hidden" data-testid="register-page">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-zinc-950 to-zinc-950" />
      <motion.div 
        className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-orange-500/5 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div 
        className="absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full bg-purple-500/5 blur-3xl"
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
              <UserPlus className="w-5 h-5 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100">Регистрация</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <User className="w-3 h-3" /> Имя *
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ваше имя"
                className={inputClass}
                required
                data-testid="register-name"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Mail className="w-3 h-3" /> Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="example@mail.ru"
                className={inputClass}
                required
                data-testid="register-email"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Phone className="w-3 h-3" /> Телефон
              </Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+7 (___) ___-__-__"
                className={inputClass}
                data-testid="register-phone"
              />
            </div>

            <div>
              <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <MapPin className="w-3 h-3" /> Адрес доставки
              </Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Город, улица, дом, квартира"
                className={inputClass}
                data-testid="register-address"
              />
            </div>

            <div>
              <Label htmlFor="address_comment" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <MessageSquare className="w-3 h-3" /> Комментарий к адресу
              </Label>
              <Textarea
                id="address_comment"
                value={form.address_comment}
                onChange={(e) => setForm({ ...form, address_comment: e.target.value })}
                placeholder="Код домофона, этаж, ориентиры..."
                className="mt-2 bg-zinc-800/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 rounded-xl focus:border-orange-500/50 min-h-[80px]"
                data-testid="register-address-comment"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Lock className="w-3 h-3" /> Пароль *
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Мин. 6 символов"
                  className={inputClass}
                  required
                  data-testid="register-password"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Lock className="w-3 h-3" /> Повтор *
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Повторите"
                  className={inputClass}
                  required
                  data-testid="register-confirm-password"
                />
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="pt-2">
              <Button 
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold uppercase tracking-wide h-12 rounded-xl shadow-glow transition-all duration-300"
                data-testid="register-submit"
              >
                {loading ? (
                  <motion.div 
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <>
                    Зарегистрироваться
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
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors">
            Войти
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
