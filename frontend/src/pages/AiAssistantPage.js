import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Sparkles, Send, Loader2, Package, RotateCcw, Bot, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SESSION_KEY = 'ai_assistant_session';
const fmtPrice = (v) => new Intl.NumberFormat('ru-RU').format(Math.round(v || 0));
const newSessionId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const EXAMPLES = [
  'Нужен топливный фильтр на DAF XF 105',
  'Что есть из датчиков давления BOSCH?',
  'Подберите масляный фильтр, машина MAN TGA',
];

const ProductChips = ({ products }) => (
  <div className="mt-3 grid sm:grid-cols-2 gap-2">
    {products.map((p) => (
      <Link key={p.id} to={`/product/${p.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 hover:border-teal-400 transition-colors" data-testid={`ai-product-${p.id}`}>
        <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800 line-clamp-2">{p.name}</p>
          <p className="text-[11px] text-slate-500"><span className="font-mono">{p.article}</span> · <b className="text-teal-600">{fmtPrice(p.price)} ₽</b> · {p.in_stock ? 'в наличии' : 'под заказ'}</p>
        </div>
      </Link>
    ))}
  </div>
);

export default function AiAssistantPage() {
  const { user, token } = useAuth();
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) return saved;
    const id = newSessionId();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API}/ai/assistant/history`, { params: { session_id: sessionId } })
      .then((r) => setMessages((r.data.messages || []).map((m) => ({ role: m.role, text: m.text, products: m.products || [] }))))
      .catch(() => {});
  }, [user, sessionId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const patchLast = (fn) => setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    setBusy(true);
    setMessages((prev) => [...prev, { role: 'user', text: msg, products: [] }, { role: 'assistant', text: '', products: [], pending: true }]);
    try {
      const res = await fetch(`${API}/ai/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || localStorage.getItem('token')}` },
        body: JSON.stringify({ session_id: sessionId, message: msg }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'ИИ-помощник временно недоступен. Попробуйте позже.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop();
        chunks.forEach((chunk) => {
          if (!chunk.startsWith('data: ')) return;
          const ev = JSON.parse(chunk.slice(6));
          if (ev.type === 'delta') patchLast((m) => ({ ...m, text: m.text + ev.text }));
          else if (ev.type === 'done') patchLast((m) => ({ ...m, pending: false, products: ev.products || [] }));
          else if (ev.type === 'error') throw new Error(ev.message);
        });
      }
      patchLast((m) => ({ ...m, pending: false }));
    } catch (e) {
      toast.error(e.message || 'Ошибка');
      setMessages((prev) => (prev.length && prev[prev.length - 1].pending && !prev[prev.length - 1].text ? prev.slice(0, -1) : prev.map((m) => ({ ...m, pending: false }))));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    const id = newSessionId();
    localStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
    setMessages([]);
  };

  return (
    <div className="min-h-screen" data-testid="ai-assistant-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30"><Sparkles className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800">ИИ-помощник по запчастям</h1>
              <p className="text-sm text-slate-500">Опишите, что нужно — помощник подберёт товары из нашего каталога. Это автоматический помощник, ответы стоит перепроверять.</p>
            </div>
          </div>
          {user && messages.length > 0 && (
            <Button variant="outline" onClick={reset} disabled={busy} className="rounded-xl flex-shrink-0" data-testid="ai-new-dialog-btn"><RotateCcw className="w-4 h-4 mr-1.5" />Новый диалог</Button>
          )}
        </div>

        {!user ? (
          <div className="glass-card p-10 text-center" data-testid="ai-login-required">
            <p className="text-slate-600 mb-4">Войдите в аккаунт, чтобы задать вопрос помощнику.</p>
            <Link to="/login"><Button className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl">Войти</Button></Link>
          </div>
        ) : (
          <div className="glass-card p-4 md:p-6">
            <div className="space-y-4 min-h-[320px] max-h-[58vh] overflow-y-auto pr-1" data-testid="ai-messages">
              {messages.length === 0 && (
                <div className="py-8" data-testid="ai-empty-state">
                  <p className="text-sm text-slate-500 mb-3">Например:</p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLES.map((ex) => (
                      <button key={ex} onClick={() => send(ex)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 hover:border-teal-400 hover:text-teal-700 transition-colors" data-testid="ai-example-btn">{ex}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`} data-testid={`ai-message-${m.role}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-teal-100 text-teal-600'}`}>
                    {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-teal-500 text-white' : 'bg-slate-50 border border-slate-200 text-slate-800'}`}>
                    {m.pending && !m.text ? <Loader2 className="w-4 h-4 animate-spin text-teal-500" /> : <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
                    {m.role === 'assistant' && m.products?.length > 0 && <ProductChips products={m.products} />}
                  </div>
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 mt-4 pt-4 border-t border-slate-200">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Например: нужен топливный фильтр на DAF XF 105"
                rows={2}
                maxLength={1500}
                className="flex-1 resize-none rounded-xl border-slate-200 focus:border-teal-400"
                data-testid="ai-input"
              />
              <Button type="submit" disabled={busy || !input.trim()} className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-11" data-testid="ai-send-btn">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
