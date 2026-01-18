import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const ChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

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
      }, 10000);
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
      fetchMessages();
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) return null;

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 bg-orange-500 hover:bg-orange-600 text-white p-5 rounded-full shadow-lg z-40 transition-transform hover:scale-105"
        data-testid="chat-widget-button"
      >
        <MessageCircle className="w-7 h-7" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div 
          className="fixed bottom-6 left-6 w-80 sm:w-96 bg-white border border-zinc-200 shadow-xl z-50 flex flex-col"
          style={{ height: '450px' }}
          data-testid="chat-widget"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-orange-500 text-white">
            <div>
              <h3 className="font-semibold">Онлайн-чат</h3>
              <p className="text-xs text-orange-100">Поддержка avopt.store</p>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="hover:bg-orange-600 p-1 rounded"
              data-testid="chat-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
            {messages.length === 0 ? (
              <div className="text-center text-zinc-400 text-sm py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Напишите нам!</p>
                <p className="text-xs">Мы ответим как можно скорее</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                      msg.sender_type === 'user'
                        ? 'bg-orange-500 text-white'
                        : 'bg-white border border-zinc-200 text-zinc-800'
                    }`}
                  >
                    {msg.sender_type === 'admin' && (
                      <p className="text-xs font-semibold text-orange-500 mb-1">Поддержка</p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.sender_type === 'user' ? 'text-orange-200' : 'text-zinc-400'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t border-zinc-200 bg-white">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1"
                disabled={loading}
                data-testid="chat-input"
              />
              <Button
                type="submit"
                disabled={loading || !newMessage.trim()}
                className="bg-orange-500 hover:bg-orange-600"
                data-testid="chat-send-btn"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
