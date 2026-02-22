import React, { useRef } from 'react';
import { Button } from '../ui/button';
import { Upload, Download } from 'lucide-react';

export default function ImportTab({
  products,
  uploading,
  importResult,
  handleImportProducts,
  handleExportProducts
}) {
  const importFileRef = useRef(null);

  return (
    <div className="p-6">
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Импорт/Экспорт товаров</h2>
          <p className="text-sm text-zinc-500">
            Загружайте товары из CSV файла или экспортируйте текущий каталог.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Import */}
          <div className="border border-zinc-200 p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Импорт товаров
            </h3>
            <p className="text-sm text-zinc-500 mb-4">
              CSV файл с разделителем ; (точка с запятой)
            </p>
            <input
              type="file"
              ref={importFileRef}
              onChange={handleImportProducts}
              accept=".csv"
              className="hidden"
            />
            <Button 
              onClick={() => importFileRef.current?.click()}
              disabled={uploading}
              className="w-full"
              variant="outline"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Загрузка...' : 'Выбрать CSV файл'}
            </Button>

            {importResult && (
              <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 text-sm">
                <p className="text-green-600">✓ Импортировано: {importResult.imported}</p>
                <p className="text-blue-600">↻ Обновлено: {importResult.updated}</p>
                {importResult.total_errors > 0 && (
                  <>
                    <p className="text-red-600 mt-2">✕ Ошибок: {importResult.total_errors}</p>
                    <ul className="text-xs text-red-500 mt-1">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Export */}
          <div className="border border-zinc-200 p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Экспорт товаров
            </h3>
            <p className="text-sm text-zinc-500 mb-4">
              Скачать все товары в формате CSV
            </p>
            <Button onClick={handleExportProducts} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Скачать CSV ({products.length} товаров)
            </Button>
          </div>
        </div>

        {/* CSV format help */}
        <div className="border border-zinc-200 p-4 bg-zinc-50">
          <h3 className="font-semibold mb-2">Формат CSV файла</h3>
          <p className="text-xs text-zinc-500 mb-2">Обязательные колонки: article, name. Разделитель: ; (точка с запятой)</p>
          <div className="bg-white border border-zinc-200 p-2 font-mono text-xs overflow-x-auto">
            <p>article;name;price;stock;delivery_days;description;category_id;image_url</p>
            <p className="text-zinc-400">MAN-PG-001;Поршневая группа MAN;45000;10;3;Описание;id-категории;https://...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
