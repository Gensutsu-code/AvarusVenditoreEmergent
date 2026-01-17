import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search } from 'lucide-react';
import { PopularProducts } from '../components/PopularProducts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Brand logos data with uploaded images
const BRANDS = [
  { 
    name: 'FAG', 
    desc: 'Подшипники',
    image: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/se4069qi_Screenshot%20%281%29.png'
  },
  { 
    name: 'HENGST', 
    desc: 'Фильтры',
    image: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/k3fl5886_Screenshot%20%282%29.png'
  },
  { 
    name: 'MANN+HUMMEL', 
    desc: 'Фильтрация',
    image: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/8hwi685y_Screenshot%20%283%29.png'
  },
  { 
    name: 'PACCAR', 
    desc: 'Комплектующие',
    image: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/lxmklmq6_Screenshot%20%284%29.png'
  },
  { 
    name: 'SAF', 
    desc: 'Оси и подвеска',
    image: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/54osguxt_Screenshot%20%285%29.png'
  },
  { 
    name: 'BPW', 
    desc: 'Ходовая часть',
    image: 'https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/qjidmkpu_Screenshot%20%285%29.png'
  },
];

export default function HomePage() {
  useEffect(() => {
    // Seed data on first load
    axios.post(`${API}/seed`).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen" data-testid="home-page">
      {/* Hero */}
      <div className="bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side - text */}
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter uppercase mb-4">
                Запчасти для грузовиков
              </h1>
              <p className="text-zinc-400 text-lg max-w-xl mb-8">
                Оригинальные и аналоговые запчасти для MAN, Volvo, Scania, Mercedes, DAF, IVECO
              </p>
              <Link 
                to="/catalog"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide px-8 py-3 transition-colors"
                data-testid="go-to-search-btn"
              >
                <Search className="w-5 h-5" />
                К покупкам
              </Link>
            </div>

            {/* Right side - brands showcase */}
            <div className="hidden lg:block">
              <div className="bg-zinc-800/50 border border-zinc-700 p-6 rounded-sm">
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4 text-center">
                  Работаем с ведущими производителями
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {BRANDS.map((brand) => (
                    <div 
                      key={brand.name}
                      className="bg-zinc-800 border border-zinc-700 p-3 hover:border-orange-500/50 transition-colors group overflow-hidden"
                    >
                      {brand.image && (
                        <div className="w-full h-12 mb-2 flex items-center justify-center">
                          <img 
                            src={brand.image} 
                            alt={brand.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-xs font-medium text-white truncate">
                          {brand.name}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {brand.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-600 mt-4 text-center">
                  Только проверенные поставщики
                </p>
              </div>
            </div>
          </div>

          {/* Mobile brands - horizontal scroll */}
          <div className="lg:hidden mt-8 -mx-4 px-4 overflow-x-auto">
            <div className="flex gap-3 pb-2">
              {BRANDS.map((brand) => (
                <div 
                  key={brand.name}
                  className="flex-shrink-0 bg-zinc-800 border border-zinc-700 p-3 text-center min-w-[100px]"
                >
                  {brand.image && (
                    <div className="w-full h-10 mb-2 flex items-center justify-center">
                      <img 
                        src={brand.image} 
                        alt={brand.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="text-xs font-medium text-white truncate">{brand.name}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{brand.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-8">
          О компании
        </h2>
        
        <div className="prose prose-zinc max-w-none">
          <p className="text-lg text-zinc-700 mb-6">
            <strong>avarus-Venditore</strong> — поставщик запчастей для грузовых автомобилей по всей России. 
            Мы специализируемся на комплектующих для коммерческого транспорта и предлагаем решения, 
            которые выдерживают реальные нагрузки и большие пробеги.
          </p>
          
          <p className="text-zinc-600 mb-6">
            В ассортименте — проверенные детали от надёжных производителей. Каждая позиция проходит 
            контроль качества, чтобы техника работала стабильно и без простоев. Мы не продаём 
            сомнительные аналоги и точно знаем, что поставляем.
          </p>
          
          <p className="text-zinc-600 mb-6">
            За счёт прямых поставок и оптимальной логистики мы удерживаем низкие и честные цены 
            без потери качества. Отгрузка осуществляется быстро, доставка работает по всем регионам 
            России — от крупных городов до удалённых направлений.
          </p>
          
          <p className="text-zinc-700 font-medium">
            <strong>avarus-Venditore</strong> — это запчасти, на которые можно положиться, сроки, 
            которые соблюдаются, и сервис, ориентированный на результат.
          </p>
        </div>
      </div>
    </div>
  );
}
