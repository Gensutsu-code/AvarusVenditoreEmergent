import React from 'react';
import { Button } from '../ui/button';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';

export default function CategoriesTab({ 
  categories, 
  openNewCategory, 
  openEditCategory, 
  handleDeleteCategory 
}) {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Управление категориями</h2>
        <Button onClick={openNewCategory} className="bg-orange-500 hover:bg-orange-600" data-testid="add-category-btn">
          <Plus className="w-4 h-4 mr-2" />
          Добавить категорию
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((category) => (
          <div key={category.id} className="border border-zinc-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            <div className="aspect-video bg-zinc-100 overflow-hidden">
              {category.image_url ? (
                <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-300">
                  <FolderOpen className="w-12 h-12" />
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-medium text-sm mb-2">{category.name}</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEditCategory(category)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {categories.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          Категории не найдены
        </div>
      )}
    </div>
  );
}
