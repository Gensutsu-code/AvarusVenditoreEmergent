import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MessageCircle, X, Send, Paperclip, Image, Smile, FileText, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Normalize file URL - handle local uploads and Google Drive URLs
const normalizeFileUrl = (fileUrl) => {
  if (!fileUrl) return '';
  // If URL is already a full URL (Google Drive, etc.), return as is
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  // If URL starts with /uploads/ (old format), convert to /api/uploads/
  if (fileUrl.startsWith('/uploads/')) {
    return `${BACKEND_URL}/api${fileUrl}`;
  }
  // If URL already has /api/uploads/, just prepend BACKEND_URL
  if (fileUrl.startsWith('/api/uploads/')) {
    return `${BACKEND_URL}${fileUrl}`;
  }
  // For any other format, return as is with BACKEND_URL
  return `${BACKEND_URL}${fileUrl}`;
};

// Check if URL is a Cloudinary video
const isCloudinaryVideo = (url) => {
  return url && url.includes('cloudinary.com') && url.includes('/video/');
};

// Check if URL is a Google Drive video (legacy support)
const isGoogleDriveVideo = (url) => {
  return url && url.includes('drive.google.com') && url.includes('/preview');
};

// Get Google Drive embed URL for video (legacy support)
const getGoogleDriveVideoUrl = (url) => {
  if (!url) return '';
  // Already a preview URL
  if (url.includes('/preview')) return url;
  // Extract file ID and create preview URL
  const match = url.match(/id=([^&]+)/);
  if (match) {
    return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  return url;
};

// Common emoji list
const EMOJI_LIST = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💖', '💗', '💘', '💝'];

// Image Lightbox Component
const ImageLightbox = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  
  return (
    <div 
      className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full transition-colors z-10"
      >
        <X className="w-8 h-8" />
      </button>
      
      {/* Zoom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
          disabled={scale <= 0.5}
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-white text-sm font-medium w-16 text-center">{Math.round(scale * 100)}%</span>
        <button 
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
          disabled={scale >= 3}
        >
          <ZoomIn className="w-5 h-5" />
        </button>
      </div>
      
      {/* Image */}
      <img 
        src={src} 
        alt="Увеличенное изображение"
        className="max-w-[90vw] max-h-[85vh] object-contain transition-transform duration-200"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export const ChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && isOpen) {
      fetchMessages();
      markAsRead();
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(() => {
        fetchUnreadCount();
        if (isOpen) fetchMessages();
      }, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [user, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/chat/messages`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await axios.get(`${API}/chat/unread-count`);
      setUnreadCount(res.data.count || 0);
    } catch (err) {
      console.error('Failed to fetch unread count', err);
    }
  };

  const markAsRead = async () => {
    try {
      await axios.post(`${API}/chat/mark-read`);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    try {
      await axios.post(`${API}/chat/send`, { text: newMessage });
      setNewMessage('');
      setShowEmoji(false);
      fetchMessages();
    } catch (err) {
      console.error('Failed to send message', err);
      toast.error('Ошибка отправки сообщения');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload file to Google Drive
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await axios.post(`${API}/chat/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Send media message
      await axios.post(`${API}/chat/send-media`, null, {
        params: {
          file_url: uploadRes.data.url,
          filename: uploadRes.data.filename,
          is_image: uploadRes.data.is_image,
          is_video: uploadRes.data.is_video,
          caption: ''
        }
      });

      fetchMessages();
      toast.success('Файл отправлен');
    } catch (err) {
      console.error('Failed to upload file', err);
      toast.error('Ошибка загрузки файла');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const insertEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji);
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  if (!user) return null;

  return (
    <>
      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <ImageLightbox 
          src={lightboxImage} 
          onClose={() => setLightboxImage(null)} 
        />
      )}

      {/* Chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white p-5 rounded-full shadow-lg z-40 transition-all hover:scale-105 hover:shadow-xl"
        data-testid="chat-widget-button"
      >
        <MessageCircle className="w-7 h-7" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full font-bold animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div 
          className="fixed bottom-6 left-6 w-80 sm:w-96 bg-white border border-zinc-200 shadow-2xl z-50 flex flex-col rounded-lg overflow-hidden"
          style={{ height: '500px' }}
          data-testid="chat-widget"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <div>
              <h3 className="font-semibold">Онлайн-чат</h3>
              <p className="text-xs text-orange-100 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Поддержка avopt.store
              </p>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
              data-testid="chat-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-zinc-50 to-white">
            {messages.length === 0 ? (
              <div className="text-center text-zinc-400 text-sm py-8">
                <div className="w-16 h-16 mx-auto mb-3 bg-orange-100 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-orange-500" />
                </div>
                <p className="font-medium text-zinc-600">Напишите нам!</p>
                <p className="text-xs mt-1">Мы ответим как можно скорее</p>
              </div>
            ) : (
              Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  {/* Date divider */}
                  <div className="flex items-center justify-center my-3">
                    <span className="text-xs text-zinc-400 bg-white px-3 py-1 rounded-full border border-zinc-100">
                      {formatDate(msgs[0].created_at)}
                    </span>
                  </div>
                  
                  {msgs.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex mb-3 ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-3 py-2 text-sm ${
                          msg.sender_type === 'user'
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl rounded-br-sm'
                            : 'bg-white border border-zinc-200 text-zinc-800 rounded-2xl rounded-bl-sm shadow-sm'
                        }`}
                      >
                        {msg.sender_type === 'admin' && (
                          <p className="text-xs font-semibold text-orange-500 mb-1">Поддержка</p>
                        )}
                        
                        {/* Image message */}
                        {msg.message_type === 'image' && msg.file_url && (
                          <div className="mb-2">
                            <img 
                              src={normalizeFileUrl(msg.file_url)} 
                              alt="Изображение" 
                              className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setLightboxImage(normalizeFileUrl(msg.file_url))}
                              data-testid="chat-image"
                            />
                          </div>
                        )}
                        
                        {/* Video message */}
                        {msg.message_type === 'video' && msg.file_url && (
                          <div className="mb-2">
                            {isGoogleDriveVideo(msg.file_url) ? (
                              <iframe
                                src={getGoogleDriveVideoUrl(msg.file_url)}
                                className="w-full aspect-video rounded-lg"
                                allow="autoplay"
                                allowFullScreen
                                title="Видео"
                              />
                            ) : (
                              <video 
                                src={normalizeFileUrl(msg.file_url)} 
                                controls
                                className="max-w-full rounded-lg"
                                data-testid="chat-video"
                              >
                                Ваш браузер не поддерживает видео
                              </video>
                            )}
                          </div>
                        )}
                        
                        {/* File message */}
                        {msg.message_type === 'file' && msg.file_url && (
                          <a 
                            href={normalizeFileUrl(msg.file_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-lg mb-2 ${
                              msg.sender_type === 'user' ? 'bg-white/20' : 'bg-zinc-100'
                            }`}
                          >
                            <FileText className="w-5 h-5" />
                            <span className="text-sm truncate">{msg.filename || 'Файл'}</span>
                            <Download className="w-4 h-4 ml-auto" />
                          </a>
                        )}
                        
                        {/* Text */}
                        {msg.text && (
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        )}
                        
                        {/* Time and edited badge */}
                        <div className={`flex items-center gap-1 text-[10px] mt-1 ${
                          msg.sender_type === 'user' ? 'text-orange-200' : 'text-zinc-400'
                        }`}>
                          {formatTime(msg.created_at)}
                          {msg.edited && <span>(ред.)</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Emoji picker */}
          {showEmoji && (
            <div className="border-t border-zinc-200 bg-white p-2 max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {EMOJI_LIST.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => insertEmoji(emoji)}
                    className="hover:bg-zinc-100 p-1 rounded text-lg transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t border-zinc-200 bg-white">
            <div className="flex items-center gap-2">
              {/* File upload */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 hover:bg-zinc-100 rounded-full text-zinc-500 hover:text-orange-500 transition-colors"
                title="Прикрепить файл"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              {/* Emoji button */}
              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                className={`p-2 rounded-full transition-colors ${
                  showEmoji ? 'bg-orange-100 text-orange-500' : 'hover:bg-zinc-100 text-zinc-500 hover:text-orange-500'
                }`}
                title="Эмодзи"
              >
                <Smile className="w-5 h-5" />
              </button>
              
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1 border-zinc-200 focus:border-orange-300 focus:ring-orange-200"
                disabled={loading || uploading}
                data-testid="chat-input"
              />
              
              <Button
                type="submit"
                disabled={loading || uploading || !newMessage.trim()}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-full p-2 h-auto"
                data-testid="chat-send-btn"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            
            {uploading && (
              <p className="text-xs text-zinc-400 mt-2 text-center">Загрузка файла...</p>
            )}
          </form>
        </div>
      )}
    </>
  );
};
