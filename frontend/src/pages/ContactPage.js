import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { MessageCircle, Percent, Clock, ClipboardList, Send, Loader2, TrendingUp, CheckCircle, XCircle, Hourglass, Package, Tag, Paperclip, Smile, FileText, Download, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { ProductRequestOffer } from '../components/ProductRequestOffer';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const fmt = (p) => new Intl.NumberFormat('ru-RU').format(Math.round(p || 0));

const EMOJI_LIST = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰', '😘', '😋', '😎', '🤔', '😐', '🙄', '😴', '🤗', '👍', '👎', '👌', '✌️', '🙏', '❤️', '🔥', '🎉', '✅', '❌', '💰', '📦', '🚚', '⏰', '💯'];

const REQ_STATUS = {
  pending: { label: 'На рассмотрении', cls: 'bg-amber-100 text-amber-700', Icon: Hourglass },
  processing: { label: 'В обработке', cls: 'bg-blue-100 text-blue-700', Icon: Clock },
  offered: { label: 'Предложение', cls: 'bg-teal-100 text-teal-700', Icon: Tag },
  accepted: { label: 'Принято вами', cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
  approved: { label: 'Одобрено', cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
  completed: { label: 'Выполнен', cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
  rejected: { label: 'Отклонён', cls: 'bg-rose-100 text-rose-700', Icon: XCircle },
  rejected_by_client: { label: 'Отклонён вами', cls: 'bg-rose-100 text-rose-700', Icon: XCircle },
};

const TABS = [
  { id: 'chat', label: 'Чат', Icon: MessageCircle },
  { id: 'discounts', label: 'Скидки и условия', Icon: Percent },
  { id: 'deferral', label: 'Отсрочка', Icon: Clock },
  { id: 'history', label: 'Мои обращения', Icon: ClipboardList },
];

const normalizeUrl = (u) => {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  if (u.startsWith('/uploads/')) return `${BACKEND_URL}/api${u}`;
  return `${BACKEND_URL}${u}`;
};

function StatusBadge({ status }) {
  const cfg = REQ_STATUS[status] || REQ_STATUS.pending;
  const { Icon } = cfg;
  return <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}><Icon className="w-3 h-3" />{cfg.label}</span>;
}

export default function ContactPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('chat');

  // chat
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const msgContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // discounts/conditions
  const [discPercent, setDiscPercent] = useState('');
  const [discReason, setDiscReason] = useState('');
  const [myReqs, setMyReqs] = useState({ discount_request: null });
  const [submittingDisc, setSubmittingDisc] = useState(false);

  // deferral
  const [credit, setCredit] = useState(null);
  const [creditLimit, setCreditLimit] = useState('');
  const [creditMsg, setCreditMsg] = useState('');
  const [submittingCredit, setSubmittingCredit] = useState(false);

  // history
  const [discReqs, setDiscReqs] = useState([]);
  const [prodReqs, setProdReqs] = useState([]);
  const [indPrices, setIndPrices] = useState([]);

  const fetchChat = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/chat/messages`);
      setMessages(res.data.messages || []);
      axios.post(`${API}/chat/mark-read`).catch(() => {});
    } catch {}
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const [mr, cr, dr, pr, ip] = await Promise.all([
        axios.get(`${API}/my-requests`),
        axios.get(`${API}/credit/my`),
        axios.get(`${API}/discount-requests/my`),
        axios.get(`${API}/product-requests/my`),
        axios.get(`${API}/individual-prices/my`),
      ]);
      setMyReqs(mr.data);
      setCredit(cr.data);
      setDiscReqs(dr.data || []);
      setProdReqs(pr.data || []);
      setIndPrices(ip.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchChat();
    fetchRequests();
  }, [user, authLoading, navigate, fetchChat, fetchRequests]);

  // poll chat while on chat tab
  useEffect(() => {
    if (tab !== 'chat' || !user) return;
    const i = setInterval(fetchChat, 5000);
    return () => clearInterval(i);
  }, [tab, user, fetchChat]);

  // refresh requests/statuses each time the "Мои обращения" tab is opened
  useEffect(() => {
    if (tab === 'history' && user) fetchRequests();
  }, [tab, user, fetchRequests]);

  // Scroll only the chat container (never the page)
  const scrollChatToBottom = () => {
    const el = msgContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Jump to latest only when opening the chat tab (no auto-scroll on incoming messages)
  useEffect(() => {
    if (tab === 'chat') setTimeout(scrollChatToBottom, 80);
  }, [tab]);

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text) return;
    setSending(true);
    setChatText('');
    setShowEmoji(false);
    try {
      await axios.post(`${API}/chat/send`, { text });
      await fetchChat();
      setTimeout(scrollChatToBottom, 60);
    } catch { toast.error('Не удалось отправить'); setChatText(text); } finally { setSending(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post(`${API}/chat/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await axios.post(`${API}/chat/send-media`, null, {
        params: {
          file_url: uploadRes.data.url,
          filename: uploadRes.data.filename,
          is_image: uploadRes.data.is_image,
          is_video: uploadRes.data.is_video,
          caption: ''
        }
      });
      await fetchChat();
      setTimeout(scrollChatToBottom, 60);
      toast.success('Файл отправлен');
    } catch { toast.error('Ошибка загрузки файла'); } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const insertEmoji = (emoji) => setChatText((prev) => prev + emoji);

  const submitDiscount = async () => {
    const val = Number(discPercent);
    if (!val || val <= 0 || val > 50) { toast.error('Скидка от 1% до 50%'); return; }
    if (!discReason.trim()) { toast.error('Укажите причину'); return; }
    setSubmittingDisc(true);
    try {
      await axios.post(`${API}/request-individual-discount`, { requested_discount: val, reason: discReason.trim() });
      toast.success('Запрос на скидку отправлен');
      setDiscPercent(''); setDiscReason('');
      fetchRequests();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmittingDisc(false); }
  };

  const submitCredit = async () => {
    const val = Number(creditLimit);
    if (!val || val <= 0) { toast.error('Укажите сумму лимита'); return; }
    setSubmittingCredit(true);
    try {
      await axios.post(`${API}/credit/request`, { requested_limit: val, message: creditMsg });
      toast.success('Запрос на отсрочку отправлен');
      setCreditLimit(''); setCreditMsg('');
      fetchRequests();
    } catch (e) { toast.error(e.response?.data?.detail || 'Ошибка'); } finally { setSubmittingCredit(false); }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-teal-500" /></div>;
  }

  const indDiscount = user.individual_discount || 0;
  const creditApproved = credit && credit.status === 'approved';

  return (
    <div className="min-h-screen bg-slate-50" data-testid="contact-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Связь с администрацией</h1>
            <p className="text-sm text-slate-500">Чат, запросы скидок, индивидуальных условий и отсрочки</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${tab === id ? 'bg-teal-500 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
              data-testid={`contact-tab-${id}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* CHAT */}
          {tab === 'chat' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col" style={{ height: '60vh' }} data-testid="contact-chat">
              <div ref={msgContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">Напишите нам — администрация ответит здесь</p>
                  </div>
                ) : messages.map((m) => {
                  const mine = m.sender_type === 'user';
                  const fileUrl = m.image_url || m.file_url;
                  const isImage = fileUrl && (m.message_type === 'image' || m.image_url);
                  const isFile = fileUrl && !isImage && m.message_type !== 'video';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? 'bg-teal-500 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                        {isImage && (
                          <img src={normalizeUrl(fileUrl)} alt="" onClick={() => setLightboxImage(normalizeUrl(fileUrl))} className="rounded-lg mb-1 max-h-48 object-cover cursor-pointer" data-testid="contact-chat-image" />
                        )}
                        {m.message_type === 'video' && fileUrl && (
                          <video src={normalizeUrl(fileUrl)} controls className="rounded-lg mb-1 max-h-48" />
                        )}
                        {isFile && (
                          <a href={normalizeUrl(fileUrl)} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded-lg mb-1 ${mine ? 'bg-white/20' : 'bg-white'}`}>
                            <FileText className="w-4 h-4" />
                            <span className="text-xs truncate max-w-[140px]">{m.filename || 'Файл'}</span>
                            <Download className="w-3.5 h-3.5 ml-auto" />
                          </a>
                        )}
                        {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
                        <p className={`text-[10px] mt-1 ${mine ? 'text-teal-100' : 'text-slate-400'}`}>{String(m.created_at).slice(11, 16)}</p>
                      </div>
                    </div>
                  );
                })}
                <div />
              </div>
              {showEmoji && (
                <div className="border-t border-slate-100 bg-white p-2 max-h-28 overflow-y-auto">
                  <div className="flex flex-wrap gap-1">
                    {EMOJI_LIST.map((emoji, idx) => (
                      <button key={idx} type="button" onClick={() => insertEmoji(emoji)} className="hover:bg-slate-100 p-1 rounded text-lg transition-transform hover:scale-125">{emoji}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-slate-100 p-3 flex items-center gap-2">
                <input ref={fileInputRef} type="file" onChange={handleFileUpload} accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar" className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 hover:bg-teal-50 rounded-full text-slate-400 hover:text-teal-500 transition-colors" title="Прикрепить файл" data-testid="contact-chat-attach">
                  <Paperclip className="w-5 h-5" />
                </button>
                <button type="button" onClick={() => setShowEmoji(!showEmoji)} className={`p-2 rounded-full transition-colors ${showEmoji ? 'bg-teal-100 text-teal-500' : 'hover:bg-teal-50 text-slate-400 hover:text-teal-500'}`} title="Эмодзи" data-testid="contact-chat-emoji">
                  <Smile className="w-5 h-5" />
                </button>
                <Input value={chatText} onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Введите сообщение..." className="rounded-xl flex-1" disabled={uploading} data-testid="contact-chat-input" />
                <Button onClick={sendChat} disabled={sending || uploading || !chatText.trim()} className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl px-4" data-testid="contact-chat-send">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              {uploading && <p className="text-xs text-slate-400 px-3 pb-2 text-center">Загрузка файла...</p>}
            </div>
          )}

          {/* DISCOUNTS & CONDITIONS */}
          {tab === 'discounts' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-slate-500">Индивидуальная скидка</p>
                <p className="text-lg font-bold text-emerald-600">{indDiscount}%</p>
              </div>

              {/* Individual discount request */}
              <div className="bg-white rounded-2xl p-5 shadow-sm" data-testid="contact-discount-block">
                <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2"><Percent className="w-4 h-4 text-teal-500" />Запросить индивидуальную скидку</h2>
                {myReqs.discount_request && !myReqs.discount_request.product_id ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <Hourglass className="w-4 h-4 text-amber-400" /> Запрос на {myReqs.discount_request.requested_discount}% на рассмотрении
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-500 mb-3">Скидка применяется ко всем заказам после одобрения.</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input type="number" min="1" max="50" value={discPercent} onChange={(e) => setDiscPercent(e.target.value)} placeholder="Желаемая скидка, %" className="rounded-xl sm:w-48" data-testid="contact-discount-percent" />
                      <Input value={discReason} onChange={(e) => setDiscReason(e.target.value)} placeholder="Причина / обоснование" className="rounded-xl flex-1" data-testid="contact-discount-reason" />
                      <Button onClick={submitDiscount} disabled={submittingDisc} className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl" data-testid="contact-discount-submit">
                        {submittingDisc ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Отправить'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* DEFERRAL */}
          {tab === 'deferral' && credit && (
            <div className="space-y-4" data-testid="contact-deferral">
              {creditApproved ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-2xl p-4">
                      <p className="text-xs opacity-80">Доступно</p>
                      <p className="text-2xl font-bold">{fmt(credit.available)} ₽</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                      <p className="text-xs text-slate-500">Текущий долг</p>
                      <p className="text-2xl font-bold text-rose-600">{fmt(credit.debt)} ₽</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                      <p className="text-xs text-slate-500">Срок оплаты</p>
                      <p className="text-2xl font-bold text-slate-800">{credit.term_days} дн.</p>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/credit')} variant="outline" className="rounded-xl" data-testid="contact-goto-credit">Открыть страницу отсрочки</Button>
                </>
              ) : credit.pending_request ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <Hourglass className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <p className="font-semibold text-slate-800">Запрос на отсрочку на рассмотрении</p>
                  <p className="text-sm text-slate-500 mt-1">Запрошенный лимит: {fmt(credit.pending_request.requested_limit)} ₽</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-5 shadow-sm" data-testid="contact-credit-block">
                  <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2"><Clock className="w-4 h-4 text-violet-500" />Запросить отсрочку платежа</h2>
                  <p className="text-sm text-slate-500 mb-3">После одобрения вы сможете оформлять заказы с оплатой позже в пределах лимита.</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input type="number" min="0" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="Желаемый лимит, ₽" className="rounded-xl sm:w-48" data-testid="contact-credit-limit" />
                    <Input value={creditMsg} onChange={(e) => setCreditMsg(e.target.value)} placeholder="Комментарий (необязательно)" className="rounded-xl flex-1" data-testid="contact-credit-message" />
                    <Button onClick={submitCredit} disabled={submittingCredit} className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl" data-testid="contact-credit-submit">
                      {submittingCredit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Отправить'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY */}
          {tab === 'history' && (
            <div className="space-y-6" data-testid="contact-history">
              {/* Discount requests on products */}
              <div>
                <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Tag className="w-4 h-4 text-rose-400" />Запросы скидок на товары</h2>
                {discReqs.filter(r => r.product_id).length === 0 ? (
                  <div className="bg-white rounded-2xl p-5 text-center text-slate-400 shadow-sm text-sm">Нет запросов</div>
                ) : (
                  <div className="space-y-2">
                    {discReqs.filter(r => r.product_id).map(r => (
                      <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-3" data-testid={`history-disc-${r.id}`}>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{r.product_name} <span className="text-xs text-slate-400">{r.product_article}</span></p>
                          {r.message && <p className="text-xs text-slate-500 italic">«{r.message}»</p>}
                          {r.individual_price && <p className="text-xs text-emerald-600">Индивидуальная цена: {fmt(r.individual_price)} ₽</p>}
                          {r.admin_response && <p className="text-xs text-slate-500">Ответ: {r.admin_response}</p>}
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product requests */}
              <div>
                <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-teal-400" />Запросы товаров</h2>
                {prodReqs.length === 0 ? (
                  <div className="bg-white rounded-2xl p-5 text-center text-slate-400 shadow-sm text-sm">Нет запросов</div>
                ) : (
                  <div className="space-y-2">
                    {prodReqs.map(r => (
                      (r.status === 'offered' || r.offer_price != null) ? (
                        <div key={r.id} data-testid={`history-prod-${r.id}`} className="space-y-1">
                          <div className="flex items-center justify-end"><StatusBadge status={r.status} /></div>
                          <ProductRequestOffer req={r} onDone={fetchRequests} />
                        </div>
                      ) : (
                        <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-3" data-testid={`history-prod-${r.id}`}>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{r.product_name || r.article} <span className="text-xs text-slate-400">{r.article}</span></p>
                            <p className="text-xs text-slate-500">Кол-во: {r.quantity}{r.admin_response ? ` · Ответ: ${r.admin_response}` : ''}</p>
                          </div>
                          <StatusBadge status={r.status} />
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>

              {/* Individual prices */}
              <div>
                <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" />Действующие индивидуальные цены</h2>
                {indPrices.length === 0 ? (
                  <div className="bg-white rounded-2xl p-5 text-center text-slate-400 shadow-sm text-sm">Нет индивидуальных цен</div>
                ) : (
                  <div className="space-y-2">
                    {indPrices.map((p, i) => (
                      <div key={p.id || i} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-3" data-testid={`history-price-${p.id || i}`}>
                        <p className="text-sm font-medium text-slate-800">{p.product_name || p.product_article || 'Товар'}</p>
                        <p className="text-sm font-bold text-emerald-600">{fmt(p.individual_price ?? p.price)} ₽</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => setLightboxImage(null)} data-testid="contact-chat-lightbox">
          <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-full transition-colors">
            <X className="w-7 h-7" />
          </button>
          <img src={lightboxImage} alt="" className="max-w-[90vw] max-h-[85vh] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
