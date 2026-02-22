import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Save, RotateCcw, Plus, Trash2 } from 'lucide-react';

export default function TermsTab({
  termsSections,
  setTermsSections,
  termsSaving,
  handleSaveTerms,
  handleResetTerms
}) {
  return (
    <div className="p-6">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Правила предоставления услуг</h2>
            <p className="text-sm text-zinc-500">Редактируйте текст правил, который отображается при оформлении заказа</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleResetTerms}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Сбросить
            </Button>
            <Button
              onClick={handleSaveTerms}
              disabled={termsSaving}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="save-terms-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              {termsSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {termsSections.map((section, index) => (
            <div key={section.id} className="border border-zinc-200 bg-white p-4 rounded-lg">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <Label className="text-xs font-bold uppercase text-zinc-500">Заголовок раздела</Label>
                  <Input
                    value={section.title}
                    onChange={(e) => {
                      const newSections = [...termsSections];
                      newSections[index] = { ...newSections[index], title: e.target.value };
                      setTermsSections(newSections);
                    }}
                    className="mt-1"
                    data-testid={`terms-title-${index}`}
                  />
                </div>
                <div className="w-20">
                  <Label className="text-xs font-bold uppercase text-zinc-500">Порядок</Label>
                  <Input
                    type="number"
                    value={section.order}
                    onChange={(e) => {
                      const newSections = [...termsSections];
                      newSections[index] = { ...newSections[index], order: parseInt(e.target.value) || 0 };
                      setTermsSections(newSections);
                    }}
                    className="mt-1"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Удалить раздел?')) {
                      setTermsSections(termsSections.filter((_, i) => i !== index));
                    }
                  }}
                  className="text-red-500 hover:text-red-600 mt-5"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase text-zinc-500">Содержание</Label>
                <Textarea
                  value={section.content}
                  onChange={(e) => {
                    const newSections = [...termsSections];
                    newSections[index] = { ...newSections[index], content: e.target.value };
                    setTermsSections(newSections);
                  }}
                  className="mt-1 min-h-[150px] font-mono text-sm"
                  data-testid={`terms-content-${index}`}
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => {
            const newId = `section_${Date.now()}`;
            setTermsSections([
              ...termsSections,
              {
                id: newId,
                title: `${termsSections.length + 1}. Новый раздел`,
                content: '',
                order: termsSections.length + 1
              }
            ]);
          }}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить раздел
        </Button>
      </div>
    </div>
  );
}
