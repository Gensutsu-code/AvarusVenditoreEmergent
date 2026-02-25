import { useState, useEffect } from 'react';
import axios from 'axios';
import { Newspaper, Calendar, ArrowLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Function to make URLs in text clickable
const linkifyText = (text) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-600 hover:text-teal-500 underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/news`)
      .then(res => {
        setNews(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
  };

  if (selectedArticle) {
    return (
      <div className="min-h-screen relative" data-testid="news-article-page">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-20 right-20 w-96 h-96 rounded-full bg-teal-400/20 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 py-8">
          <motion.button 
            onClick={() => setSelectedArticle(null)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/50 backdrop-blur-sm border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white transition-all mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ x: -4 }}
          >
            <ArrowLeft className="w-4 h-4" /> Назад к новостям
          </motion.button>

          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {selectedArticle.image_url && (
              <motion.img 
                src={selectedArticle.image_url} 
                alt={selectedArticle.title}
                className="w-full h-72 object-cover rounded-2xl mb-6 shadow-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            )}
            
            <div className="glass-card p-8">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                <Calendar className="w-4 h-4" />
                {formatDate(selectedArticle.created_at)}
              </div>
              <h1 className="text-3xl font-bold text-slate-800 mb-6">{selectedArticle.title}</h1>
              <div className="prose prose-slate max-w-none text-slate-600 whitespace-pre-wrap leading-relaxed">
                {linkifyText(selectedArticle.content)}
              </div>
            </div>
          </motion.article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" data-testid="news-page">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-20 left-20 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-teal-400/20 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div 
          className="flex items-center gap-4 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <Newspaper className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
              Новости и статьи
            </h1>
            <p className="text-sm text-slate-500">
              Актуальные новости и полезная информация
            </p>
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500">Загрузка...</p>
          </div>
        ) : news.length === 0 ? (
          <motion.div 
            className="text-center py-16 glass-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Newspaper className="w-20 h-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">Пока нет новостей</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {news.map((article, index) => (
                <motion.button 
                  key={article.id} 
                  onClick={() => setSelectedArticle(article)}
                  className="w-full text-left glass-card overflow-hidden group"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01, y: -2 }}
                  data-testid={`news-article-${article.id}`}
                >
                  <div className="flex gap-5 p-5">
                    {article.image_url && (
                      <div className="w-36 h-28 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                        <img 
                          src={article.image_url} 
                          alt={article.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(article.created_at)}
                      </div>
                      <h2 className="text-lg font-bold text-slate-800 mb-2 line-clamp-1 group-hover:text-teal-600 transition-colors">
                        {article.title}
                      </h2>
                      <p className="text-sm text-slate-500 line-clamp-2">{article.content}</p>
                      <div className="flex items-center gap-1 mt-3 text-teal-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Читать далее <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
