import { useState, useEffect } from 'react';
import { Wallet, Check, Loader2, AlertCircle, ArrowRight, Copy, ExternalLink, RefreshCw, QrCode, Fuel, ChevronLeft, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

const CHAINS = {
  bsc: {
    chainId: '0x38',
    name: 'BNB Smart Chain',
    short: 'BSC',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    explorer: 'https://bscscan.com/',
    logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg'
  },
  base: {
    chainId: '0x2105',
    name: 'Base',
    short: 'Base',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org'],
    explorer: 'https://basescan.org/',
    logo: 'https://avatars.githubusercontent.com/u/108554348'
  },
  polygon: {
    chainId: '0x89',
    name: 'Polygon',
    short: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    explorer: 'https://polygonscan.com/',
    logo: 'https://cryptologos.cc/logos/polygon-matic-logo.svg'
  }
};

const TOKENS = {
  usdt: { symbol: 'USDT', name: 'Tether USD', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
  usdc: { symbol: 'USDC', name: 'USD Coin', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg' }
};

const WALLETS = [
  { id: 'metamask', name: 'MetaMask', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg' },
  { id: 'trust', name: 'Trust Wallet', logo: 'https://trustwallet.com/assets/images/media/assets/TWT.svg' },
  { id: 'coinbase', name: 'Coinbase Wallet', logo: 'https://www.coinbase.com/img/favicon/favicon-256.png' }
];

export default function CryptoPaymentModal({ open, onClose, orderId, amountRub, onSuccess }) {
  const [step, setStep] = useState(1);
  const [chain, setChain] = useState('bsc');
  const [token, setToken] = useState('usdt');
  const [price, setPrice] = useState(null);
  const [gas, setGas] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState('');
  const [txHash, setTxHash] = useState('');
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (open && amountRub) {
      fetchPrice();
      checkWallet();
    }
  }, [open, amountRub]);

  useEffect(() => {
    if (chain) fetchGas();
  }, [chain]);

  const fetchPrice = async () => {
    try {
      const r = await axios.get(`${API}/crypto/price?amount_rub=${amountRub}`);
      setPrice(r.data);
    } catch (e) { console.error(e); }
  };

  const fetchGas = async () => {
    try {
      const r = await axios.get(`${API}/crypto/gas-estimate?chain=${chain}`);
      setGas(r.data);
    } catch (e) { console.error(e); }
  };

  const checkWallet = async () => {
    if (window.ethereum) {
      try {
        const accs = await window.ethereum.request({ method: 'eth_accounts' });
        if (accs.length) setWallet(accs[0]);
      } catch (e) { console.error(e); }
    }
  };

  const connect = async () => {
    if (!window.ethereum) {
      toast.error('Установите MetaMask');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWallet(accs[0]);
      toast.success('Кошелёк подключен');
      setStep(3);
    } catch (e) {
      setError(e.code === 4001 ? 'Подключение отклонено' : e.message);
    } finally {
      setLoading(false);
    }
  };

  const switchNet = async () => {
    const c = CHAINS[chain];
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: c.chainId }] });
      return true;
    } catch (e) {
      if (e.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: c.chainId, chainName: c.name, nativeCurrency: c.nativeCurrency, rpcUrls: c.rpcUrls, blockExplorerUrls: [c.explorer] }]
          });
          return true;
        } catch { setError('Не удалось добавить сеть'); return false; }
      }
      setError('Не удалось переключить сеть');
      return false;
    }
  };

  const pay = async () => {
    setLoading(true);
    setError('');
    setStep(4);

    try {
      let p = payment;
      if (!p) {
        const r = await axios.post(`${API}/crypto/payment/create`, { order_id: orderId, chain, token });
        p = r.data;
        setPayment(p);
      }

      if (!await switchNet()) { setStep(3); setLoading(false); return; }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(p.token_address, ERC20_ABI, signer);
      const amount = ethers.parseUnits(p.token_amount.toFixed(p.decimals), p.decimals);

      toast.info('Подтвердите в кошельке...');
      const tx = await contract.transfer(p.receiving_address, amount);
      setTxHash(tx.hash);
      toast.success('Транзакция отправлена');
      setStep(5);

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        try { await axios.post(`${API}/crypto/payment/verify`, { payment_id: p.payment_id, tx_hash: tx.hash }); } catch {}
        setStep(6);
        toast.success('Оплата успешна!');
        if (onSuccess) onSuccess(tx.hash);
      } else {
        setError('Транзакция отклонена');
        setStep(7);
      }
    } catch (e) {
      console.error(e);
      if (e.code === 'ACTION_REJECTED' || e.code === 4001) setError('Транзакция отклонена');
      else if (e.message?.includes('insufficient')) setError('Недостаточно средств');
      else setError(e.shortMessage || e.message || 'Ошибка оплаты');
      setStep(7);
    } finally {
      setLoading(false);
    }
  };

  const copy = (t) => { navigator.clipboard.writeText(t); toast.success('Скопировано'); };
  const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n));
  const short = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';

  const close = () => {
    setStep(1);
    setError('');
    setTxHash('');
    setPayment(null);
    setShowQR(false);
    onClose();
  };

  const ch = CHAINS[chain];
  const tk = TOKENS[token];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl" data-testid="crypto-payment-modal">
        {/* Header - Teal gradient matching site theme */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-5 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white text-lg font-bold">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              Оплата криптовалютой
            </DialogTitle>
            <DialogDescription className="text-teal-100 text-sm mt-1">
              Шаг {Math.min(step, 6)} из 6 — {['', 'Выбор сети', 'Подключение', 'Подтверждение', 'Отправка', 'Ожидание', 'Готово', 'Ошибка'][step]}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Select */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
                {/* Price Card */}
                {price && (
                  <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-5">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-teal-700">Сумма к оплате</span>
                      <span className="text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Zap className="w-3 h-3" /> CoinGecko
                      </span>
                    </div>
                    <div className="text-3xl font-bold text-teal-800">{fmt(amountRub)} ₽</div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-lg font-semibold text-teal-700">≈ {price.token_amount?.toFixed(2)} USD</span>
                      <span className="text-xs text-teal-600">1 USD = {price.rate?.toFixed(2)} ₽</span>
                    </div>
                  </div>
                )}

                {/* Chain */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">Выберите сеть</label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(CHAINS).map(([id, c]) => (
                      <motion.button
                        key={id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setChain(id)}
                        className={`p-4 border-2 rounded-xl transition-all ${chain === id ? 'border-teal-400 bg-teal-50 shadow-md shadow-teal-200' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                      >
                        <img src={c.logo} alt={c.short} className="w-8 h-8 mx-auto mb-2" onError={(e) => e.target.style.display = 'none'} />
                        <p className={`font-semibold text-sm ${chain === id ? 'text-teal-700' : 'text-slate-700'}`}>{c.short}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Token */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">Выберите токен</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(TOKENS).map(([id, t]) => (
                      <motion.button
                        key={id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setToken(id)}
                        className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${token === id ? 'border-teal-400 bg-teal-50 shadow-md shadow-teal-200' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                      >
                        <img src={t.logo} alt={t.symbol} className="w-8 h-8" onError={(e) => e.target.style.display = 'none'} />
                        <div className="text-left">
                          <p className={`font-bold ${token === id ? 'text-teal-700' : 'text-slate-700'}`}>{t.symbol}</p>
                          <p className="text-xs text-slate-500">{t.name}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Gas */}
                {gas && (
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Fuel className="w-4 h-4" />
                      <span className="text-sm font-medium">Комиссия сети</span>
                    </div>
                    <span className="font-semibold text-slate-800">
                      ~{gas.gas_cost_native} {gas.native_symbol}
                      <span className="text-slate-500 text-xs ml-1">(${gas.gas_cost_usd})</span>
                    </span>
                  </div>
                )}

                <Button onClick={() => wallet ? setStep(3) : setStep(2)} className="w-full h-12 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-teal-500/30">
                  Продолжить <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* Step 2: Connect */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-10 h-10 text-teal-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-1">Подключите кошелёк</h3>
                  <p className="text-sm text-slate-500">Выберите способ подключения</p>
                </div>

                <div className="space-y-3">
                  {WALLETS.map(w => (
                    <motion.button
                      key={w.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={connect}
                      disabled={loading}
                      className="w-full p-4 border-2 border-slate-200 rounded-xl flex items-center gap-4 hover:border-teal-300 hover:bg-teal-50 transition-all"
                    >
                      <img src={w.logo} alt={w.name} className="w-10 h-10 rounded-lg" onError={(e) => e.target.style.display = 'none'} />
                      <span className="font-semibold text-slate-800">{w.name}</span>
                      {loading && <Loader2 className="w-5 h-5 animate-spin ml-auto text-teal-500" />}
                    </motion.button>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Button variant="outline" onClick={() => setStep(1)} className="w-full h-11 rounded-xl border-slate-300">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Назад
                </Button>
              </motion.div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
                {/* Connected */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-emerald-700">Кошелёк подключен</p>
                    <p className="text-sm font-mono truncate text-emerald-800">{short(wallet)}</p>
                  </div>
                  <button onClick={() => copy(wallet)} className="p-2 hover:bg-emerald-100 rounded-lg transition-colors">
                    <Copy className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>

                {/* Details */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200">
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Сеть</span>
                    <div className="flex items-center gap-2">
                      <img src={ch?.logo} alt="" className="w-5 h-5" onError={(e) => e.target.style.display = 'none'} />
                      <span className="font-semibold text-slate-800">{ch?.name}</span>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Токен</span>
                    <div className="flex items-center gap-2">
                      <img src={tk?.logo} alt="" className="w-5 h-5" onError={(e) => e.target.style.display = 'none'} />
                      <span className="font-semibold text-slate-800">{tk?.symbol}</span>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between bg-teal-50/50">
                    <span className="text-sm text-slate-500">Сумма</span>
                    <span className="text-xl font-bold text-teal-700">{price?.token_amount?.toFixed(2)} {tk?.symbol}</span>
                  </div>
                  {gas && (
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-sm text-slate-500 flex items-center gap-1"><Fuel className="w-3 h-3" /> Комиссия</span>
                      <span className="text-sm text-slate-600">~{gas.gas_cost_native} {gas.native_symbol}</span>
                    </div>
                  )}
                </div>

                {/* QR */}
                <button onClick={() => setShowQR(!showQR)} className="w-full flex items-center justify-center gap-2 text-sm text-teal-600 hover:text-teal-700 py-2 font-medium">
                  <QrCode className="w-4 h-4" />
                  {showQR ? 'Скрыть QR-код' : 'QR-код для мобильного кошелька'}
                </button>

                <AnimatePresence>
                  {showQR && payment?.receiving_address && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center">
                        <QRCode value={`ethereum:${payment.receiving_address}`} size={150} level="M" />
                        <p className="text-xs text-slate-500 mt-3 text-center">Отсканируйте для оплаты с мобильного</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Button onClick={pay} disabled={loading} className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/30">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Wallet className="w-4 h-4 mr-2" /> Оплатить {price?.token_amount?.toFixed(2)} {tk?.symbol}</>}
                </Button>

                <Button variant="outline" onClick={() => setStep(1)} disabled={loading} className="w-full h-11 rounded-xl border-slate-300">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Назад
                </Button>
              </motion.div>
            )}

            {/* Step 4: Processing */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-16 h-16 mx-auto">
                  <Loader2 className="w-16 h-16 text-teal-500" />
                </motion.div>
                <h3 className="text-lg font-bold text-slate-800 mt-6">Отправка транзакции</h3>
                <p className="text-sm text-slate-500 mt-2">Подтвердите в кошельке</p>
              </motion.div>
            )}

            {/* Step 5: Waiting */}
            {step === 5 && (
              <motion.div key="s5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-10">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-16 h-16 mx-auto">
                  <RefreshCw className="w-16 h-16 text-teal-500" />
                </motion.div>
                <h3 className="text-lg font-bold text-slate-800 mt-6">Ожидание подтверждения</h3>
                <p className="text-sm text-slate-500 mt-2">Транзакция в блокчейне...</p>
                {txHash && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-6 inline-block">
                    <p className="text-xs text-slate-500 mb-2">Hash транзакции</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{short(txHash)}</code>
                      <button onClick={() => copy(txHash)} className="text-slate-400 hover:text-slate-600"><Copy className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 6: Success */}
            {step === 6 && (
              <motion.div key="s6" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-10 h-10 text-emerald-600" />
                </motion.div>
                <h3 className="text-2xl font-bold text-emerald-700 mt-6">Оплата успешна!</h3>
                <p className="text-slate-500 mt-2">Заказ оплачен и передан в обработку</p>

                {txHash && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-6">
                    <p className="text-xs text-emerald-700 mb-2">Hash транзакции</p>
                    <div className="flex items-center justify-center gap-3">
                      <code className="text-xs font-mono text-emerald-800">{short(txHash)}</code>
                      <button onClick={() => copy(txHash)} className="text-emerald-600 hover:text-emerald-700"><Copy className="w-4 h-4" /></button>
                      <a href={`${ch?.explorer}tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700"><ExternalLink className="w-4 h-4" /></a>
                    </div>
                  </div>
                )}

                <Button onClick={close} className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold mt-6">
                  Закрыть
                </Button>
              </motion.div>
            )}

            {/* Step 7: Error */}
            {step === 7 && (
              <motion.div key="s7" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-red-700 mt-6">Ошибка оплаты</h3>
                <p className="text-slate-600 mt-2 max-w-xs mx-auto">{error}</p>

                <div className="flex gap-3 mt-6">
                  <Button onClick={() => { setError(''); setStep(3); }} className="flex-1 h-11 bg-teal-500 hover:bg-teal-600 text-white rounded-xl">
                    Попробовать снова
                  </Button>
                  <Button variant="outline" onClick={close} className="flex-1 h-11 rounded-xl border-slate-300">
                    Закрыть
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
