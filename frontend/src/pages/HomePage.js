import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
    seedData();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/categories`);
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    try {
      await axios.post(`${API}/seed`);
    } catch (err) {
      // Ignore seed errors
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading">
        <div className="text-zinc-500">Загрузка...</div>
      </div>
    );
  }

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
            data-testid="view-catalog-btn"
          >
            Каталог
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-8">
          Категории
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-200">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/catalog?category=${category.id}`}
              className="group bg-white p-6 hover:bg-zinc-50 transition-colors"
              data-testid={`category-${category.id}`}
            >
              <div className="aspect-video bg-zinc-100 mb-4 overflow-hidden">
                {category.image && (
                  <img 
                    src={category.image} 
                    alt={category.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  />
                )}
              </div>
              <h3 className="font-semibold text-zinc-900 group-hover:text-orange-500 transition-colors flex items-center justify-between">
                {category.name}
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
