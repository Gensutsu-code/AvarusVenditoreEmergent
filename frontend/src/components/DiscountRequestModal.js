import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Tag, Upload, X, Send, Image, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DiscountRequestModal({ open, onClose, product }) {
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Макс. размер: 10 МБ');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post(`${API}/upload`, form);
      setImageUrl(res.data.url);
      toast.success('Фото загружено');
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Опишите ваш запрос');
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/discount-requests`, {
        product_id: product.id,
        message: message.trim(),
        image_url: imageUrl || null
      });
      toast.success('Запрос отправлен! Мы рассмотрим его и ответим вам.');
      setMessage('');
      setImageUrl('');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl" data-testid="discount-request-modal">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold">Запросить скидку</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/80 mt-1 leading-relaxed">
            Если вы нашли товар дешевле чем у нас, мы можем предложить вам индивидуальную цену на любой товар!
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Product info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            {product.image_url ? (
              <img src={product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                <Tag className="w-5 h-5 text-slate-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
              <p className="text-xs text-slate-500 font-mono">{product.article}</p>
            </div>
            <p className="text-sm font-bold text-rose-500 whitespace-nowrap">
              {new Intl.NumberFormat('ru-RU').format(product.price)} ₽
            </p>
          </div>

          {/* Rules */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
            Если вы нашли товар дешевле чем у нас, просто пришлите нам скриншот или накладную с артикулом и ценой товара. Мы рассмотрим ваш случай и сделаем для вас индивидуальную цену.
          </div>

          {/* Message */}
          <div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Опишите где нашли дешевле, укажите ссылку или цену..."
              className="min-h-[80px] text-sm resize-none"
              data-testid="discount-request-message"
            />
          </div>

          {/* Image upload */}
          <div>
            <input
              type="file"
              ref={fileRef}
              onChange={handleUploadImage}
              accept="image/*"
              className="hidden"
            />
            {imageUrl ? (
              <div className="relative inline-block">
                <img src={imageUrl} alt="Скриншот" className="w-24 h-24 rounded-xl object-cover border border-slate-200" />
                <button
                  onClick={() => setImageUrl('')}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="gap-2"
                data-testid="discount-upload-image-btn"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Загрузка...</>
                ) : (
                  <><Image className="w-4 h-4" />Прикрепить фото</>
                )}
              </Button>
            )}
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
            className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl h-11"
            data-testid="discount-request-submit"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Отправка...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Отправить запрос</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
