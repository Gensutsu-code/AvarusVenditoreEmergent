import React, { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Pencil, Trash2, Save, X, FileText, Upload } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import RichTextEditor from '../RichTextEditor';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function NewsTab({ newsList, setNewsList }) {
  const [editingNews, setEditingNews] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNews, setNewNews] = useState({ title: '', content: '', image_url: '' });
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef(null);
  const editCoverInputRef = useRef(null);

  const handleCoverUpload = async (e, target) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (target === 'new') setNewNews(prev => ({ ...prev, image_url: res.data.url }));
      else if (target === 'edit') setEditingNews(prev => ({ ...prev, image_url: res.data.url }));
      toast.success('Фото загружено');
    } catch { toast.error('Ошибка загрузки'); }
    finally { setUploadingCover(false); e.target.value = ''; }
  };

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
        image_url: editingNews.image_url || '',
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
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-500" />
          Управление новостями
        </h2>
        <Button
          onClick={() => setIsCreating(true)}
          className="bg-teal-500 hover:bg-teal-600"
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
              <RichTextEditor
                value={newNews.content}
                onChange={(val) => setNewNews({ ...newNews, content: val })}
                placeholder="Текст новости... Вставляйте фото, эмодзи, форматируйте текст"
                enableImages
                minHeight={120}
              />
              <p className="text-xs text-zinc-400 mt-1">**жирный**, _курсив_, [ссылка](url). Фото в текст — через иконку на панели.</p>
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Обложка новости</Label>
              <div className="flex items-center gap-3 mt-1">
                {newNews.image_url && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img src={newNews.image_url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setNewNews({ ...newNews, image_url: '' })} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border border-dashed border-zinc-300 hover:border-teal-400 hover:bg-teal-50 transition text-sm text-zinc-600 ${uploadingCover ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload className="w-4 h-4" />
                  {uploadingCover ? 'Загрузка...' : 'Загрузить фото'}
                  <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => handleCoverUpload(e, 'new')} className="hidden" />
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateNews} className="bg-green-500 hover:bg-green-600">
                <Save className="w-4 h-4 mr-2" />
                Сохранить
              </Button>
              <Button variant="outline" onClick={() => { setIsCreating(false); setNewNews({ title: '', content: '' }); }}>
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
                  <RichTextEditor
                    value={editingNews.content}
                    onChange={(val) => setEditingNews({ ...editingNews, content: val })}
                    placeholder="Текст новости..."
                    enableImages
                    minHeight={120}
                  />
                  <div className="mt-2">
                    <Label className="text-xs text-zinc-500">Обложка</Label>
                    <div className="flex items-center gap-3 mt-1">
                      {editingNews.image_url && (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border">
                          <img src={editingNews.image_url} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setEditingNews({ ...editingNews, image_url: '' })} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                      <label className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer border border-dashed border-zinc-300 hover:border-teal-400 transition text-xs text-zinc-600 ${uploadingCover ? 'opacity-50' : ''}`}>
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingCover ? '...' : 'Фото'}
                        <input ref={editCoverInputRef} type="file" accept="image/*" onChange={(e) => handleCoverUpload(e, 'edit')} className="hidden" />
                      </label>
                    </div>
                  </div>
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
                  <div className="w-20 h-20 flex-shrink-0 bg-zinc-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {news.image_url ? (
                      <img src={news.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-8 h-8 text-zinc-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{news.title}</h3>
                    <p className="text-sm text-zinc-500 line-clamp-2 mt-1">{news.content?.substring(0, 100)}</p>
                    <p className="text-xs text-zinc-400 mt-2">{formatDate(news.created_at)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditingNews({ ...news })}>
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
