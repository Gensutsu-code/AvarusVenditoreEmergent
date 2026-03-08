import { useState, useRef } from 'react';
import { Smile, X } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Input } from './ui/input';

export default function EmojiInput({ value, onChange, placeholder, className = '', ...props }) {
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);

  const handleEmojiClick = (emojiData) => {
    const el = inputRef.current;
    if (el) {
      const start = el.selectionStart || value.length;
      const newVal = value.substring(0, start) + emojiData.emoji + value.substring(el.selectionEnd || start);
      onChange(newVal);
    } else {
      onChange(value + emojiData.emoji);
    }
    setShowEmoji(false);
  };

  return (
    <div className="relative flex items-center gap-1">
      <Input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} {...props} />
      <div className="relative" ref={pickerRef}>
        <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 rounded-lg hover:bg-zinc-100 transition flex-shrink-0" title="Эмодзи">
          <Smile className="w-4 h-4 text-zinc-500" />
        </button>
        {showEmoji && (
          <div className="absolute bottom-full right-0 z-50 mb-1">
            <div className="relative">
              <button onClick={() => setShowEmoji(false)} className="absolute -top-2 -right-2 z-10 bg-white border rounded-full p-0.5 shadow">
                <X className="w-3 h-3" />
              </button>
              <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={320} searchPlaceholder="Поиск..." previewConfig={{ showPreview: false }} lazyLoadEmojis />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
