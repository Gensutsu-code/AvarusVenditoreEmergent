import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Newspaper, Calendar, ArrowLeft } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    axios.get(`${API}/news`).then(res => setNews(res.data)).catch(() => {});
  }, []);

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
  };

  if (selectedArticle) {
    return (
      <div className="min-h-screen" data-testid="news-article-page">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <button onClick={() => setSelectedArticle(null)}
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Назад к новостям
          </button>
          {selectedArticle.image_url && (
            <img src={selectedArticle.image_url} alt={selectedArticle.title}
              className="w-full h-64 object-cover rounded-xl mb-6" />
          )}
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
            <Calendar className="w-4 h-4" />
            {formatDate(selectedArticle.created_at)}
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-6">{selectedArticle.title}</h1>
          <div className="prose prose-zinc max-w-none text-zinc-700 whitespace-pre-wrap">{selectedArticle.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="news-page">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase text-zinc-900 mb-8">
          Новости и статьи
        </h1>

        {news.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500">Пока нет новостей</p>
          </div>
        ) : (
          <div className="space-y-6">
            {news.map(article => (
              <button key={article.id} onClick={() => setSelectedArticle(article)}
                className="w-full text-left bg-white border border-zinc-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                data-testid={`news-article-${article.id}`}>
                <div className="flex gap-4 p-5">
                  {article.image_url && (
                    <img src={article.image_url} alt={article.title}
                      className="w-32 h-24 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(article.created_at)}
                    </div>
                    <h2 className="text-lg font-bold text-zinc-900 mb-1 line-clamp-1">{article.title}</h2>
                    <p className="text-sm text-zinc-500 line-clamp-2">{article.content}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
