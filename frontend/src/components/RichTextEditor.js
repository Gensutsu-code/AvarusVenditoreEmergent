import { useState, useRef } from 'react';
import { Bold, Italic, List, Link, Image, Smile, X } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 150, enableImages = false }) {
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const emojiRef = useRef(null);

  const insertAtCursor = (text) => {
    const el = textareaRef.current;
    if (!el) { onChange(value + text); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = value.substring(0, start) + text + value.substring(end);
    onChange(newVal);
    setTimeout(() => { el.selectionStart = el.selectionEnd = start + text.length; el.focus(); }, 0);
  };

  const wrapSelection = (before, after) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.substring(start, end);
    const newVal = value.substring(0, start) + before + selected + after + value.substring(end);
    onChange(newVal);
    setTimeout(() => { el.selectionStart = start + before.length; el.selectionEnd = start + before.length + selected.length; el.focus(); }, 0);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await (await import('axios')).default.post(`${API}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      insertAtCursor(`\n[IMG:${res.data.url}:500]\n`);
    } catch { /* ignore */ }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleEmojiClick = (emojiData) => {
    insertAtCursor(emojiData.emoji);
    setShowEmoji(false);
  };

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-50 border-b border-zinc-200 flex-wrap">
        <button type="button" onClick={() => wrapSelection('**', '**')} className="p-1.5 rounded hover:bg-zinc-200 transition" title="Жирный">
          <Bold className="w-4 h-4 text-zinc-600" />
        </button>
        <button type="button" onClick={() => wrapSelection('_', '_')} className="p-1.5 rounded hover:bg-zinc-200 transition" title="Курсив">
          <Italic className="w-4 h-4 text-zinc-600" />
        </button>
        <button type="button" onClick={() => insertAtCursor('\n- ')} className="p-1.5 rounded hover:bg-zinc-200 transition" title="Список">
          <List className="w-4 h-4 text-zinc-600" />
        </button>
        <button type="button" onClick={() => { const url = prompt('Введите URL:'); if (url) wrapSelection('[', `](${url})`); }} className="p-1.5 rounded hover:bg-zinc-200 transition" title="Ссылка">
          <Link className="w-4 h-4 text-zinc-600" />
        </button>
        {enableImages && (
          <>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-1.5 rounded hover:bg-zinc-200 transition" title="Загрузить фото">
              <Image className="w-4 h-4 text-zinc-600" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </>
        )}
        <div className="w-px h-5 bg-zinc-300 mx-1" />
        <div className="relative" ref={emojiRef}>
          <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-1.5 rounded hover:bg-zinc-200 transition" title="Эмодзи">
            <Smile className="w-4 h-4 text-zinc-600" />
          </button>
          {showEmoji && (
            <div className="absolute top-full left-0 z-50 mt-1">
              <div className="relative">
                <button onClick={() => setShowEmoji(false)} className="absolute -top-2 -right-2 z-10 bg-white border rounded-full p-0.5 shadow">
                  <X className="w-3 h-3" />
                </button>
                <EmojiPicker onEmojiClick={handleEmojiClick} width={320} height={350} searchPlaceholder="Поиск..." previewConfig={{ showPreview: false }} lazyLoadEmojis />
              </div>
            </div>
          )}
        </div>
        {uploading && <span className="text-xs text-zinc-400 ml-2">Загрузка...</span>}
      </div>
      {/* Text area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 resize-y focus:outline-none text-sm"
        style={{ minHeight }}
        data-testid="rich-text-area"
      />
    </div>
  );
}
