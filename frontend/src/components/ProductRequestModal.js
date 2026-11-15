import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Package, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFeatures } from '../context/FeaturesContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProductRequestModal({ open, onClose, product, initialArticle }) {
  const [article, setArticle] = useState(initialArticle || product?.article || '');
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const commentRequired = !!useFeatures().settings.product_requests?.comment_required;

  const handleSubmit = async () => {
    if (!article.trim()) {
      toast.error('Укажите артикул товара');
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/product-requests`, {
        article: article.trim(),
        quantity,
        comment: comment.trim(),
        product_id: product?.id || null,
        product_name: product?.name || null
      });
      toast.success('Запрос отправлен! Мы свяжемся с вами.');
      setArticle('');
      setQuantity(1);
      setComment('');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] p-0 overflow-hidden rounded-2xl" data-testid="product-request-modal">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-4 text-white flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white text-base font-bold flex items-center gap-2">
              <Package className="w-5 h-5" />
              Запрос товара
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-white/80 mt-1">
            {product ? 'Товара нет в наличии — оставьте заявку и мы сообщим о поступлении' : 'Не нашли нужный товар? Мы найдём его для вас!'}
          </p>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 90px)' }}>
          {product && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                  <Package className="w-4 h-4 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">{product.name}</p>
                <p className="text-[10px] text-slate-500 font-mono">{product.article}</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Артикул товара *</label>
            <Input
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              placeholder="Введите артикул..."
              className="font-mono"
              data-testid="product-request-article"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Количество</label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              data-testid="product-request-quantity"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Комментарий{commentRequired ? ' *' : ' (необязательно)'}</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Дополнительная информация..."
              className="min-h-[60px] text-sm resize-none"
              data-testid="product-request-comment"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={sending || !article.trim() || (commentRequired && !comment.trim())}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl h-10 text-sm"
            data-testid="product-request-submit"
          >
            {sending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Отправка...</> : <><Send className="w-4 h-4 mr-2" />Отправить запрос</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
