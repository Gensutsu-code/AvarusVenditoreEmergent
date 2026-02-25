import React, { useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Pencil, Trash2, Image, Upload, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

export default function PartnersTab({
  partners = [],
  setPartners,
  editingPartner,
  setEditingPartner,
  handleAddDefaultPartners,
  handleDeletePartner,
  handlePartnerImageUpload,
  partnerImageUploading,
  partnerImageRef,
  isDark = false
}) {
  const localFileRef = useRef(null);
  const fileRef = partnerImageRef || localFileRef;
  const [isNewPartner, setIsNewPartner] = React.useState(false);

  const handleSavePartner = async () => {
    // This would be handled by parent component
    if (setEditingPartner) {
      setEditingPartner(null);
    }
  };

  return (
    <div className="p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : ''}`}>Партнёры на главной странице</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleAddDefaultPartners} className={isDark ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : ''}>
              Добавить стандартные
            </Button>
            <Button 
              onClick={() => {
                setIsNewPartner(true);
                setEditingPartner && setEditingPartner({ name: '', description: '', image_url: '', link: '', order: partners.length });
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить партнёра
            </Button>
          </div>
        </div>

        {partners.length === 0 ? (
          <div className={`text-center py-12 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50' : 'border border-zinc-200 bg-white'}`}>
            <Image className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
            <p className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>Нет партнёров. Добавьте первого или нажмите &quot;Добавить стандартные&quot;.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...partners].sort((a, b) => a.order - b.order).map((partner) => (
              <div key={partner.id} className={`p-4 group relative rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50' : 'border border-zinc-200 bg-white'}`}>
                {/* Partner image */}
                <div className={`h-20 mb-3 flex items-center justify-center rounded-lg overflow-hidden ${isDark ? 'bg-zinc-900/50' : 'bg-zinc-50'}`}>
                  {partner.image_url ? (
                    <img src={partner.image_url} alt={partner.name} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Image className={`w-8 h-8 ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`} />
                  )}
                </div>
                
                {/* Partner info */}
                <h3 className={`font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{partner.name}</h3>
                <p className={`text-sm truncate ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{partner.description}</p>
                {partner.link && (
                  <a href={partner.link} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:underline truncate block">
                    {partner.link}
                  </a>
                )}
                <p className={`text-xs mt-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>Порядок: {partner.order}</p>
                
                {/* Actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setIsNewPartner(false);
                      setEditingPartner && setEditingPartner({ ...partner });
                    }}
                    className={`p-1.5 rounded ${isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-white border border-zinc-200 hover:bg-zinc-100'}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeletePartner && handleDeletePartner(partner.id)}
                    className={`p-1.5 rounded text-red-500 ${isDark ? 'bg-zinc-700 hover:bg-red-900/30' : 'bg-white border border-zinc-200 hover:bg-red-100'}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Partner Modal */}
        <Dialog open={!!editingPartner} onOpenChange={() => setEditingPartner && setEditingPartner(null)}>
          <DialogContent className={isDark ? 'bg-zinc-900 border-zinc-700' : ''}>
            <DialogHeader>
              <DialogTitle className={isDark ? 'text-zinc-100' : ''}>{isNewPartner ? 'Добавить партнёра' : 'Редактировать партнёра'}</DialogTitle>
            </DialogHeader>
            
            {editingPartner && (
              <div className="space-y-4 mt-4">
                <div>
                  <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Название</Label>
                  <Input
                    value={editingPartner.name || ''}
                    onChange={(e) => setEditingPartner({ ...editingPartner, name: e.target.value })}
                    className={`mt-1 ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : ''}`}
                  />
                </div>
                <div>
                  <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Описание</Label>
                  <Input
                    value={editingPartner.description || ''}
                    onChange={(e) => setEditingPartner({ ...editingPartner, description: e.target.value })}
                    className={`mt-1 ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : ''}`}
                  />
                </div>
                <div>
                  <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Ссылка</Label>
                  <Input
                    value={editingPartner.link || ''}
                    onChange={(e) => setEditingPartner({ ...editingPartner, link: e.target.value })}
                    className={`mt-1 ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : ''}`}
                  />
                </div>
                <div>
                  <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Порядок</Label>
                  <Input
                    type="number"
                    value={editingPartner.order || 0}
                    onChange={(e) => setEditingPartner({ ...editingPartner, order: parseInt(e.target.value) || 0 })}
                    className={`mt-1 w-24 ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : ''}`}
                  />
                </div>
                <div>
                  <Label className={`text-xs font-bold uppercase ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Изображение</Label>
                  <div className="mt-2 flex items-center gap-3">
                    {editingPartner.image_url && (
                      <img src={editingPartner.image_url} alt="" className="h-12 object-contain" />
                    )}
                    <input
                      type="file"
                      ref={fileRef}
                      onChange={handlePartnerImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={partnerImageUploading}
                      className={isDark ? 'border-zinc-700 text-zinc-300' : ''}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {partnerImageUploading ? 'Загрузка...' : 'Загрузить'}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setEditingPartner(null)} className={isDark ? 'border-zinc-700 text-zinc-300' : ''}>
                    Отмена
                  </Button>
                  <Button onClick={handleSavePartner} className="bg-orange-500 hover:bg-orange-600">
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
