import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Pencil, Trash2, Save, X, FileText, Image } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function NewsTab({ newsList, setNewsList }) {
  const [editingNews, setEditingNews] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNews, setNewNews] = useState({ title: '', content: '', image_url: '' });

  const handleCreateNews = async () => {
    if (!newNews.title.trim() || !newNews.content.trim()) {
      toast.error('Заполните заголовок и содержание');
      return;
    }
    try {
      const res = await axios.post(`${API}/admin/news`, newNews);
      setNewsList([res.data, ...newsList]);
      setNewNews({ title: '', content: '', image_url: '' });
      setIsCreating(false);
      toast.success('Новость создана');
    } catch (err) {
      toast.error('Ошибка создания');
    }
  };

  const handleUpdateNews = async () => {
    if (!editingNews) return;
    try {
      await axios.put(`${API}/admin/news/${editingNews.id}`, {
        title: editingNews.title,
        content: editingNews.content,
        image_url: editingNews.image_url
      });
      setNewsList(newsList.map(n => n.id === editingNews.id ? editingNews : n));
      setEditingNews(null);
      toast.success('Новость обновлена');
    } catch (err) {
      toast.error('Ошибка обновления');
    }
  };

  const handleDeleteNews = async (newsId) => {
    if (!window.confirm('Удалить новость?')) return;
    try {
      await axios.delete(`${API}/admin/news/${newsId}`);
      setNewsList(newsList.filter(n => n.id !== newsId));
      toast.success('Новость удалена');
    } catch (err) {
      toast.error('Ошибка удаления');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Управление новостями</h2>
        <Button 
          onClick={() => setIsCreating(true)} 
          className="bg-orange-500 hover:bg-orange-600"
          disabled={isCreating}
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить новость
        </Button>
      </div>

      {/* Create New News */}
      {isCreating && (
        <div className="mb-6 p-4 border border-zinc-200 rounded-lg bg-zinc-50">
          <h3 className="font-semibold mb-3">Новая новость</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-zinc-500">Заголовок</Label>
              <Input 
                value={newNews.title}
                onChange={(e) => setNewNews({ ...newNews, title: e.target.value })}
                placeholder="Заголовок новости"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Содержание</Label>
              <textarea 
                value={newNews.content}
                onChange={(e) => setNewNews({ ...newNews, content: e.target.value })}
                className="w-full p-2 border border-zinc-200 rounded-lg min-h-[100px] text-sm"
                placeholder="Текст новости..."
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">URL изображения (необязательно)</Label>
              <Input 
                value={newNews.image_url}
                onChange={(e) => setNewNews({ ...newNews, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateNews} className="bg-green-500 hover:bg-green-600">
                <Save className="w-4 h-4 mr-2" />
                Сохранить
              </Button>
              <Button variant="outline" onClick={() => {
                setIsCreating(false);
                setNewNews({ title: '', content: '', image_url: '' });
              }}>
                <X className="w-4 h-4 mr-2" />
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* News List */}
      <div className="space-y-4">
        {newsList.map((news) => (
          <div key={news.id} className="border border-zinc-200 rounded-lg overflow-hidden">
            {editingNews?.id === news.id ? (
              <div className="p-4 bg-zinc-50">
                <div className="space-y-3">
                  <Input 
                    value={editingNews.title}
                    onChange={(e) => setEditingNews({ ...editingNews, title: e.target.value })}
                    placeholder="Заголовок"
                  />
                  <textarea 
                    value={editingNews.content}
                    onChange={(e) => setEditingNews({ ...editingNews, content: e.target.value })}
                    className="w-full p-2 border border-zinc-200 rounded-lg min-h-[100px] text-sm"
                  />
                  <Input 
                    value={editingNews.image_url || ''}
                    onChange={(e) => setEditingNews({ ...editingNews, image_url: e.target.value })}
                    placeholder="URL изображения"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateNews} className="bg-green-500 hover:bg-green-600" size="sm">
                      <Save className="w-4 h-4 mr-1" />
                      Сохранить
                    </Button>
                    <Button variant="outline" onClick={() => setEditingNews(null)} size="sm">
                      <X className="w-4 h-4 mr-1" />
                      Отмена
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex gap-4">
                  {news.image_url && (
                    <div className="w-20 h-20 flex-shrink-0 bg-zinc-100 rounded overflow-hidden">
                      <img src={news.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {!news.image_url && (
                    <div className="w-20 h-20 flex-shrink-0 bg-zinc-100 rounded flex items-center justify-center">
                      <FileText className="w-8 h-8 text-zinc-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{news.title}</h3>
                    <p className="text-sm text-zinc-500 line-clamp-2 mt-1">{news.content}</p>
                    <p className="text-xs text-zinc-400 mt-2">{formatDate(news.created_at)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditingNews(news)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteNews(news.id)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {newsList.length === 0 && !isCreating && (
        <div className="text-center py-8 text-zinc-500">
          <FileText className="w-12 h-12 mx-auto mb-2 text-zinc-300" />
          Новости не найдены
        </div>
      )}
    </div>
  );
}
