import React, { useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Save, Upload, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PromoTab({
  promoBanner,
  setPromoBanner,
  uploading,
  handlePromoImageUpload,
  handleSavePromoBanner,
  promoFileRef,
  isDark = false
}) {
  const localFileRef = useRef(null);
  const fileRef = promoFileRef || localFileRef;

  return (
    <div className="p-6">
      <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-zinc-100' : ''}`}>Баннер акций и скидок</h2>
      
      <div className="max-w-xl space-y-4">
        <div className="flex items-center gap-4">
          <Switch
            checked={promoBanner.enabled}
            onCheckedChange={(checked) => setPromoBanner({ ...promoBanner, enabled: checked })}
            data-testid="promo-enabled"
          />
          <Label className={isDark ? 'text-zinc-300' : ''}>Показывать баннер</Label>
        </div>

        <div>
          <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Текст баннера</Label>
          <Input
            value={promoBanner.text}
            onChange={(e) => setPromoBanner({ ...promoBanner, text: e.target.value })}
            placeholder="Скидка 10% на все товары!"
            className={`mt-1 ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}`}
            data-testid="promo-text"
          />
        </div>

        <div>
          <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Ссылка (необязательно)</Label>
          <Input
            value={promoBanner.link || ''}
            onChange={(e) => setPromoBanner({ ...promoBanner, link: e.target.value })}
            placeholder="/catalog?search=акция"
            className={`mt-1 ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}`}
            data-testid="promo-link"
          />
        </div>

        <div>
          <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Цвет фона</Label>
          <div className="flex gap-2 mt-1">
            <Input
              type="color"
              value={promoBanner.bg_color || '#f97316'}
              onChange={(e) => setPromoBanner({ ...promoBanner, bg_color: e.target.value })}
              className="w-16 h-10 p-1"
            />
            <Input
              value={promoBanner.bg_color || '#f97316'}
              onChange={(e) => setPromoBanner({ ...promoBanner, bg_color: e.target.value })}
              className={`flex-1 ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}`}
            />
          </div>
        </div>

        <div>
          <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Высота баннера (px)</Label>
          <Input
            type="number"
            value={promoBanner.height || 40}
            onChange={(e) => setPromoBanner({ ...promoBanner, height: parseInt(e.target.value) || 40 })}
            min={30}
            max={200}
            className={`mt-1 w-32 ${isDark ? 'bg-zinc-900/50 border-zinc-700 text-zinc-100' : ''}`}
            data-testid="promo-height"
          />
        </div>

        <div>
          <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Изображение баннера</Label>
          <div className="mt-2 space-y-3">
            <input
              type="file"
              ref={fileRef}
              onChange={handlePromoImageUpload}
              accept="image/*"
              className="hidden"
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              size="sm"
              className={isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : ''}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Загрузка...' : 'Загрузить изображение'}
            </Button>
            
            {promoBanner.image && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <img src={promoBanner.image} alt="Banner" className="h-12 object-contain" />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setPromoBanner({ ...promoBanner, image: null })}
                    className="text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-4">
                  <Label className="text-xs text-zinc-500">Позиция:</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={promoBanner.image_position === 'left' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPromoBanner({ ...promoBanner, image_position: 'left' })}
                      className={promoBanner.image_position === 'left' ? 'bg-teal-500 hover:bg-teal-600' : ''}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Слева
                    </Button>
                    <Button
                      type="button"
                      variant={promoBanner.image_position === 'right' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPromoBanner({ ...promoBanner, image_position: 'right' })}
                      className={promoBanner.image_position === 'right' ? 'bg-teal-500 hover:bg-teal-600' : ''}
                    >
                      Справа
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {promoBanner.text && (
          <div>
            <Label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">Предпросмотр</Label>
            <div 
              className="flex items-center justify-between px-4 text-white text-sm font-medium"
              style={{ 
                backgroundColor: promoBanner.bg_color || '#f97316',
                minHeight: `${promoBanner.height || 40}px`
              }}
            >
              <div className="flex-shrink-0">
                {promoBanner.image && promoBanner.image_position === 'left' && (
                  <img src={promoBanner.image} alt="" className="object-contain" style={{ maxHeight: `${(promoBanner.height || 40) - 8}px` }} />
                )}
              </div>
              <span className="flex-1 text-center">{promoBanner.text}</span>
              <div className="flex-shrink-0">
                {promoBanner.image && promoBanner.image_position === 'right' && (
                  <img src={promoBanner.image} alt="" className="object-contain" style={{ maxHeight: `${(promoBanner.height || 40) - 8}px` }} />
                )}
              </div>
            </div>
          </div>
        )}

        <Button onClick={handleSavePromoBanner} className="bg-teal-500 hover:bg-teal-600" data-testid="save-promo-btn">
          <Save className="w-4 h-4 mr-2" />
          Сохранить баннер
        </Button>
      </div>
    </div>
  );
}
