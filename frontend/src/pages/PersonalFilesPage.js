import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, FolderPlus, Upload, Search, Trash2, X, ChevronLeft,
  Play, Image, Film, FileText, Lock, Eye, Grid3X3, MoreVertical, Pencil, Check
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const BASE_URL = process.env.REACT_APP_BACKEND_URL;

function fileUrl(file) {
  if (!file?.url) return '';
  if (file.url.startsWith('http')) return file.url;
  // Local file — needs auth token in URL
  const token = localStorage.getItem('token');
  const sep = file.url.includes('?') ? '&' : '?';
  return BASE_URL + file.url + (token ? `${sep}token=${token}` : '');
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function FileIcon({ type }) {
  if (type === 'video') return <Film className="w-5 h-5 text-indigo-400" />;
  if (type === 'gif') return <Image className="w-5 h-5 text-pink-400" />;
  if (type === 'image') return <Image className="w-5 h-5 text-teal-400" />;
  return <FileText className="w-5 h-5 text-slate-400" />;
}

// ==================== PASSWORD GATE ====================
function PasswordGate({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/personal-files/auth`, { password });
      onSuccess();
    } catch {
      setError('Неверный пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center" data-testid="pf-password-gate">
      <motion.form
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-sm space-y-4"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            <Lock className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Личные файлы</h2>
            <p className="text-slate-500 text-xs">Введите пароль для доступа</p>
          </div>
        </div>
        <Input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          placeholder="Пароль"
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          autoFocus
          data-testid="pf-password-input"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <Button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white"
          data-testid="pf-password-submit"
        >
          {loading ? 'Проверка...' : 'Войти'}
        </Button>
      </motion.form>
    </div>
  );
}

// ==================== FILE PREVIEW MODAL ====================
function PreviewModal({ file, onClose }) {
  if (!file) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="pf-preview-modal"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          data-testid="pf-preview-close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        {file.file_type === 'video' ? (
          <video
            src={fileUrl(file)}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] rounded-xl"
            data-testid="pf-preview-video"
          />
        ) : (
          <img
            src={fileUrl(file)}
            alt={file.name}
            className="max-w-full max-h-[80vh] rounded-xl object-contain"
            data-testid="pf-preview-image"
          />
        )}

        {/* File info */}
        <div className="mt-3 text-center">
          <p className="text-white text-sm font-medium truncate max-w-[400px]">{file.name}</p>
          <p className="text-slate-400 text-xs">{formatSize(file.size)}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function PersonalFilesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null); // null = root
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]); // [{name, progress, status}]
  const [previewFile, setPreviewFile] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // {folderId, x, y}

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'admin') { navigate('/'); return; }
  }, [user, authLoading, navigate]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/personal-files/folders`);
      setFolders(res.data.folders || []);
    } catch {}
  }, []);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentFolder) params.folder_id = currentFolder;
      if (searchQuery) params.search = searchQuery;
      const res = await axios.get(`${API}/personal-files/files`, { params });
      setFiles(res.data.files || []);
    } catch {}
    finally { setLoading(false); }
  }, [currentFolder, searchQuery]);

  useEffect(() => {
    if (!authenticated) return;
    fetchFolders();
    fetchFiles();
  }, [authenticated, fetchFolders, fetchFiles]);

  // Debounced search
  useEffect(() => {
    if (!authenticated) return;
    const timer = setTimeout(fetchFiles, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const queue = Array.from(fileList).map(f => ({ name: f.name, progress: 0, status: 'pending', size: f.size }));
    setUploadQueue(queue);
    setUploading(true);

    const CONCURRENCY = 3;
    let successCount = 0;
    let idx = 0;

    const uploadOne = async () => {
      while (idx < fileList.length) {
        const i = idx++;
        const file = fileList[i];
        setUploadQueue(prev => prev.map((q, j) => j === i ? { ...q, status: 'uploading' } : q));
        try {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('folder_id', currentFolder || '');
          await axios.post(`${API}/personal-files/upload`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e) => {
              const pct = Math.round((e.loaded * 100) / (e.total || 1));
              setUploadQueue(prev => prev.map((q, j) => j === i ? { ...q, progress: pct } : q));
            }
          });
          setUploadQueue(prev => prev.map((q, j) => j === i ? { ...q, progress: 100, status: 'done' } : q));
          successCount++;
        } catch {
          setUploadQueue(prev => prev.map((q, j) => j === i ? { ...q, status: 'error' } : q));
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fileList.length) }, () => uploadOne()));

    if (successCount > 0) {
      fetchFiles();
      fetchFolders();
    }
    setUploading(false);
    setTimeout(() => setUploadQueue([]), 3000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await axios.post(`${API}/personal-files/folders`, { name: newFolderName.trim() });
      setNewFolderName('');
      setShowNewFolder(false);
      fetchFolders();
    } catch {
      toast.error('Ошибка создания папки');
    }
  };

  const handleRenameFolder = async (folderId) => {
    if (!editFolderName.trim()) return;
    try {
      await axios.put(`${API}/personal-files/folders/${folderId}`, { name: editFolderName.trim() });
      setEditingFolder(null);
      setEditFolderName('');
      fetchFolders();
    } catch {
      toast.error('Ошибка переименования');
    }
  };

  const handleDeleteFolder = async (folderId, folderName) => {
    if (!window.confirm(`Удалить папку "${folderName}" и все файлы в ней?`)) return;
    try {
      await axios.delete(`${API}/personal-files/folders/${folderId}`);
      if (currentFolder === folderId) setCurrentFolder(null);
      fetchFolders();
      fetchFiles();
      toast.success('Папка удалена');
    } catch {
      toast.error('Ошибка удаления');
    }
    setContextMenu(null);
  };

  const handleDeleteFile = async (fileId, fileName) => {
    if (!window.confirm(`Удалить "${fileName}"?`)) return;
    try {
      await axios.delete(`${API}/personal-files/files/${fileId}`);
      toast.success('Файл удалён');
      fetchFiles();
      fetchFolders();
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const currentFolderName = folders.find(f => f.id === currentFolder)?.name;

  if (!authenticated) {
    return <PasswordGate onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div
      className="min-h-screen bg-slate-950 text-white"
      data-testid="pf-main"
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          {currentFolder && (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              onClick={() => { setCurrentFolder(null); setSearchQuery(''); }}
              data-testid="pf-back-btn"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Назад
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-slate-500" />
            <h1 className="text-sm font-semibold text-slate-300">
              {currentFolderName || 'Личные файлы'}
            </h1>
          </div>

          <div className="flex-1 max-w-xs ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск..."
                className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 rounded-xl h-9 text-sm"
                data-testid="pf-search"
              />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.gif"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="pf-upload-btn"
          >
            <Upload className="w-4 h-4 mr-1" />
            {uploading ? 'Загрузка...' : 'Загрузить'}
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Folders (only shown in root) */}
        {!currentFolder && !searchQuery && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Папки</h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl h-7 text-xs"
                onClick={() => setShowNewFolder(true)}
                data-testid="pf-new-folder-btn"
              >
                <FolderPlus className="w-3.5 h-3.5 mr-1" /> Новая папка
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {/* New folder input */}
              <AnimatePresence>
                {showNewFolder && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex flex-col items-center gap-2"
                  >
                    <Folder className="w-8 h-8 text-amber-400" />
                    <Input
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      placeholder="Название"
                      className="h-7 text-xs bg-slate-900 border-slate-600 text-white text-center"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
                      }}
                      data-testid="pf-new-folder-input"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs bg-teal-600 hover:bg-teal-500 rounded-lg px-3" onClick={handleCreateFolder} data-testid="pf-new-folder-save">
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-400 hover:text-white rounded-lg" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {folders.map(folder => (
                <div
                  key={folder.id}
                  className="relative group"
                >
                  {editingFolder === folder.id ? (
                    <div className="bg-slate-800/50 border border-teal-600 rounded-xl p-3 flex flex-col items-center gap-2">
                      <Folder className="w-8 h-8 text-amber-400" />
                      <Input
                        value={editFolderName}
                        onChange={e => setEditFolderName(e.target.value)}
                        className="h-7 text-xs bg-slate-900 border-slate-600 text-white text-center"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameFolder(folder.id);
                          if (e.key === 'Escape') { setEditingFolder(null); setEditFolderName(''); }
                        }}
                      />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-xs bg-teal-600 hover:bg-teal-500 rounded-lg px-3" onClick={() => handleRenameFolder(folder.id)}>
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-400 hover:text-white rounded-lg" onClick={() => { setEditingFolder(null); setEditFolderName(''); }}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCurrentFolder(folder.id)}
                      className="w-full bg-slate-800/30 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all"
                      data-testid={`pf-folder-${folder.id}`}
                    >
                      <Folder className="w-8 h-8 text-amber-400" />
                      <span className="text-xs text-slate-300 truncate w-full text-center">{folder.name}</span>
                      <span className="text-[10px] text-slate-600">{folder.file_count} файлов</span>
                    </button>
                  )}

                  {/* Folder context menu trigger */}
                  {editingFolder !== folder.id && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setContextMenu(contextMenu?.folderId === folder.id ? null : { folderId: folder.id });
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Context menu */}
                  <AnimatePresence>
                    {contextMenu?.folderId === folder.id && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-8 right-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[120px]"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingFolder(folder.id);
                            setEditFolderName(folder.name);
                            setContextMenu(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Pencil className="w-3 h-3" /> Переименовать
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(folder.id, folder.name)}
                          className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" /> Удалить
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files grid */}
        <div>
          {!searchQuery && (
            <div className="flex items-center gap-2 mb-3">
              <Grid3X3 className="w-4 h-4 text-slate-500" />
              <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                {searchQuery ? 'Результаты поиска' : currentFolder ? 'Файлы' : 'Все файлы'}
              </h2>
              <span className="text-[10px] text-slate-600">{files.length}</span>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-20 text-slate-600">
              <Image className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{searchQuery ? 'Ничего не найдено' : 'Нет файлов'}</p>
              {!searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-slate-500 hover:text-white"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" /> Загрузить файлы
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {files.map(file => (
                <motion.div
                  key={file.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="group relative bg-slate-800/30 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:shadow-slate-900/50"
                  onClick={() => setPreviewFile(file)}
                  data-testid={`pf-file-${file.id}`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square relative bg-slate-900 flex items-center justify-center overflow-hidden">
                    {file.file_type === 'video' ? (
                      <>
                        <video
                          src={fileUrl(file)}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-5 h-5 text-white ml-0.5" />
                          </div>
                        </div>
                      </>
                    ) : (file.file_type === 'image' || file.file_type === 'gif') ? (
                      <img src={fileUrl(file)} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <FileIcon type={file.file_type} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs text-slate-400 truncate">{file.name}</p>
                    <p className="text-[10px] text-slate-600">{formatSize(file.size)}</p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteFile(file.id, file.name); }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/50 hover:bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all"
                    data-testid={`pf-delete-file-${file.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Type badge */}
                  {file.file_type === 'gif' && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-pink-500/80 text-white text-[9px] font-bold rounded-md uppercase">
                      GIF
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      </AnimatePresence>

      {/* Upload Progress Panel */}
      <AnimatePresence>
        {uploadQueue.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 right-4 z-40 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            data-testid="pf-upload-progress"
          >
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                {uploading ? 'Загрузка файлов...' : 'Загрузка завершена'}
              </span>
              <span className="text-[10px] text-slate-500">
                {uploadQueue.filter(q => q.status === 'done').length}/{uploadQueue.length}
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto p-2 space-y-1.5">
              {uploadQueue.map((item, i) => (
                <div key={i} className="px-2 py-1.5 rounded-lg bg-slate-800/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 truncate max-w-[200px]">{item.name}</span>
                    <span className="text-[10px] ml-2 flex-shrink-0">
                      {item.status === 'done' && <span className="text-teal-400">OK</span>}
                      {item.status === 'error' && <span className="text-red-400">ERR</span>}
                      {item.status === 'uploading' && <span className="text-blue-400">{item.progress}%</span>}
                      {item.status === 'pending' && <span className="text-slate-600">...</span>}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        item.status === 'error' ? 'bg-red-500' :
                        item.status === 'done' ? 'bg-teal-500' : 'bg-blue-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
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
