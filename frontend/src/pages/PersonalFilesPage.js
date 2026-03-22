import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, FolderPlus, Upload, Search, Trash2, X, ChevronRight, ChevronLeft,
  Play, Image, Film, FileText, Lock, Eye, MoreVertical, Pencil,
  Check, Maximize, SkipBack, SkipForward, RotateCw, Home, Tag, Plus,
  CheckSquare, Square, Move, Tags
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const BASE_URL = process.env.REACT_APP_BACKEND_URL;

function fileUrl(file) {
  if (!file?.url) return '';
  if (file.url.startsWith('http')) return file.url;
  const token = localStorage.getItem('token');
  const sep = file.url.includes('?') ? '&' : '?';
  return BASE_URL + file.url + (token ? `${sep}token=${token}` : '');
}

function videoThumbUrl(file) {
  if (!file?.url) return '';
  // Cloudinary: generate thumbnail from video
  if (file.url.startsWith('http') && file.url.includes('cloudinary.com') && file.url.includes('/video/upload/')) {
    return file.url.replace('/video/upload/', '/video/upload/so_0,w_320,h_180,c_fill,f_jpg/');
  }
  return '';
}

// For local videos with sprites, returns CSS props to show first frame only
function spriteThumbStyle(file) {
  if (!file?.sprite_ready) return null;
  const token = localStorage.getItem('token');
  const spriteUrl = `${BASE_URL}/api/personal-files/sprites/${file.id}/sprite.jpg?token=${token}`;
  const cols = file.sprite_cols || 10;
  return {
    backgroundImage: `url(${spriteUrl})`,
    backgroundSize: `${cols * 100}% auto`,
    backgroundPosition: '0 0',
  };
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

const TYPE_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'photo', label: 'Фото' },
  { key: 'gif', label: 'GIF' },
  { key: 'video', label: 'Видео' },
];

// ==================== PASSWORD GATE ====================
const PF_KEY = 'pf_auth_ts';
function isSessionValid() {
  const ts = localStorage.getItem(PF_KEY);
  return ts && (Date.now() - parseInt(ts, 10)) < 6 * 3600000;
}

function PasswordGate({ onSuccess }) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (isSessionValid()) onSuccess(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      await axios.post(`${API}/personal-files/auth`, { password: pw });
      localStorage.setItem(PF_KEY, String(Date.now()));
      onSuccess();
    } catch { setErr('Неверный пароль'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center" data-testid="pf-password-gate">
      <motion.form initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onSubmit={submit}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            <Lock className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Личные файлы</h2>
            <p className="text-slate-500 text-xs">Введите пароль для доступа</p>
          </div>
        </div>
        <Input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(''); }}
          placeholder="Пароль" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" autoFocus data-testid="pf-password-input" />
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <Button type="submit" disabled={loading || !pw} className="w-full bg-slate-700 hover:bg-slate-600 text-white" data-testid="pf-password-submit">
          {loading ? 'Проверка...' : 'Войти'}
        </Button>
      </motion.form>
    </div>
  );
}

