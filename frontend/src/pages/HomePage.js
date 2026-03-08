import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Search, ArrowRight, Truck, Shield, Clock, Package } from 'lucide-react';
import { motion } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_PARTNERS = [
  { name: 'FAG', description: 'Подшипники', image_url: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/se4069qi_Screenshot%20%281%29.png' },
  { name: 'HENGST', description: 'Фильтры', image_url: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/k3fl5886_Screenshot%20%282%29.png' },
  { name: 'MANN+HUMMEL', description: 'Фильтрация', image_url: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/8hwi685y_Screenshot%20%283%29.png' },
  { name: 'PACCAR', description: 'Комплектующие', image_url: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/lxmklmq6_Screenshot%20%284%29.png' },
  { name: 'SAF', description: 'Оси и подвеска', image_url: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/54osguxt_Screenshot%20%285%29.png' },
  { name: 'BPW', description: 'Ходовая часть', image_url: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/qjidmkpu_Screenshot%20%285%29.png' },
];

const FEATURES = [
  { icon: Truck, title: 'Быстрая доставка', desc: 'По всей России' },
  { icon: Shield, title: 'Гарантия качества', desc: 'Проверенные поставщики' },
  { icon: Clock, title: 'Оперативность', desc: 'Отгрузка в день заказа' },
  { icon: Package, title: 'Широкий выбор', desc: '10 000+ позиций' },
];

export default function HomePage() {
  const { user } = useAuth();
  const [partners, setPartners] = useState(DEFAULT_PARTNERS);

  useEffect(() => {
    const loadPartners = async () => {
      try {
        const res = await axios.get(`${API}/partners`);
        if (res.data.length > 0) {
          setPartners(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch partners', err);
      }
    };
    loadPartners();
  }, []);

  return (
    <div className="min-h-screen" data-testid="home-page">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-300/30 via-transparent to-pink-200/30" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-200/30 to-transparent" />
        
        {/* Animated circles */}
        <motion.div 
          className="absolute top-20 right-20 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side - text */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.h1 
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter uppercase mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <span className="text-slate-800">Запчасти для</span>
                <br />
                <span className="bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">
                  грузовых авто и прицепов
                </span>
              </motion.h1>
              
              <motion.p 
                className="text-lg max-w-xl mb-8 text-slate-600"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Оригинальные и аналоговые запчасти для MAN, Volvo, Scania, Mercedes, DAF, IVECO
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {user ? (
                <Link to="/catalog" data-testid="go-to-search-btn">
                  <motion.button
                    className="group inline-flex items-center gap-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-lg shadow-teal-500/30 text-white font-bold uppercase tracking-wide px-8 py-4 rounded-2xl transition-all duration-300"
                    whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(20, 184, 166, 0.4)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Search className="w-5 h-5" />
                    К покупкам
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </motion.button>
                </Link>
                ) : (
                  <motion.button
                    className="group inline-flex items-center gap-3 bg-zinc-300 text-zinc-500 cursor-not-allowed font-bold uppercase tracking-wide px-8 py-4 rounded-2xl"
                    disabled
                    data-testid="go-to-search-btn-disabled"
                  >
                    <Search className="w-5 h-5" />
                    К покупкам
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                )}
              </motion.div>
            </motion.div>

            {/* Right side - brands showcase */}
            {partners.length > 0 && (
              <motion.div 
                className="hidden lg:block"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-teal-500/5">
                  <div className="flex items-center justify-center gap-2 mb-5">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-teal-200"></div>
                    <p className="text-xs uppercase tracking-widest text-teal-600 font-semibold px-3">
                      Наши партнёры
                    </p>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-teal-200"></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {partners.slice(0, 6).map((partner, index) => (
                      <motion.a
                        key={partner.id || partner.name}
                        href={partner.link || '#'}
                        target={partner.link ? '_blank' : undefined}
                        rel={partner.link ? 'noopener noreferrer' : undefined}
                        className="group relative bg-gradient-to-br from-slate-50 to-white border border-slate-100 p-2 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-500/10 transition-all duration-300 rounded-xl overflow-hidden block hover:-translate-y-0.5"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.4 + index * 0.08 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        {partner.image_url && (
                          <div className="w-full h-16 mb-1 flex items-center justify-center">
                            <img 
                              src={partner.image_url} 
                              alt={partner.name}
                              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        <div className="text-center">
                          <div className="text-[11px] font-semibold text-slate-700 truncate">
                            {partner.name}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate">
                            {partner.description}
                          </div>
                        </div>
                      </motion.a>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                    <p className="text-[10px] text-slate-400">
                      Только проверенные поставщики
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Mobile brands - horizontal scroll */}
          {partners.length > 0 && (
            <motion.div 
              className="lg:hidden mt-8 -mx-4 px-4 overflow-x-auto scrollbar-hide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-teal-200"></div>
                <p className="text-xs uppercase tracking-widest text-teal-600 font-semibold px-2">
                  Партнёры
                </p>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-teal-200"></div>
              </div>
              <div className="flex gap-2 pb-2">
                {partners.map((partner, index) => (
                  <motion.a
                    key={partner.id || partner.name}
                    href={partner.link || '#'}
                    target={partner.link ? '_blank' : undefined}
                    rel={partner.link ? 'noopener noreferrer' : undefined}
                    className="flex-shrink-0 bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-3 text-center min-w-[90px] shadow-sm"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
                  >
                    {partner.image_url && (
                      <div className="w-full h-8 mb-1.5 flex items-center justify-center">
                        <img 
                          src={partner.image_url} 
                          alt={partner.name}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="text-[10px] font-semibold truncate text-slate-700">{partner.name}</div>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="glass-card p-6 text-center group hover:border-teal-400/50"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors duration-300">
                <feature.icon className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="font-semibold mb-1 text-slate-800">{feature.title}</h3>
              <p className="text-xs text-slate-500">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* About Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight uppercase mb-8 text-slate-800">
            О компании
          </h2>
          
          <div className="glass-card p-8">
            <div className="max-w-none">
              <p className="text-lg mb-6 text-slate-700">
                <span className="font-semibold text-teal-600">avarus-Venditore</span> — поставщик запчастей для грузовых автомобилей по всей России. 
                Мы специализируемся на комплектующих для коммерческого транспорта и предлагаем решения, 
                которые выдерживают реальные нагрузки и большие пробеги.
              </p>
              
              <p className="mb-6 text-slate-600">
                В ассортименте — проверенные детали от надёжных производителей. Каждая позиция проходит 
                контроль качества, чтобы техника работала стабильно и без простоев. Мы не продаём 
                сомнительные аналоги и точно знаем, что поставляем.
              </p>
              
              <p className="mb-6 text-slate-600">
                За счёт прямых поставок и оптимальной логистики мы удерживаем низкие и честные цены 
                без потери качества. Отгрузка осуществляется быстро, доставка работает по всем регионам 
                России — от крупных городов до удалённых направлений.
              </p>
              
              <p className="font-medium text-slate-700">
                <span className="font-semibold text-teal-600">avarus-Venditore</span> — это запчасти, на которые можно положиться, сроки, 
                которые соблюдаются, и сервис, ориентированный на результат.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
