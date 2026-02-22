import React from 'react';
import { Button } from '../ui/button';
import { Plus, Pencil, Trash2, Image } from 'lucide-react';

export default function PartnersTab({
  partners,
  setPartners,
  setIsNewPartner,
  setEditingPartner,
  handleAddDefaultPartners,
  handleDeletePartner
}) {
  return (
    <div className="p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Партнёры на главной странице</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleAddDefaultPartners}>
              Добавить стандартные
            </Button>
            <Button 
              onClick={() => {
                setIsNewPartner(true);
                setEditingPartner({ name: '', description: '', image_url: '', link: '', order: partners.length });
              }}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить партнёра
            </Button>
          </div>
        </div>

        {partners.length === 0 ? (
          <div className="text-center py-12 border border-zinc-200 bg-white">
            <Image className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500">Нет партнёров. Добавьте первого или нажмите &quot;Добавить стандартные&quot;.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...partners].sort((a, b) => a.order - b.order).map((partner) => (
              <div key={partner.id} className="border border-zinc-200 bg-white p-4 group relative">
                {/* Partner image */}
                <div className="h-20 mb-3 flex items-center justify-center bg-zinc-50 overflow-hidden">
                  {partner.image_url ? (
                    <img src={partner.image_url} alt={partner.name} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Image className="w-8 h-8 text-zinc-300" />
                  )}
                </div>
                
                {/* Partner info */}
                <h3 className="font-semibold text-zinc-900">{partner.name}</h3>
                <p className="text-sm text-zinc-500 truncate">{partner.description}</p>
                {partner.link && (
                  <a href={partner.link} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:underline truncate block">
                    {partner.link}
                  </a>
                )}
                <p className="text-xs text-zinc-400 mt-1">Порядок: {partner.order}</p>
                
                {/* Actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setIsNewPartner(false);
                      setEditingPartner({ ...partner });
                    }}
                    className="p-1.5 bg-white border border-zinc-200 rounded hover:bg-zinc-100"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeletePartner(partner.id)}
                    className="p-1.5 bg-white border border-zinc-200 rounded hover:bg-red-100 text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
