import React from 'react';
import { Button } from '../ui/button';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';

const formatPrice = (num) => num?.toLocaleString('ru-RU') || '0';

export default function ProductsTab({ 
  products, 
  categories,
  openNewProduct, 
  openEditProduct, 
  handleDeleteProduct 
}) {
  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : '—';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Управление товарами</h2>
        <Button onClick={openNewProduct} className="bg-teal-500 hover:bg-teal-600" data-testid="add-product-btn">
          <Plus className="w-4 h-4 mr-2" />
          Добавить товар
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-2">Фото</th>
              <th className="text-left py-3 px-2">Название</th>
              <th className="text-left py-3 px-2">Производитель</th>
              <th className="text-left py-3 px-2">Артикул</th>
              <th className="text-left py-3 px-2">Категория</th>
              <th className="text-right py-3 px-2">Цена</th>
              <th className="text-right py-3 px-2">Наличие</th>
              <th className="text-right py-3 px-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="py-2 px-2">
                  <div className="w-12 h-12 bg-zinc-100 overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 font-medium">{product.name}</td>
                <td className="py-2 px-2 font-semibold text-teal-600">{product.manufacturer || '—'}</td>
                <td className="py-2 px-2 font-mono font-semibold text-zinc-600">{product.article}</td>
                <td className="py-2 px-2 text-zinc-500">{getCategoryName(product.category_id)}</td>
                <td className="py-2 px-2 text-right font-mono">{formatPrice(product.price)} ₽</td>
                <td className="py-2 px-2 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${product.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {product.stock > 0 ? 'В наличии' : 'Нет'}
                  </span>
                </td>
                <td className="py-2 px-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditProduct(product)} data-testid={`edit-${product.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id)} className="text-red-500 hover:text-red-600" data-testid={`delete-${product.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {products.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          Товары не найдены
        </div>
      )}
    </div>
  );
}
