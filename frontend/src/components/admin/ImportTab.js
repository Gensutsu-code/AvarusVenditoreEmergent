import React, { useRef } from 'react';
import { Button } from '../ui/button';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, FileText, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportTab({
  uploading,
  importResult,
  setImportResult,
  handleImportProducts,
  handleExportProducts,
  handleDownloadTemplate,
  handleDownloadPrompt,
  importFileRef,
  isDark = false
}) {
  const localFileRef = useRef(null);
  const fileRef = importFileRef || localFileRef;

  return (
    <div className="p-6">
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-zinc-100' : ''}`}>Импорт/Экспорт товаров</h2>
          <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
            Загружайте товары из CSV файла или экспортируйте текущий каталог.
          </p>
        </div>

        {/* Template & Prompt Downloads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50' : 'border border-zinc-200 bg-white'}`}>
            <h3 className={`font-semibold mb-2 flex items-center gap-2 text-sm ${isDark ? 'text-zinc-100' : ''}`}>
              <FileSpreadsheet className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
              Шаблон CSV
            </h3>
            <p className={`text-xs mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
              Скачайте шаблон с примерами заполнения
            </p>
            <Button 
              onClick={handleDownloadTemplate} 
              variant="outline" 
              size="sm" 
              className="w-full"
              data-testid="download-csv-template-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Скачать шаблон
            </Button>
          </div>

          <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50' : 'border border-zinc-200 bg-white'}`}>
            <h3 className={`font-semibold mb-2 flex items-center gap-2 text-sm ${isDark ? 'text-zinc-100' : ''}`}>
              <FileText className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
              Промпт для ChatGPT
            </h3>
            <p className={`text-xs mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
              Промпт для генерации товаров через ChatGPT
            </p>
            <Button 
              onClick={handleDownloadPrompt} 
              variant="outline" 
              size="sm" 
              className="w-full"
              data-testid="download-gpt-prompt-btn"
            >
              <Copy className="w-4 h-4 mr-2" />
              Скачать промпт
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Import */}
          <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50' : 'border border-zinc-200 bg-white'}`}>
            <h3 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-100' : ''}`}>
              <Upload className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
              Импорт товаров
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
              CSV файл с разделителем ; (точка с запятой)
            </p>
            <input
              type="file"
              ref={fileRef}
              onChange={handleImportProducts}
              accept=".csv"
              className="hidden"
            />
            <Button 
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full"
              variant="outline"
              data-testid="import-csv-btn"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Загрузка...' : 'Выбрать CSV файл'}
            </Button>

            {importResult && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${isDark ? 'bg-zinc-900/50 border border-zinc-700' : 'bg-zinc-50 border border-zinc-200'}`}>
                <p className="text-green-600 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Импортировано: {importResult.imported}
                </p>
                <p className="text-blue-600">Пропущено (дубли): {importResult.skipped || 0}</p>
                {importResult.errors?.length > 0 && (
                  <>
                    <p className="text-red-600 mt-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Ошибок: {importResult.errors.length}
                    </p>
                    <ul className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setImportResult && setImportResult(null)}
                  className="mt-2 text-xs"
                >
                  Закрыть
                </Button>
              </div>
            )}
          </div>

          {/* Export */}
          <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/50 border border-zinc-700/50' : 'border border-zinc-200 bg-white'}`}>
            <h3 className={`font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-100' : ''}`}>
              <Download className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
              Экспорт товаров
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
              Скачать все товары в формате CSV
            </p>
            <Button 
              onClick={handleExportProducts} 
              variant="outline" 
              className="w-full"
              data-testid="export-csv-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Скачать CSV
            </Button>
          </div>
        </div>

        {/* CSV format help */}
        <div className={`p-5 rounded-xl ${isDark ? 'bg-zinc-800/30 border border-zinc-700/30' : 'border border-zinc-200 bg-zinc-50'}`}>
          <h3 className={`font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-100' : ''}`}>
            <FileSpreadsheet className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-500'}`} />
            Формат CSV файла
          </h3>
          <p className={`text-xs mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
            Обязательные колонки: article, name. Разделитель: ; (точка с запятой)
          </p>
          <div className={`p-3 rounded-lg font-mono text-xs overflow-x-auto ${isDark ? 'bg-zinc-900/50 border border-zinc-700' : 'bg-white border border-zinc-200'}`}>
            <p className={isDark ? 'text-zinc-300' : ''}>name;article;manufacturer;category_id;price;stock;description;warehouse;delivery_days;cross_articles;image_url</p>
            <p className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>Поршневая группа MAN;MAN-PG-001;MAN;;45000;10;Описание;Москва;3;;</p>
          </div>
        </div>
      </div>
    </div>
  );
}