// ==================== TAG INPUT ====================
function TagInput({ tags = [], onChange, allTags = [] }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const suggestions = allTags
    .filter(t => t.name.includes(input.toLowerCase()) && !tags.includes(t.name))
    .slice(0, 8);

  const addTag = (tag) => {
    const clean = tag.trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      onChange([...tags, clean]);
    }
    setInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag) => onChange(tags.filter(t => t !== tag));

  return (
    <div className="relative" data-testid="pf-tag-input">
      <div className="flex flex-wrap gap-1.5 items-center">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700/80 text-slate-300 text-[11px] rounded-full">
            {tag}
            <button onClick={(e) => { e.stopPropagation(); removeTag(tag); }} className="hover:text-red-400 transition-colors">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <div className="relative">
          <input ref={inputRef} value={input} onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { e.preventDefault(); addTag(input); } }}
            placeholder="+ тег" className="bg-transparent text-[11px] text-slate-400 placeholder:text-slate-600 outline-none w-16" data-testid="pf-tag-text-input" />
          {showSuggestions && input && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[120px]">
              {suggestions.map(s => (
                <button key={s.name} onMouseDown={e => { e.preventDefault(); addTag(s.name); }}
                  className="w-full px-3 py-1 text-left text-[11px] text-slate-300 hover:bg-slate-700 flex items-center justify-between">
                  <span>{s.name}</span>
                  <span className="text-slate-600 text-[9px]">{s.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== SIMILAR FILES BAR ====================
function SimilarFilesBar({ fileId, onSelect }) {
  const [similar, setSimilar] = useState([]);

  useEffect(() => {
    if (!fileId) return;
    axios.get(`${API}/personal-files/files/${fileId}/similar?limit=12`).then(r => {
      setSimilar(r.data.files || []);
    }).catch(() => {});
  }, [fileId]);

  if (!similar.length) return null;

  return (
    <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800" data-testid="pf-similar-bar">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Похожие по тегам</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {similar.map(f => (
          <button key={f.id} onClick={() => onSelect(f)} data-testid={`pf-similar-${f.id}`}
            className="flex-shrink-0 w-16 group">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 group-hover:border-slate-500 transition-colors">
              {f.file_type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                  <Play className="w-4 h-4 text-slate-500" />
                </div>
              ) : (
                <img src={fileUrl(f)} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
            </div>
            <p className="text-[9px] text-slate-500 truncate mt-0.5">{f.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== VIDEO PLAYER ====================
function VideoPlayer({ src, fileData, onClose, onPrev, onNext, allTags, onTagsChange }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const [showControls, setShowControls] = useState(true);
  const [seekIndicator, setSeekIndicator] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [spriteData, setSpriteData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const lastTap = useRef({ time: 0, x: 0 });
  const hideTimer = useRef(null);

  // Load sprite VTT
  useEffect(() => {
    if (!fileData?.sprite_ready || !fileData?.id) return;
    const token = localStorage.getItem('token');
    const vttUrl = `${BASE_URL}/api/personal-files/sprites/${fileData.id}/thumbs.vtt?token=${token}`;
    const spriteUrl = `${BASE_URL}/api/personal-files/sprites/${fileData.id}/sprite.jpg?token=${token}`;
    fetch(vttUrl).then(r => r.text()).then(text => {
      const entries = [];
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const timeLine = lines[i];
        if (timeLine.includes('-->')) {
          const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
          const parseTime = (s) => {
            const p = s.split(':');
            return parseFloat(p[0]) * 3600 + parseFloat(p[1]) * 60 + parseFloat(p[2]);
          };
          const coordLine = lines[i + 1] || '';
          const m = coordLine.match(/#xywh=(\d+),(\d+),(\d+),(\d+)/);
          if (m) {
            entries.push({
              start: parseTime(startStr), end: parseTime(endStr),
              x: parseInt(m[1]), y: parseInt(m[2]), w: parseInt(m[3]), h: parseInt(m[4])
            });
          }
        }
      }
      if (entries.length) setSpriteData({ entries, spriteUrl });
    }).catch(() => {});
  }, [fileData]);

  const seek = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
    setSeekIndicator(delta < 0 ? 'left' : 'right');
    setTimeout(() => setSeekIndicator(null), 600);
  };

  const handleDoubleTap = (e) => {
    if (e.target.closest('[data-controls]') || e.target.closest('button')) return;
    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
    const diff = now - lastTap.current.time;
    if (diff < 350 && diff > 0) {
      // Double tap - seek
      e.preventDefault();
      clearTimeout(lastTap.current.timer);
      if (x < rect.width / 2) seek(-10); else seek(10);
      lastTap.current = { time: 0, x: 0, timer: null };
    } else {
      // Single tap - wait to confirm it's not a double tap, then toggle play/pause
      const timer = setTimeout(() => {
        const v = videoRef.current;
        if (v) { v.paused ? v.play().catch(() => {}) : v.pause(); }
      }, 350);
      lastTap.current = { time: now, x, timer };
    }
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await el.requestFullscreen(); try { await screen.orientation?.lock?.('landscape'); } catch {} }
    } catch {}
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  const handleProgressHover = (e) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pct * duration);
    setHoverX(e.clientX - rect.left);
  };

  const handleProgressClick = (e) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current) videoRef.current.currentTime = pct * duration;
  };

  const getSpriteForTime = (t) => {
    if (!spriteData) return null;
    return spriteData.entries.find(e => t >= e.start && t < e.end);
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft' && !e.shiftKey) seek(-10);
      else if (e.key === 'ArrowRight' && !e.shiftKey) seek(10);
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'f') toggleFullscreen();
      else if (e.key === ' ') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) { v.paused ? v.play().catch(() => {}) : v.pause(); }
      }
      else if (e.key === 'm') {
        const v = videoRef.current;
        if (v) { v.muted = !v.muted; setIsMuted(v.muted); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); clearTimeout(hideTimer.current); };
  }, []);

  const handleSimilarSelect = (f) => {
    if (f.file_type === 'video') {
      // Will be handled by parent via onNext/onPrev mechanism
      onClose();
      setTimeout(() => onTagsChange?.('openFile', f), 100);
    } else {
      onClose();
      setTimeout(() => onTagsChange?.('openFile', f), 100);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col" data-testid="pf-video-player">
      <div ref={containerRef} className="relative flex-1 flex items-center justify-center"
        onClick={handleDoubleTap} onTouchEnd={handleDoubleTap} onMouseMove={handleMouseMove}>
        <video ref={videoRef} src={src} playsInline autoPlay className="max-w-full max-h-full" data-testid="pf-video-element"
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => {
            setDuration(videoRef.current?.duration || 0);
            const v = videoRef.current;
            if (v) {
              v.play().catch(() => {
                // Autoplay blocked - try muted
                v.muted = true;
                setIsMuted(true);
                v.play().catch(() => {});
              });
            }
          }}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />

        {/* Big play button when paused */}
        {!playing && (
          <button onClick={(e) => { e.stopPropagation(); videoRef.current?.play().catch(() => {}); }}
            className="absolute inset-0 flex items-center justify-center z-5" data-testid="pf-video-play-overlay">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </button>
        )}

        {/* Unmute button if muted due to autoplay policy */}
        {isMuted && playing && (
          <button onClick={(e) => {
              e.stopPropagation();
              if (videoRef.current) { videoRef.current.muted = false; setIsMuted(false); }
            }}
            className="absolute top-14 right-3 z-10 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-xs hover:bg-white/30 transition-colors flex items-center gap-1.5"
            data-testid="pf-video-unmute">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
            Включить звук
          </button>
        )}

        {/* Nav arrows */}
        {onPrev && (
          <button onClick={(e) => { e.stopPropagation(); onPrev(); }} data-testid="pf-video-prev"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {onNext && (
          <button onClick={(e) => { e.stopPropagation(); onNext(); }} data-testid="pf-video-next"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10 transition-colors">
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Seek indicators */}
        <AnimatePresence>
          {seekIndicator === 'left' && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 pointer-events-none">
              <SkipBack className="w-10 h-10" /><span className="text-sm mt-1">-10 сек</span>
            </motion.div>
          )}
          {seekIndicator === 'right' && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center text-white/80 pointer-events-none">
              <SkipForward className="w-10 h-10" /><span className="text-sm mt-1">+10 сек</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top bar */}
        <AnimatePresence>
          {showControls && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent" data-controls="true">
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white" data-testid="pf-video-close">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                {fileData?.quality && (
                  <span className="px-2 py-1 bg-indigo-500/80 text-white text-xs font-bold rounded-md">{fileData.quality}</span>
                )}
                <button onClick={toggleFullscreen} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white" data-testid="pf-video-fullscreen">
                  <Maximize className="w-5 h-5" />
                </button>
                <button onClick={async () => {
                  try { const c = screen.orientation?.type || ''; if (c.includes('landscape')) await screen.orientation?.lock?.('portrait'); else await screen.orientation?.lock?.('landscape'); } catch {}
                }} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white" data-testid="pf-video-rotate">
                  <RotateCw className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Custom progress bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8 bg-gradient-to-t from-black/80 to-transparent" data-controls="true">
            {/* Progress */}
            <div ref={progressRef} className="relative h-6 flex items-center cursor-pointer group"
              onMouseMove={handleProgressHover} onMouseLeave={() => setHoverTime(null)} onClick={handleProgressClick}>
              <div className="w-full h-1 group-hover:h-1.5 bg-white/20 rounded-full transition-all relative">
                <div className="absolute left-0 top-0 h-full bg-white rounded-full" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
              </div>

              {/* Sprite preview tooltip */}
              {hoverTime !== null && spriteData && (() => {
                const entry = getSpriteForTime(hoverTime);
                if (!entry) return null;
                const tooltipX = Math.max(85, Math.min(hoverX, (progressRef.current?.offsetWidth || 0) - 85));
                return (
                  <div className="absolute bottom-8 pointer-events-none" style={{ left: tooltipX, transform: 'translateX(-50%)' }}>
                    <div className="bg-black border border-white/20 rounded-lg overflow-hidden shadow-xl">
                      <div style={{ width: entry.w, height: entry.h, backgroundImage: `url(${spriteData.spriteUrl})`,
                        backgroundPosition: `-${entry.x}px -${entry.y}px`, backgroundSize: 'auto' }} />
                      <div className="text-center text-[10px] text-white/80 py-0.5">{formatTime(hoverTime)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Time-only tooltip (no sprite) */}
              {hoverTime !== null && !spriteData && (
                <div className="absolute bottom-8 pointer-events-none" style={{ left: Math.max(20, Math.min(hoverX, (progressRef.current?.offsetWidth || 0) - 20)), transform: 'translateX(-50%)' }}>
                  <div className="bg-black/90 border border-white/20 rounded-md px-2 py-1 text-xs text-white">{formatTime(hoverTime)}</div>
                </div>
              )}
            </div>

            {/* Time */}
            <div className="flex items-center justify-between mt-1 text-xs text-white/60">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tags + Label + Similar files */}
      <div className="bg-slate-900/95 border-t border-slate-800">
        {fileData && (
          <div className="px-4 py-2 space-y-1.5">
            <EditableLabel file={fileData} onSave={(id, label) => onTagsChange?.('updateLabel', { fileId: id, label })} />
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-3 h-3 text-slate-600 flex-shrink-0" />
              <TagInput tags={fileData.tags || []} allTags={allTags}
                onChange={(newTags) => onTagsChange?.('updateTags', { fileId: fileData.id, tags: newTags })} />
            </div>
          </div>
        )}
        <SimilarFilesBar fileId={fileData?.id} onSelect={handleSimilarSelect} />
      </div>
    </motion.div>
  );
}

// ==================== EDITABLE LABEL ====================
function EditableLabel({ file, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(file.label || '');
  const inputRef = useRef(null);

  useEffect(() => { setValue(file.label || ''); }, [file.label]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    if (value.trim() !== (file.label || '')) {
      await onSave(file.id, value.trim());
    }
  };

  if (editing) {
    return (
      <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(file.label || ''); setEditing(false); }}}
        className="bg-transparent text-white text-sm font-medium outline-none border-b border-slate-600 focus:border-teal-500 max-w-[400px] w-full text-center"
        placeholder="Добавить описание..." data-testid="pf-label-input" />
    );
  }

  return (
    <button onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="text-sm font-medium truncate max-w-[400px] cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5"
      data-testid="pf-label-display">
      {file.label ? (
        <span className="text-white">{file.label}</span>
      ) : (
        <span className="text-slate-500 italic text-xs">Добавить описание...</span>
      )}
      <Pencil className="w-3 h-3 text-slate-500 flex-shrink-0" />
    </button>
  );
}

// ==================== IMAGE/GIF PREVIEW ====================
function ImagePreview({ file, onClose, onPrev, onNext, allTags, onTagsChange }) {
  const isGif = file.file_type === 'gif';

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && onPrev) onPrev();
      else if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onPrev, onNext]);

  const handleSimilarSelect = (f) => {
    onClose();
    setTimeout(() => onTagsChange?.('openFile', f), 100);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm" onClick={onClose}
      data-testid="pf-preview-modal">
      <div className="flex-1 flex items-center justify-center relative p-4 min-h-0" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white" data-testid="pf-preview-close">
          <X className="w-5 h-5" />
        </button>

        {/* Nav arrows */}
        {onPrev && (
          <button onClick={onPrev} data-testid="pf-preview-prev"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {onNext && (
          <button onClick={onNext} data-testid="pf-preview-next"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10 transition-colors">
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
          className={`relative flex flex-col items-center ${isGif ? 'max-w-[95vw] max-h-[85vh]' : 'max-w-[90vw] max-h-[80vh]'}`}>
          <img src={fileUrl(file)} alt={file.label || ''}
            className={`rounded-xl object-contain ${isGif ? 'max-h-[75vh] max-w-[95vw]' : 'max-h-[70vh] max-w-[90vw]'}`} />
          <div className="mt-3 text-center">
            <EditableLabel file={file} onSave={(id, label) => onTagsChange?.('updateLabel', { fileId: id, label })} />
            <p className="text-slate-400 text-xs">{formatSize(file.size)}{isGif ? ' \u00b7 GIF' : ''}</p>
          </div>
        </motion.div>
      </div>

      {/* Tags + Similar */}
      <div className="bg-slate-900/95 border-t border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
          <Tag className="w-3 h-3 text-slate-600 flex-shrink-0" />
          <TagInput tags={file.tags || []} allTags={allTags}
            onChange={(newTags) => onTagsChange?.('updateTags', { fileId: file.id, tags: newTags })} />
        </div>
        <SimilarFilesBar fileId={file.id} onSelect={handleSimilarSelect} />
      </div>
    </motion.div>
  );
}

// ==================== MAIN ====================
export default function PersonalFilesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const abortRef = useRef(null); // AbortController

  const [authenticated, setAuthenticated] = useState(false);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkTagInput, setShowBulkTagInput] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'admin') { navigate('/'); return; }
  }, [user, authLoading, navigate]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/personal-files/folders`, { params: { parent_id: currentFolder || undefined } });
      setFolders(res.data.folders || []);
    } catch {}
  }, [currentFolder]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentFolder) params.folder_id = currentFolder;
      if (searchQuery) params.search = searchQuery;
      if (typeFilter !== 'all') params.file_type = typeFilter;
      if (activeTag) params.tag = activeTag;
      const res = await axios.get(`${API}/personal-files/files`, { params });
      setFiles(res.data.files || []);
    } catch {}
    finally { setLoading(false); }
  }, [currentFolder, searchQuery, typeFilter, activeTag]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/personal-files/tags`);
      setAllTags(res.data.tags || []);
    } catch {}
  }, []);

  const fetchBreadcrumbs = useCallback(async () => {
    if (!currentFolder) { setBreadcrumbs([]); return; }
    try {
      const res = await axios.get(`${API}/personal-files/folders/${currentFolder}/breadcrumb`);
      setBreadcrumbs(res.data.breadcrumbs || []);
    } catch {}
  }, [currentFolder]);

  useEffect(() => {
    if (!authenticated) return;
    fetchFolders();
    fetchFiles();
    fetchBreadcrumbs();
    fetchTags();
  }, [authenticated, fetchFolders, fetchFiles, fetchBreadcrumbs, fetchTags]);

  useEffect(() => {
    if (!authenticated) return;
    const t = setTimeout(fetchFiles, 300);
    return () => clearTimeout(t);
  }, [searchQuery, activeTag]);

  const navigateToFolder = (folderId) => {
    setCurrentFolder(folderId);
    setSearchQuery('');
    setTypeFilter('all');
    setActiveTag(null);
  };

  // ==================== UPLOAD ====================
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk (safe for proxy limits)

  const uploadOneFile = async (file, index, signal) => {
    if (file.size <= CHUNK_SIZE) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder_id', currentFolder || '');
      await axios.post(`${API}/personal-files/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, signal,
        timeout: 120000,
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded * 100) / (e.total || 1));
          setUploadQueue(prev => prev.map((q, j) => j === index ? { ...q, progress: pct } : q));
        }
      });
    } else {
      const initFd = new FormData();
      initFd.append('filename', file.name);
      initFd.append('total_size', String(file.size));
      initFd.append('folder_id', currentFolder || '');
      const initRes = await axios.post(`${API}/personal-files/upload/init`, initFd, { signal });
      const uploadId = initRes.data.upload_id;
      setUploadQueue(prev => prev.map((q, j) => j === index ? { ...q, uploadId } : q));
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let uploaded = 0;
      for (let ci = 0; ci < totalChunks; ci++) {
        if (signal.aborted) {
          try { await axios.delete(`${API}/personal-files/upload/${uploadId}`); } catch {}
          throw new DOMException('Aborted', 'AbortError');
        }
        const blob = file.slice(ci * CHUNK_SIZE, Math.min((ci + 1) * CHUNK_SIZE, file.size));
        const chunkFd = new FormData();
        chunkFd.append('upload_id', uploadId);
        chunkFd.append('chunk_index', String(ci));
        chunkFd.append('file', blob, `chunk_${ci}`);
        // Retry up to 3 times on 502/network errors
        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await axios.post(`${API}/personal-files/upload/chunk`, chunkFd, { signal, timeout: 120000 });
            lastErr = null;
            break;
          } catch (chunkErr) {
            lastErr = chunkErr;
            if (chunkErr.name === 'AbortError' || chunkErr.code === 'ERR_CANCELED') throw chunkErr;
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        }
        if (lastErr) throw lastErr;
        uploaded += blob.size;
        const pct = Math.round((uploaded * 100) / file.size);
        setUploadQueue(prev => prev.map((q, j) => j === index ? { ...q, progress: Math.min(pct, 99) } : q));
      }
      setUploadQueue(prev => prev.map((q, j) => j === index ? { ...q, progress: 99, status: 'uploading' } : q));
      const completeFd = new FormData();
      completeFd.append('upload_id', uploadId);
      await axios.post(`${API}/personal-files/upload/complete`, completeFd, { signal, timeout: 600000 });
    }
  };

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const queue = Array.from(fileList).map(f => ({ name: f.name, progress: 0, status: 'pending', size: f.size }));
    setUploadQueue(queue);
    setUploading(true);
    let ok = 0, idx = 0;
    const worker = async () => {
      while (idx < fileList.length) {
        if (controller.signal.aborted) break;
        const i = idx++;
        setUploadQueue(prev => prev.map((q, j) => j === i ? { ...q, status: 'uploading' } : q));
        try {
          await uploadOneFile(fileList[i], i, controller.signal);
          setUploadQueue(prev => prev.map((q, j) => j === i ? { ...q, progress: 100, status: 'done' } : q));
          ok++;
        } catch (err) {
          const isCancelled = err.name === 'AbortError' || err.code === 'ERR_CANCELED';
          const status = isCancelled ? 'cancelled' : 'error';
          setUploadQueue(prev => prev.map((q, j) => j === i ? { ...q, status } : q));
          if (status === 'error') {
            const msg = err.response?.data?.detail || err.message || 'Ошибка загрузки';
            toast.error(`${fileList[i].name}: ${msg}`);
          }
          if (isCancelled) break;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, fileList.length) }, () => worker()));
    if (ok > 0) { fetchFiles(); fetchFolders(); }
    setUploading(false);
    abortRef.current = null;
    setTimeout(() => setUploadQueue([]), 3000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    // Cleanup any pending chunked upload sessions
    uploadQueue.forEach(item => {
      if (item.uploadId && item.status === 'uploading') {
        axios.delete(`${API}/personal-files/upload/${item.uploadId}`).catch(() => {});
      }
    });
  };

  // ==================== FOLDER ACTIONS ====================
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await axios.post(`${API}/personal-files/folders`, { name: newFolderName.trim(), parent_id: currentFolder || null });
      setNewFolderName(''); setShowNewFolder(false); fetchFolders();
    } catch { toast.error('Ошибка создания папки'); }
  };

  const handleRenameFolder = async (id) => {
    if (!editFolderName.trim()) return;
    try {
      await axios.put(`${API}/personal-files/folders/${id}`, { name: editFolderName.trim() });
      setEditingFolder(null); setEditFolderName(''); fetchFolders();
    } catch { toast.error('Ошибка'); }
  };

  const handleDeleteFolder = async (id, name) => {
    if (!window.confirm(`Удалить папку "${name}" и все содержимое?`)) return;
    try {
      await axios.delete(`${API}/personal-files/folders/${id}`);
      fetchFolders(); fetchFiles(); toast.success('Удалено');
    } catch { toast.error('Ошибка'); }
    setContextMenu(null);
  };

  const handleDeleteFile = async (id, name) => {
    if (!window.confirm(`Удалить "${name}"?`)) return;
    try {
      await axios.delete(`${API}/personal-files/files/${id}`);
      fetchFiles(); fetchFolders(); toast.success('Удалено');
    } catch { toast.error('Ошибка'); }
  };

  const openFile = (file) => {
    if (file.file_type === 'video') setVideoFile(file);
    else setPreviewFile(file);
  };

  // Navigation: prev/next file in current list
  const currentOpenFile = videoFile || previewFile;
  const currentIndex = currentOpenFile ? files.findIndex(f => f.id === currentOpenFile.id) : -1;

  const goToPrevFile = () => {
    if (currentIndex <= 0) return;
    const prev = files[currentIndex - 1];
    setPreviewFile(null);
    setVideoFile(null);
    setTimeout(() => openFile(prev), 50);
  };

  const goToNextFile = () => {
    if (currentIndex < 0 || currentIndex >= files.length - 1) return;
    const next = files[currentIndex + 1];
    setPreviewFile(null);
    setVideoFile(null);
    setTimeout(() => openFile(next), 50);
  };

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < files.length - 1;

  // Handle actions from child components (tags, similar)
  const handleViewerAction = async (action, data) => {
    if (action === 'updateTags') {
      try {
        await axios.put(`${API}/personal-files/files/${data.fileId}/tags`, { tags: data.tags });
        setFiles(prev => prev.map(f => f.id === data.fileId ? { ...f, tags: data.tags } : f));
        if (videoFile?.id === data.fileId) setVideoFile(prev => ({ ...prev, tags: data.tags }));
        if (previewFile?.id === data.fileId) setPreviewFile(prev => ({ ...prev, tags: data.tags }));
        fetchTags();
      } catch { toast.error('Ошибка сохранения тегов'); }
    } else if (action === 'updateLabel') {
      try {
        await axios.put(`${API}/personal-files/files/${data.fileId}/label`, { label: data.label });
        setFiles(prev => prev.map(f => f.id === data.fileId ? { ...f, label: data.label || null } : f));
        if (videoFile?.id === data.fileId) setVideoFile(prev => ({ ...prev, label: data.label || null }));
        if (previewFile?.id === data.fileId) setPreviewFile(prev => ({ ...prev, label: data.label || null }));
      } catch { toast.error('Ошибка сохранения описания'); }
    } else if (action === 'openFile') {
      openFile(data);
    }
  };

  // ==================== SELECTION & BULK ====================
  const toggleSelection = (fileId) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedFiles(new Set());
    setShowBulkTagInput(false);
    setBulkTagValue('');
    setShowMoveModal(false);
  };

  const handleBulkAddTags = async () => {
    const tags = bulkTagValue.split(',').map(t => t.trim()).filter(Boolean);
    if (!tags.length || !selectedFiles.size) return;
    try {
      await axios.put(`${API}/personal-files/files/bulk/tags`, {
        file_ids: [...selectedFiles], tags
      });
      toast.success(`Теги добавлены к ${selectedFiles.size} файлам`);
      fetchFiles(); fetchTags();
      setShowBulkTagInput(false); setBulkTagValue('');
    } catch { toast.error('Ошибка'); }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Удалить ${selectedFiles.size} файлов?`)) return;
    try {
      await axios.delete(`${API}/personal-files/files/bulk`, {
        data: { file_ids: [...selectedFiles] }
      });
      toast.success(`Удалено ${selectedFiles.size} файлов`);
      setSelectedFiles(new Set());
      fetchFiles(); fetchFolders(); fetchTags();
    } catch { toast.error('Ошибка'); }
  };

  const handleBulkMove = async (targetFolderId) => {
    try {
      await axios.put(`${API}/personal-files/files/bulk/move`, {
        file_ids: [...selectedFiles], folder_id: targetFolderId
      });
      toast.success(`Перемещено ${selectedFiles.size} файлов`);
      setSelectedFiles(new Set());
      setShowMoveModal(false);
      fetchFiles(); fetchFolders();
    } catch { toast.error('Ошибка'); }
  };

  // ==================== DRAG & DROP ====================
  const handleDragStart = (e, fileId) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedFiles(new Set([fileId]));
    } else if (!selectedFiles.has(fileId)) {
      setSelectedFiles(prev => new Set([...prev, fileId]));
    }
    e.dataTransfer.setData('text/plain', fileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragOver = (e, folderId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleFolderDrop = async (e, folderId) => {
    e.preventDefault();
    setDragOverFolder(null);
    const ids = selectedFiles.size > 0 ? [...selectedFiles] : [e.dataTransfer.getData('text/plain')];
    if (!ids.length) return;
    try {
      await axios.put(`${API}/personal-files/files/bulk/move`, {
        file_ids: ids, folder_id: folderId
      });
      toast.success(`Перемещено ${ids.length} файлов`);
      setSelectedFiles(new Set());
      setSelectionMode(false);
      fetchFiles(); fetchFolders();
    } catch { toast.error('Ошибка перемещения'); }
  };

  if (!authenticated) return <PasswordGate onSuccess={() => setAuthenticated(true)} />;

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="pf-main" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Eye className="w-5 h-5 text-slate-500 flex-shrink-0" />

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm min-w-0 flex-1">
            <button onClick={() => navigateToFolder(null)} className={`hover:text-white transition-colors flex-shrink-0 ${!currentFolder ? 'text-white font-semibold' : 'text-slate-400'}`} data-testid="pf-home">
              <Home className="w-4 h-4" />
            </button>
            {breadcrumbs.map((b, i) => (
              <span key={b.id} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <button onClick={() => navigateToFolder(b.id)}
                  className={`truncate max-w-[120px] hover:text-white transition-colors ${i === breadcrumbs.length - 1 ? 'text-white font-semibold' : 'text-slate-400'}`}>
                  {b.name}
                </button>
              </span>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск..."
              className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl h-9 text-sm" data-testid="pf-search" />
          </div>

          {/* Upload */}
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.gif" onChange={handleUpload} className="hidden" />
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
            onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="pf-upload-btn">
            <Upload className="w-4 h-4 mr-1" /> {uploading ? 'Загрузка...' : 'Загрузить'}
          </Button>
          <Button variant="ghost" size="sm" data-testid="pf-select-mode-btn"
            className={`rounded-xl ${selectionMode ? 'bg-teal-600/20 text-teal-400 hover:bg-teal-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            onClick={() => selectionMode ? exitSelection() : setSelectionMode(true)}>
            <CheckSquare className="w-4 h-4 mr-1" /> {selectionMode ? 'Отмена' : 'Выбрать'}
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Folders */}
        {!searchQuery && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Папки</h2>
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl h-7 text-xs"
                onClick={() => setShowNewFolder(true)} data-testid="pf-new-folder-btn">
                <FolderPlus className="w-3.5 h-3.5 mr-1" /> Новая папка
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              <AnimatePresence>
                {showNewFolder && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex flex-col items-center gap-2">
                    <Folder className="w-8 h-8 text-amber-400" />
                    <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Название"
                      className="h-7 text-xs bg-slate-900 border-slate-600 text-white text-center" autoFocus data-testid="pf-new-folder-input"
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); } }} />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs bg-teal-600 hover:bg-teal-500 rounded-lg px-3" onClick={handleCreateFolder}><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-400 rounded-lg" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}><X className="w-3 h-3" /></Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {folders.map(folder => (
                <div key={folder.id} className="relative group">
                  {editingFolder === folder.id ? (
                    <div className="bg-slate-800/50 border border-teal-600 rounded-xl p-3 flex flex-col items-center gap-2">
                      <Folder className="w-8 h-8 text-amber-400" />
                      <Input value={editFolderName} onChange={e => setEditFolderName(e.target.value)}
                        className="h-7 text-xs bg-slate-900 border-slate-600 text-white text-center" autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') { setEditingFolder(null); } }} />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-xs bg-teal-600 hover:bg-teal-500 rounded-lg px-3" onClick={() => handleRenameFolder(folder.id)}><Check className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-400 rounded-lg" onClick={() => setEditingFolder(null)}><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => navigateToFolder(folder.id)} data-testid={`pf-folder-${folder.id}`}
                      onDragOver={e => handleFolderDragOver(e, folder.id)}
                      onDragLeave={handleFolderDragLeave}
                      onDrop={e => handleFolderDrop(e, folder.id)}
                      className={`w-full border rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all ${
                        dragOverFolder === folder.id
                          ? 'bg-teal-600/20 border-teal-500 scale-105 shadow-lg shadow-teal-500/20'
                          : 'bg-slate-800/30 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700'
                      }`}>
                      <Folder className="w-8 h-8 text-amber-400" />
                      <span className="text-xs text-slate-300 truncate w-full text-center">{folder.name}</span>
                      <span className="text-[10px] text-slate-600">
                        {folder.file_count} файл. {folder.subfolder_count > 0 ? `\u00b7 ${folder.subfolder_count} папок` : ''}
                      </span>
                    </button>
                  )}
                  {editingFolder !== folder.id && (
                    <button onClick={e => { e.stopPropagation(); setContextMenu(contextMenu?.folderId === folder.id ? null : { folderId: folder.id }); }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <AnimatePresence>
                    {contextMenu?.folderId === folder.id && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                        className="absolute top-8 right-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditingFolder(folder.id); setEditFolderName(folder.name); setContextMenu(null); }}
                          className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                          <Pencil className="w-3 h-3" /> Переименовать
                        </button>
                        <button onClick={() => handleDeleteFolder(folder.id, folder.name)}
                          className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2">
                          <Trash2 className="w-3 h-3" /> Удалить
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              {folders.length === 0 && !showNewFolder && (
                <div className="col-span-full text-center py-3 text-slate-700 text-xs">Нет папок</div>
              )}
            </div>
          </div>
        )}

        {/* Type filters + Tag filters */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)} data-testid={`pf-filter-${f.key}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === f.key
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800/30 text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
              }`}>
              {f.label}
            </button>
          ))}
          <span className="text-[10px] text-slate-600 ml-2">{files.length} файлов</span>
        </div>

        {/* Tag cloud */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 mb-4 flex-wrap" data-testid="pf-tag-cloud">
            <Tag className="w-3 h-3 text-slate-600 flex-shrink-0" />
            {activeTag && (
              <button onClick={() => setActiveTag(null)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors flex items-center gap-1">
                <X className="w-2.5 h-2.5" /> Сбросить
              </button>
            )}
            {allTags.slice(0, 20).map(t => (
              <button key={t.name} onClick={() => setActiveTag(activeTag === t.name ? null : t.name)}
                data-testid={`pf-tag-filter-${t.name}`}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                  activeTag === t.name
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}>
                {t.name} <span className="text-slate-600 ml-0.5">{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Files grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Image className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{searchQuery ? 'Ничего не найдено' : 'Нет файлов'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {files.map(file => {
              const isSelected = selectedFiles.has(file.id);
              return (
              <motion.div key={file.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                draggable={selectionMode}
                onDragStart={e => handleDragStart(e, file.id)}
                className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
                  isSelected
                    ? 'bg-teal-900/30 border-2 border-teal-500 ring-1 ring-teal-500/30'
                    : 'bg-slate-800/30 border border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => selectionMode ? toggleSelection(file.id) : openFile(file)}
                data-testid={`pf-file-${file.id}`}>
                <div className="aspect-square relative bg-slate-900 flex items-center justify-center overflow-hidden">
                  {file.file_type === 'video' ? (
                    <>
                      {videoThumbUrl(file) ? (
                        <img src={videoThumbUrl(file)} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : spriteThumbStyle(file) ? (
                        <div className="w-full h-full" style={spriteThumbStyle(file)} />
                      ) : (
                        <div className="w-full h-full bg-slate-800" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        </div>
                      </div>
                    </>
                  ) : (file.file_type === 'image' || file.file_type === 'gif') ? (
                    <img src={fileUrl(file)} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-400" />
                  )}

                  {/* Selection checkbox */}
                  {selectionMode && (
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                        isSelected ? 'bg-teal-500 text-white' : 'bg-black/50 border border-white/30 text-transparent'
                      }`}>
                        <Check className="w-3 h-3" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs text-slate-400 truncate">{file.label || formatSize(file.size)}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {file.label && <p className="text-[10px] text-slate-600">{formatSize(file.size)}</p>}
                    {file.tags?.length > 0 && (
                      <div className="flex gap-0.5 overflow-hidden flex-1 min-w-0">
                        {file.tags.slice(0, 2).map(t => (
                          <span key={t} className="px-1 py-px bg-slate-700/60 text-slate-500 text-[8px] rounded truncate"
                            onClick={e => { e.stopPropagation(); if (!selectionMode) setActiveTag(t); }}>
                            {t}
                          </span>
                        ))}
                        {file.tags.length > 2 && <span className="text-[8px] text-slate-600">+{file.tags.length - 2}</span>}
                      </div>
                    )}
                  </div>
                </div>
                {!selectionMode && (
                  <button onClick={e => { e.stopPropagation(); handleDeleteFile(file.id, file.name); }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/50 hover:bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all"
                    data-testid={`pf-delete-file-${file.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {file.file_type === 'gif' && !selectionMode && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-pink-500/80 text-white text-[9px] font-bold rounded-md uppercase">GIF</span>
                )}
                {file.file_type === 'gif' && selectionMode && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-pink-500/80 text-white text-[9px] font-bold rounded-md uppercase">GIF</span>
                )}
                {file.file_type === 'video' && (
                  <span className={`absolute bottom-10 px-1.5 py-0.5 bg-indigo-500/80 text-white text-[9px] font-bold rounded-md uppercase ${selectionMode ? 'right-2' : 'left-2'}`}>
                    <Film className="w-2.5 h-2.5 inline mr-0.5" />{file.quality || 'VIDEO'}
                  </span>
                )}
              </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectionMode && selectedFiles.size > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-lg border border-slate-700 rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3"
            data-testid="pf-bulk-bar">
            <button onClick={selectAll} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1" data-testid="pf-select-all">
              <CheckSquare className="w-3.5 h-3.5" />
              {selectedFiles.size === files.length ? 'Снять все' : 'Выбрать все'}
            </button>
            <span className="text-[10px] text-teal-400 font-medium">{selectedFiles.size} выбрано</span>
            <div className="w-px h-5 bg-slate-700" />

            {/* Bulk tags */}
            {showBulkTagInput ? (
              <div className="flex items-center gap-1.5">
                <input value={bulkTagValue} onChange={e => setBulkTagValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBulkAddTags()}
                  placeholder="тег1, тег2..." className="h-7 px-2 text-xs bg-slate-800 border border-slate-600 rounded-lg text-white w-32 outline-none focus:border-teal-500"
                  data-testid="pf-bulk-tag-input" autoFocus />
                <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-500 rounded-lg px-2" onClick={handleBulkAddTags} data-testid="pf-bulk-tag-submit">
                  <Check className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 rounded-lg px-1" onClick={() => { setShowBulkTagInput(false); setBulkTagValue(''); }}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-teal-400 hover:bg-slate-800 rounded-lg"
                onClick={() => setShowBulkTagInput(true)} data-testid="pf-bulk-tag-btn">
                <Tags className="w-3.5 h-3.5 mr-1" /> Теги
              </Button>
            )}

            {/* Move to folder */}
            <div className="relative">
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg"
                onClick={() => setShowMoveModal(!showMoveModal)} data-testid="pf-bulk-move-btn">
                <Move className="w-3.5 h-3.5 mr-1" /> Переместить
              </Button>
              <AnimatePresence>
                {showMoveModal && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                    className="absolute bottom-full left-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[160px] max-h-48 overflow-y-auto"
                    data-testid="pf-move-modal">
                    <button onClick={() => handleBulkMove(null)}
                      className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                      <Home className="w-3 h-3" /> Корень
                    </button>
                    {folders.map(f => (
                      <button key={f.id} onClick={() => handleBulkMove(f.id)}
                        className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                        <Folder className="w-3 h-3 text-amber-400" /> {f.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bulk delete */}
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
              onClick={handleBulkDelete} data-testid="pf-bulk-delete-btn">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Удалить
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview */}
      <AnimatePresence>
        {previewFile && <ImagePreview file={previewFile} onClose={() => setPreviewFile(null)}
          onPrev={hasPrev ? goToPrevFile : null} onNext={hasNext ? goToNextFile : null}
          allTags={allTags} onTagsChange={handleViewerAction} />}
      </AnimatePresence>

      {/* Video Player */}
      <AnimatePresence>
        {videoFile && <VideoPlayer src={fileUrl(videoFile)} fileData={videoFile} onClose={() => setVideoFile(null)}
          onPrev={hasPrev ? goToPrevFile : null} onNext={hasNext ? goToNextFile : null}
          allTags={allTags} onTagsChange={handleViewerAction} />}
      </AnimatePresence>

      {/* Upload Progress */}
      <AnimatePresence>
        {uploadQueue.length > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 right-4 z-40 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden" data-testid="pf-upload-progress">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                {uploading ? 'Загрузка файлов...' : 'Загрузка завершена'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">{uploadQueue.filter(q => q.status === 'done').length}/{uploadQueue.length}</span>
                {uploading && (
                  <button onClick={cancelUpload} className="text-[10px] text-red-400 hover:text-red-300 font-medium" data-testid="pf-cancel-upload">
                    Отменить
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-2 space-y-1.5">
              {uploadQueue.map((item, i) => (
                <div key={i} className="px-2 py-1.5 rounded-lg bg-slate-800/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 truncate max-w-[200px]">{item.name}</span>
                    <span className="text-[10px] ml-2 flex-shrink-0">
                      {item.status === 'done' && <span className="text-teal-400">OK</span>}
                      {item.status === 'error' && <span className="text-red-400">ERR</span>}
                      {item.status === 'cancelled' && <span className="text-amber-400">Отмена</span>}
                      {item.status === 'uploading' && <span className="text-blue-400">{item.progress}%</span>}
                      {item.status === 'pending' && <span className="text-slate-600">...</span>}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div className={`h-full rounded-full ${
                        item.status === 'error' ? 'bg-red-500' : item.status === 'cancelled' ? 'bg-amber-500' :
                        item.status === 'done' ? 'bg-teal-500' : 'bg-blue-500'
                      }`} initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} transition={{ duration: 0.2 }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
