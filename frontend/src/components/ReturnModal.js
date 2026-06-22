import { useState, useMemo, useRef, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, RefreshCw, ShieldCheck, Package, Camera, Upload, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DEFAULT_SETTINGS = {
  fee_percent: 10,
  min_photos: 1,
  max_photos: 5,
  warranty_enabled: true,
  desc_return: 'Вернуть деньги на внутренний баланс. Удерживается комиссия и списываются начисленные бонусные баллы.',
  desc_warranty: 'Замена товара на новый 1:1 без удержаний и списания бонусов.',
  warning_text: 'При стандартном возврате удерживается комиссия от стоимости товара. Также будут списаны бонусные баллы, начисленные за возвращаемые позиции.',
};

export default function ReturnModal({ order, onClose, onSuccess }) {
  const [returnType, setReturnType] = useState(null); // "return" | "warranty"
  const [selectedItems, setSelectedItems] = useState({}); // {product_id: quantity}
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState([]); // [{url, filename}]
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const fileInputRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/return-settings`).then((r) => setSettings((s) => ({ ...s, ...r.data }))).catch(() => {});
  }, []);

  const MAX_PHOTOS = settings.max_photos;
  const MIN_PHOTOS = settings.min_photos;

  const formatPrice = (p) => new Intl.NumberFormat('ru-RU').format(p);

  const toggleItem = (productId, maxQty) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        next[productId] = maxQty;
      }
      return next;
    });
  };

  const setItemQty = (productId, qty, maxQty) => {
    const clamped = Math.max(1, Math.min(qty, maxQty));
    setSelectedItems((prev) => ({ ...prev, [productId]: clamped }));
  };

  const calc = useMemo(() => {
    let itemsTotal = 0;
    let refund = 0;
    let deduction = 0;
    const list = [];
    for (const item of order?.items || []) {
      const q = selectedItems[item.product_id];
      if (!q) continue;
      const sub = (item.price || 0) * q;
      itemsTotal += sub;
      if (returnType === 'return') {
        const d = Math.round(sub * (settings.fee_percent / 100) * 100) / 100;
        deduction += d;
        refund += Math.round((sub - d) * 100) / 100;
      }
      list.push({ ...item, quantity: q, subtotal: sub });
    }
    return { itemsTotal, refund, deduction, list };
  }, [selectedItems, returnType, order]);

  const hasSelection = Object.keys(selectedItems).length > 0;

  const submit = async () => {
    if (!returnType || !hasSelection) return;
    if (!reason.trim()) {
      toast.error('Укажите причину возврата');
      return;
    }
    if (photos.length < MIN_PHOTOS) {
      toast.error(MIN_PHOTOS === 1 ? 'Приложите хотя бы одно фото товара' : `Приложите минимум ${MIN_PHOTOS} фото товара`);
      return;
    }
    setSubmitting(true);
    try {
      const items = Object.entries(selectedItems).map(([product_id, quantity]) => ({
        product_id,
        quantity,
      }));
      await axios.post(`${API}/returns`, {
        type: returnType,
        order_id: order.id,
        items,
        reason: reason.trim(),
        photos: photos.map((p) => p.url),
      });
      toast.success(
        returnType === 'return'
          ? 'Запрос на возврат отправлен'
          : 'Запрос на возврат по гарантии отправлен'
      );
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка при создании возврата');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (files) => {
    const fileList = Array.from(files || []);
    if (!fileList.length) return;
    if (photos.length + fileList.length > MAX_PHOTOS) {
      toast.error(`Можно прикрепить не более ${MAX_PHOTOS} фото`);
      return;
    }
    setUploadingPhotos(true);
    try {
      const uploads = await Promise.all(
        fileList.map(async (file) => {
          if (!file.type.startsWith('image/')) {
            throw new Error('Допустимы только изображения');
          }
          const formData = new FormData();
          formData.append('file', file);
          const res = await axios.post(`${API}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          return { url: res.data.url, filename: res.data.filename || file.name };
        })
      );
      setPhotos((prev) => [...prev, ...uploads]);
    } catch (err) {
      toast.error(err.message || err.response?.data?.detail || 'Не удалось загрузить фото');
    } finally {
      setUploadingPhotos(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
        data-testid="return-modal-overlay"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
          data-testid="return-modal"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Оформление возврата</h2>
              <p className="text-teal-100 text-sm mt-0.5">Заказ #{order.id.slice(0, 8)}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition"
              data-testid="return-modal-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            {/* Step 1: Choose type */}
            {!returnType && (
              <div data-testid="return-type-step">
                <p className="text-sm font-medium text-slate-600 mb-4">Выберите тип возврата:</p>
                <div className="grid gap-3">
                  <button
                    onClick={() => setReturnType('return')}
                    className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition text-left"
                    data-testid="return-type-standard"
                  >
                    <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Возврат</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {settings.desc_return}
                      </p>
                    </div>
                  </button>

                  {settings.warranty_enabled && (
                  <button
                    onClick={() => setReturnType('warranty')}
                    className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition text-left"
                    data-testid="return-type-warranty"
                  >
                    <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Возврат по гарантии</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {settings.desc_warranty}
                      </p>
                    </div>
                  </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Pick items + reason */}
            {returnType && (
              <div data-testid="return-items-step">
                {/* Warning for standard return */}
                {returnType === 'return' && (
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">Внимание!</p>
                      <p>{settings.warning_text}</p>
                    </div>
                  </div>
                )}

                {returnType === 'warranty' && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">Гарантийная замена</p>
                      <p>
                        Товар будет заменён на новый 1:1. Удержания и списание баллов
                        не производится. С вами свяжется администратор для замены.
                      </p>
                    </div>
                  </div>
                )}

                {/* Items */}
                <p className="text-sm font-medium text-slate-600 mb-2">
                  Выберите товары для возврата:
                </p>
                <div className="space-y-2 mb-4">
                  {(order.items || []).map((item, idx) => {
                    const checked = !!selectedItems[item.product_id];
                    const qty = selectedItems[item.product_id] || 1;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                          checked ? 'border-teal-400 bg-teal-50/50' : 'border-slate-200'
                        }`}
                        data-testid={`return-item-${idx}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(item.product_id, item.quantity)}
                          className="w-5 h-5 rounded accent-teal-500 flex-shrink-0"
                          data-testid={`return-item-checkbox-${idx}`}
                        />
                        <div className="w-12 h-12 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-slate-200">
                          {item.image_url ? (
                            <img
                              src={
                                item.image_url.startsWith('http')
                                  ? item.image_url
                                  : `${BACKEND_URL}${item.image_url}`
                              }
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatPrice(item.price)} ₽ × {item.quantity}
                          </p>
                        </div>
                        {checked && (
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={qty}
                            onChange={(e) =>
                              setItemQty(
                                item.product_id,
                                parseInt(e.target.value) || 1,
                                item.quantity
                              )
                            }
                            className="w-16 px-2 py-1 text-sm text-center border border-slate-200 rounded-lg"
                            data-testid={`return-item-qty-${idx}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Reason */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Причина возврата <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Опишите причину возврата..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-400 resize-none"
                    data-testid="return-reason-input"
                  />
                </div>

                {/* Photos — required */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Фото товара / дефекта {MIN_PHOTOS > 0 && <span className="text-rose-500">*</span>}
                    <span className="text-xs text-slate-400 ml-2">({MIN_PHOTOS > 0 ? `минимум ${MIN_PHOTOS}, ` : ''}максимум {MAX_PHOTOS})</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {photos.map((ph, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 group"
                        data-testid={`return-photo-${idx}`}
                      >
                        <img
                          src={ph.url.startsWith('http') ? ph.url : `${BACKEND_URL}${ph.url}`}
                          alt={`photo-${idx}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                          data-testid={`remove-photo-${idx}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhotos}
                        className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-400 hover:bg-teal-50/50 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-teal-600 transition disabled:opacity-50"
                        data-testid="add-photo-btn"
                      >
                        {uploadingPhotos ? (
                          <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-5 h-5" />
                            <span className="text-[10px]">Добавить</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files)}
                    data-testid="photo-file-input"
                  />
                </div>

                {/* Summary */}
                {hasSelection && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Стоимость товаров:</span>
                      <span className="font-medium text-slate-800">
                        {formatPrice(calc.itemsTotal)} ₽
                      </span>
                    </div>
                    {returnType === 'return' && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-rose-500">Удержание {settings.fee_percent}%:</span>
                          <span className="font-medium text-rose-500">
                            −{formatPrice(calc.deduction)} ₽
                          </span>
                        </div>
                        <div className="flex justify-between text-base pt-1 border-t border-slate-200">
                          <span className="font-semibold text-slate-700">К возврату на баланс:</span>
                          <span className="font-bold text-emerald-600">
                            {formatPrice(calc.refund)} ₽
                          </span>
                        </div>
                        <p className="text-xs text-amber-600 pt-1">
                          Начисленные бонусные баллы за эти позиции будут списаны.
                        </p>
                      </>
                    )}
                    {returnType === 'warranty' && (
                      <p className="text-xs text-blue-600 pt-1">
                        Товар будет заменён 1:1. Удержания не применяются.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
            {returnType ? (
              <Button
                variant="outline"
                onClick={() => {
                  setReturnType(null);
                  setSelectedItems({});
                  setReason('');
                }}
                className="rounded-xl"
                data-testid="return-back-btn"
              >
                Назад
              </Button>
            ) : (
              <Button variant="outline" onClick={onClose} className="rounded-xl">
                Отмена
              </Button>
            )}
            {returnType && (
              <Button
                onClick={submit}
                disabled={!hasSelection || !reason.trim() || photos.length < MIN_PHOTOS || submitting || uploadingPhotos}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl shadow-lg shadow-teal-500/30 disabled:opacity-50"
                data-testid="return-submit-btn"
              >
                {submitting ? 'Отправка...' : 'Оформить возврат'}
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
