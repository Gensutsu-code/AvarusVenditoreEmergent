import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  MessageCircle, Send, Image, Paperclip, User, Clock, CheckCheck,
  ChevronLeft, Search, X, Play
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Media lightbox components
const ImageLightbox = ({ src, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
    <button className="absolute top-4 right-4 text-white hover:text-zinc-300" onClick={onClose}>
      <X className="w-8 h-8" />
    </button>
    <img src={src} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
  </div>
);

const VideoLightbox = ({ src, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
    <button className="absolute top-4 right-4 text-white hover:text-zinc-300" onClick={onClose}>
      <X className="w-8 h-8" />
    </button>
    <div className="max-w-4xl w-full aspect-video" onClick={(e) => e.stopPropagation()}>
      <video src={src} controls autoPlay className="w-full h-full rounded-lg bg-black">
        Ваш браузер не поддерживает видео
      </video>
    </div>
  </div>
);

export default function AdminChatsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Lightbox states
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxVideo, setLightboxVideo] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchChats();
  }, [user, authLoading, navigate]);

  // Polling for new messages
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    
    const interval = setInterval(() => {
      fetchChats();
      if (selectedChat) {
        fetchMessages(selectedChat.id, false);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [user, selectedChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChats = async () => {
    try {
      const res = await axios.get(`${API}/admin/chats`);
      setChats(res.data);
    } catch (err) {
      console.error('Failed to fetch chats', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/chats/${chatId}/messages`);
      setMessages(res.data);
      // Mark as read
      await axios.post(`${API}/admin/chats/${chatId}/read`);
      fetchChats(); // Refresh unread count
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const selectChat = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || sending) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/admin/chats/${selectedChat.id}/messages`, {
        content: newMessage.trim(),
        type: 'text'
      });
      setNewMessage('');
      fetchMessages(selectedChat.id, false);
    } catch (err) {
      toast.error('Ошибка отправки сообщения');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setSending(true);
    try {
      await axios.post(`${API}/admin/chats/${selectedChat.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchMessages(selectedChat.id, false);
    } catch (err) {
      toast.error('Ошибка загрузки файла');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  const filteredChats = chats.filter(chat => 
    !searchQuery || 
    chat.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

  if (authLoading || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-zinc-950' : ''}`}>
        <motion.div 
          className={`w-8 h-8 border-2 ${isDark ? 'border-orange-500' : 'border-teal-500'} border-t-transparent rounded-full`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : ''}`} data-testid="admin-chats-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className={`text-2xl md:text-3xl font-bold tracking-tight uppercase ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <span className={`bg-gradient-to-r ${isDark ? 'from-orange-400 to-orange-600' : 'from-teal-500 to-emerald-500'} bg-clip-text text-transparent`}>
              Чаты с клиентами
            </span>
            {totalUnread > 0 && (
              <span className="ml-3 px-2 py-1 text-sm bg-red-500 text-white rounded-full">
                {totalUnread}
              </span>
            )}
          </h1>
        </div>

        <div className={`glass-card overflow-hidden flex h-[calc(100vh-200px)] min-h-[500px]`}>
          {/* Chats List */}
          <div className={`w-80 flex-shrink-0 border-r ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex flex-col`}>
            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
                <Input
                  placeholder="Поиск чатов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-input"
                />
              </div>
            </div>
            
            {/* Chats */}
            <div className="flex-1 overflow-y-auto">
              {filteredChats.length === 0 ? (
                <div className={`text-center py-12 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Чатов нет</p>
                </div>
              ) : (
                filteredChats.map(chat => (
                  <motion.button
                    key={chat.id}
                    onClick={() => selectChat(chat)}
                    className={`w-full p-4 flex items-center gap-3 transition-colors text-left ${
                      selectedChat?.id === chat.id 
                        ? isDark ? 'bg-orange-500/10 border-l-2 border-orange-500' : 'bg-teal-500/10 border-l-2 border-teal-500'
                        : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-white/50'
                    }`}
                    whileHover={{ x: 2 }}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                      <User className={`w-5 h-5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium truncate ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                          {chat.user_name || 'Без имени'}
                        </span>
                        {chat.unread_count > 0 && (
                          <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                        {chat.last_message || 'Нет сообщений'}
                      </p>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className={`p-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex items-center gap-3`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                    <User className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-teal-600'}`} />
                  </div>
                  <div>
                    <h3 className={`font-medium ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                      {selectedChat.user_name || 'Без имени'}
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                      {selectedChat.user_email}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, index) => {
                    const isAdmin = msg.sender === 'admin';
                    const showDate = index === 0 || 
                      formatDate(messages[index - 1].created_at) !== formatDate(msg.created_at);
                    
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="text-center my-4">
                            <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-slate-100 text-slate-400'}`}>
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${
                            isAdmin 
                              ? isDark ? 'bg-orange-500/20 text-orange-100' : 'bg-teal-500/20 text-green-900'
                              : isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-white text-slate-700'
                          } rounded-2xl px-4 py-2 shadow-sm`}>
                            {msg.type === 'image' ? (
                              <img 
                                src={msg.content} 
                                alt="" 
                                className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setLightboxImage(msg.content)}
                              />
                            ) : msg.type === 'video' ? (
                              <div 
                                className="relative cursor-pointer group"
                                onClick={() => setLightboxVideo(msg.content)}
                              >
                                <video src={msg.content} className="max-w-full rounded-lg" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg group-hover:bg-black/40 transition-colors">
                                  <Play className="w-12 h-12 text-white" />
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                            <div className={`flex items-center gap-1 justify-end mt-1 ${
                              isAdmin 
                                ? isDark ? 'text-orange-300/60' : 'text-teal-600/60'
                                : isDark ? 'text-zinc-500' : 'text-slate-400'
                            }`}>
                              <span className="text-xs">{formatTime(msg.created_at)}</span>
                              {isAdmin && <CheckCheck className="w-3 h-3" />}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*,video/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                      className={isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-700'}
                    >
                      <Paperclip className="w-5 h-5" />
                    </Button>
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Напишите сообщение..."
                      className="flex-1 glass-input"
                      disabled={sending}
                    />
                    <Button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className={`${isDark ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Выберите чат для просмотра сообщений</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />}
      {lightboxVideo && <VideoLightbox src={lightboxVideo} onClose={() => setLightboxVideo(null)} />}
    </div>
  );
}
