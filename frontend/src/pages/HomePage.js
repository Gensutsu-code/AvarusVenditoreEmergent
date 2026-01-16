import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function HomePage() {
  useEffect(() => {
    // Seed data on first load
    axios.post(`${API}/seed`).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen" data-testid="home-page">
      {/* Hero */}
      <div className="bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter uppercase mb-4">
            Запчасти для грузовиков
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mb-8">
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
