import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, FolderPlus, Upload, Search, Trash2, X, ChevronRight,
  Play, Image, Film, FileText, Lock, Eye, MoreVertical, Pencil,
  Check, Maximize, SkipBack, SkipForward, RotateCw, Home
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

// ==================== VIDEO PLAYER ====================
function VideoPlayer({ src, fileData, onClose }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const [showControls, setShowControls] = useState(true);
  const [seekIndicator, setSeekIndicator] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [spriteData, setSpriteData] = useState(null); // {entries: [{start, end, x, y, w, h}], spriteUrl}
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
    if (e.target.closest('[data-controls]')) return;
    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX || e.changedTouches?.[0]?.clientX || 0) - rect.left;
    const diff = now - lastTap.current.time;
    if (diff < 350 && diff > 0) {
      e.preventDefault();
      if (x < rect.width / 2) seek(-10); else seek(10);
      lastTap.current = { time: 0, x: 0 };
    } else {
      lastTap.current = { time: now, x };
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
      if (e.key === 'ArrowLeft') seek(-10);
      else if (e.key === 'ArrowRight') seek(10);
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'f') toggleFullscreen();
      else if (e.key === ' ') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) { v.paused ? v.play() : v.pause(); setPlaying(!v.paused); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); clearTimeout(hideTimer.current); };
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col" data-testid="pf-video-player">
      <div ref={containerRef} className="relative flex-1 flex items-center justify-center"
        onClick={handleDoubleTap} onTouchEnd={handleDoubleTap} onMouseMove={handleMouseMove}>
        <video ref={videoRef} src={src} autoPlay className="max-w-full max-h-full" data-testid="pf-video-element"
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />

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
    </motion.div>
  );
}

// ==================== IMAGE PREVIEW ====================
function ImagePreview({ file, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose} data-testid="pf-preview-modal">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-2 -right-2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white" data-testid="pf-preview-close">
          <X className="w-5 h-5" />
        </button>
        <img src={fileUrl(file)} alt={file.name} className="max-w-full max-h-[80vh] rounded-xl object-contain" />
        <div className="mt-3 text-center">
          <p className="text-white text-sm font-medium truncate max-w-[400px]">{file.name}</p>
          <p className="text-slate-400 text-xs">{formatSize(file.size)}</p>
        </div>
      </motion.div>
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
      const res = await axios.get(`${API}/personal-files/files`, { params });
      setFiles(res.data.files || []);
    } catch {}
    finally { setLoading(false); }
  }, [currentFolder, searchQuery, typeFilter]);

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
  }, [authenticated, fetchFolders, fetchFiles, fetchBreadcrumbs]);

  useEffect(() => {
    if (!authenticated) return;
    const t = setTimeout(fetchFiles, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const navigateToFolder = (folderId) => {
    setCurrentFolder(folderId);
    setSearchQuery('');
    setTypeFilter('all');
  };

  // ==================== UPLOAD ====================
  const CHUNK_SIZE = 8 * 1024 * 1024;

  const uploadOneFile = async (file, index, signal) => {
    if (file.size <= CHUNK_SIZE) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder_id', currentFolder || '');
      await axios.post(`${API}/personal-files/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, signal,
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
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let uploaded = 0;
      for (let ci = 0; ci < totalChunks; ci++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const blob = file.slice(ci * CHUNK_SIZE, Math.min((ci + 1) * CHUNK_SIZE, file.size));
        const chunkFd = new FormData();
        chunkFd.append('upload_id', uploadId);
        chunkFd.append('chunk_index', String(ci));
        chunkFd.append('file', blob, `chunk_${ci}`);
        await axios.post(`${API}/personal-files/upload/chunk`, chunkFd, { signal });
        uploaded += blob.size;
        const pct = Math.round((uploaded * 100) / file.size);
        setUploadQueue(prev => prev.map((q, j) => j === index ? { ...q, progress: Math.min(pct, 99) } : q));
      }
      const completeFd = new FormData();
      completeFd.append('upload_id', uploadId);
      await axios.post(`${API}/personal-files/upload/complete`, completeFd, { signal });
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
          const status = err.name === 'AbortError' || err.code === 'ERR_CANCELED' ? 'cancelled' : 'error';
          setUploadQueue(prev => prev.map((q, j) => j === i ? { ...q, status } : q));
          if (status === 'cancelled') break;
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

  const cancelUpload = () => { abortRef.current?.abort(); };

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
                      className="w-full bg-slate-800/30 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all">
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

        {/* Type filters */}
        <div className="flex items-center gap-2 mb-4">
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
            {files.map(file => (
              <motion.div key={file.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="group relative bg-slate-800/30 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg"
                onClick={() => openFile(file)} data-testid={`pf-file-${file.id}`}>
                <div className="aspect-square relative bg-slate-900 flex items-center justify-center overflow-hidden">
                  {file.file_type === 'video' ? (
                    <>
                      <video src={fileUrl(file)} className="w-full h-full object-cover" muted preload="metadata" />
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
                </div>
                <div className="p-2">
                  <p className="text-xs text-slate-400 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-600">{formatSize(file.size)}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); handleDeleteFile(file.id, file.name); }}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/50 hover:bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all"
                  data-testid={`pf-delete-file-${file.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {file.file_type === 'gif' && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-pink-500/80 text-white text-[9px] font-bold rounded-md uppercase">GIF</span>
                )}
                {file.file_type === 'video' && (
                  <span className="absolute bottom-10 left-2 px-1.5 py-0.5 bg-indigo-500/80 text-white text-[9px] font-bold rounded-md uppercase">
                    <Film className="w-2.5 h-2.5 inline mr-0.5" />{file.quality || 'VIDEO'}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Image Preview */}
      <AnimatePresence>
        {previewFile && <ImagePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
      </AnimatePresence>

      {/* Video Player */}
      <AnimatePresence>
        {videoFile && <VideoPlayer src={fileUrl(videoFile)} fileData={videoFile} onClose={() => setVideoFile(null)} />}
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
