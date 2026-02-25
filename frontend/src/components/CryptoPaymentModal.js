import { useState, useEffect, useCallback } from 'react';
import { Wallet, Check, Loader2, AlertCircle, ArrowRight, Copy, ExternalLink, RefreshCw, QrCode, Fuel, TrendingUp, ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ERC20 ABI
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// Chain configurations
const CHAIN_CONFIG = {
  bsc: {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    shortName: 'BSC',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com/'],
    logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.svg',
    color: '#F3BA2F',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500'
  },
  base: {
    chainId: '0x2105',
    chainName: 'Base',
    shortName: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org/'],
    logo: 'https://avatars.githubusercontent.com/u/108554348',
    color: '#0052FF',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500'
  },
  polygon: {
    chainId: '0x89',
    chainName: 'Polygon',
    shortName: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com/'],
    logo: 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
    color: '#8247E5',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500'
  }
};

// Token configurations
const TOKEN_CONFIG = {
  usdt: {
    symbol: 'USDT',
    name: 'Tether USD',
    logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-500'
  },
  usdc: {
    symbol: 'USDC',
    name: 'USD Coin',
    logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500'
  }
};

// Wallet configurations
const WALLETS = [
  { id: 'metamask', name: 'MetaMask', logo: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg' },
  { id: 'trust', name: 'Trust Wallet', logo: 'https://trustwallet.com/assets/images/media/assets/TWT.svg' },
  { id: 'coinbase', name: 'Coinbase', logo: 'https://www.coinbase.com/img/favicon/favicon-256.png' }
];

// Animation variants
const pageVariants = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 }
};

export default function CryptoPaymentModal({ open, onClose, orderId, amountRub, onSuccess }) {
  const [step, setStep] = useState(1);
  const [selectedChain, setSelectedChain] = useState('bsc');
  const [selectedToken, setSelectedToken] = useState('usdt');
  const [priceData, setPriceData] = useState(null);
  const [gasData, setGasData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [txHash, setTxHash] = useState('');
  const [showQR, setShowQR] = useState(false);

  // Fetch price on open
  useEffect(() => {
    if (open && amountRub) {
      fetchPrice();
      checkWallet();
    }
  }, [open, amountRub]);

  // Fetch gas when chain changes
  useEffect(() => {
    if (selectedChain) {
      fetchGas();
    }
  }, [selectedChain]);

  const fetchPrice = async () => {
    try {
      const res = await axios.get(`${API}/crypto/price?amount_rub=${amountRub}`);
      setPriceData(res.data);
    } catch (err) {
      console.error('Price fetch error:', err);
    }
  };

  const fetchGas = async () => {
    try {
      const res = await axios.get(`${API}/crypto/gas-estimate?chain=${selectedChain}`);
      setGasData(res.data);
    } catch (err) {
      console.error('Gas fetch error:', err);
    }
  };

  const checkWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) setWalletAddress(accounts[0]);
      } catch (err) {
        console.error('Wallet check error:', err);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('Установите MetaMask или Trust Wallet');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      toast.success('Кошелёк подключен!');
      setStep(3);
    } catch (err) {
      setError(err.code === 4001 ? 'Подключение отклонено' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchNetwork = async () => {
    const config = CHAIN_CONFIG[selectedChain];
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainId }]
      });
      return true;
    } catch (err) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: config.chainId,
              chainName: config.chainName,
              nativeCurrency: config.nativeCurrency,
              rpcUrls: config.rpcUrls,
              blockExplorerUrls: config.blockExplorerUrls
            }]
          });
          return true;
        } catch (addErr) {
          setError('Не удалось добавить сеть');
          return false;
        }
      }
      setError('Не удалось переключить сеть');
      return false;
    }
  };

  const createPayment = async () => {
    try {
      const res = await axios.post(`${API}/crypto/payment/create`, {
        order_id: orderId,
        chain: selectedChain,
        token: selectedToken
      });
      setPaymentData(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка создания платежа');
      return null;
    }
  };

  const executePayment = async () => {
    setLoading(true);
    setError('');
    setStep(4);

    try {
      let payment = paymentData || await createPayment();
      if (!payment) {
        setStep(3);
        return;
      }

      const switched = await switchNetwork();
      if (!switched) {
        setStep(3);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const tokenContract = new ethers.Contract(payment.token_address, ERC20_ABI, signer);
      
      const amountWei = ethers.parseUnits(
        payment.token_amount.toFixed(payment.decimals),
        payment.decimals
      );

      toast.info('Подтвердите транзакцию в кошельке...');

      // Send transaction without specifying nonce (let provider handle it)
      const tx = await tokenContract.transfer(payment.receiving_address, amountWei);

      setTxHash(tx.hash);
      toast.success('Транзакция отправлена!');
      setStep(5);

      // Wait for confirmation
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        // Verify payment on backend
        try {
          await axios.post(`${API}/crypto/payment/verify`, {
            payment_id: payment.payment_id,
            tx_hash: tx.hash
          });
        } catch (verifyErr) {
          console.error('Verify error:', verifyErr);
        }

        setStep(6);
        toast.success('Оплата успешна!');
        if (onSuccess) onSuccess(tx.hash);
      } else {
        setError('Транзакция отклонена');
        setStep(7);
      }

    } catch (err) {
      console.error('Payment error:', err);
      
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
        setError('Транзакция отклонена');
      } else if (err.message?.includes('insufficient')) {
        setError('Недостаточно средств');
      } else {
        setError(err.shortMessage || err.message || 'Ошибка оплаты');
      }
      setStep(7);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано!');
  };

  const formatPrice = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n));
  const shortAddr = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';

  const handleClose = () => {
    setStep(1);
    setError('');
    setTxHash('');
    setPaymentData(null);
    setShowQR(false);
    onClose();
  };

  const chainCfg = CHAIN_CONFIG[selectedChain];
  const tokenCfg = TOKEN_CONFIG[selectedToken];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto" data-testid="crypto-payment-modal">
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 text-white sticky top-0 z-10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white text-lg">
              <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              Оплата криптовалютой
            </DialogTitle>
            <DialogDescription className="text-amber-100 text-sm">
              Шаг {Math.min(step, 6)} из 6 • {step === 1 ? 'Выбор сети' : step === 2 ? 'Подключение' : step === 3 ? 'Подтверждение' : step === 4 ? 'Отправка' : step === 5 ? 'Ожидание' : step === 6 ? 'Успех' : 'Ошибка'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {/* Step 1: Select Chain & Token */}
            {step === 1 && (
              <motion.div key="step1" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* Price */}
                {priceData && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-amber-700">Сумма к оплате</span>
                      <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        CoinGecko
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-amber-900">{formatPrice(amountRub)} ₽</div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-base font-semibold text-amber-700">≈ {priceData.token_amount?.toFixed(2)} USD</span>
                      <span className="text-xs text-amber-600">1 USD = {priceData.rate?.toFixed(2)} ₽</span>
                    </div>
                  </div>
                )}

                {/* Chain Selection */}
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 mb-2 block tracking-wide">Сеть</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(CHAIN_CONFIG).map(([id, cfg]) => (
                      <motion.button
                        key={id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedChain(id)}
                        className={`p-3 border-2 rounded-xl transition-all ${selectedChain === id ? `${cfg.borderColor} ${cfg.bgColor} shadow-md` : 'border-slate-200 hover:border-slate-300'}`}
                        data-testid={`chain-${id}`}
                      >
                        <img src={cfg.logo} alt={cfg.shortName} className="w-7 h-7 mx-auto mb-1.5" onError={(e) => e.target.style.display = 'none'} />
                        <p className="font-semibold text-xs text-slate-800">{cfg.shortName}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Token Selection */}
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 mb-2 block tracking-wide">Токен</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TOKEN_CONFIG).map(([id, cfg]) => (
                      <motion.button
                        key={id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedToken(id)}
                        className={`p-3 border-2 rounded-xl flex items-center gap-2 transition-all ${selectedToken === id ? `${cfg.borderColor} ${cfg.bgColor} shadow-md` : 'border-slate-200 hover:border-slate-300'}`}
                        data-testid={`token-${id}`}
                      >
                        <img src={cfg.logo} alt={cfg.symbol} className="w-7 h-7" onError={(e) => e.target.style.display = 'none'} />
                        <div className="text-left">
                          <p className="font-bold text-sm text-slate-800">{cfg.symbol}</p>
                          <p className="text-xs text-slate-500">{cfg.name}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Gas */}
                {gasData && (
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Fuel className="w-4 h-4" />
                      <span className="text-sm">Комиссия сети</span>
                    </div>
                    <span className="font-semibold text-sm text-slate-800">
                      ~{gasData.gas_cost_native} {gasData.native_symbol}
                      <span className="text-slate-500 text-xs ml-1">(${gasData.gas_cost_usd})</span>
                    </span>
                  </div>
                )}

                <Button onClick={() => walletAddress ? setStep(3) : setStep(2)} className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold" data-testid="proceed-btn">
                  Продолжить <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* Step 2: Connect Wallet */}
            {step === 2 && (
              <motion.div key="step2" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Wallet className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Подключите кошелёк</h3>
                  <p className="text-sm text-slate-500">Выберите способ подключения</p>
                </div>

                <div className="space-y-2">
                  {WALLETS.map((w) => (
                    <motion.button
                      key={w.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={connectWallet}
                      disabled={loading}
                      className="w-full p-3 border-2 border-slate-200 rounded-xl flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50 transition-all"
                    >
                      <img src={w.logo} alt={w.name} className="w-8 h-8 rounded-lg" onError={(e) => e.target.style.display = 'none'} />
                      <span className="font-semibold text-slate-800">{w.name}</span>
                      {loading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                    </motion.button>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Button variant="outline" onClick={() => setStep(1)} className="w-full h-10 rounded-xl">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Назад
                </Button>
              </motion.div>
            )}

            {/* Step 3: Confirm Payment */}
            {step === 3 && (
              <motion.div key="step3" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* Connected */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-700 font-medium">Кошелёк подключен</p>
                    <p className="text-sm font-mono truncate text-green-800">{shortAddr(walletAddress)}</p>
                  </div>
                  <button onClick={() => copyText(walletAddress)} className="p-1.5 hover:bg-green-100 rounded-lg">
                    <Copy className="w-4 h-4 text-green-600" />
                  </button>
                </div>

                {/* Payment Details */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Сеть</span>
                    <div className="flex items-center gap-2">
                      <img src={chainCfg?.logo} alt="" className="w-5 h-5" onError={(e) => e.target.style.display = 'none'} />
                      <span className="font-semibold text-sm text-slate-800">{chainCfg?.chainName}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Токен</span>
                    <div className="flex items-center gap-2">
                      <img src={tokenCfg?.logo} alt="" className="w-5 h-5" onError={(e) => e.target.style.display = 'none'} />
                      <span className="font-semibold text-sm text-slate-800">{tokenCfg?.symbol}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Сумма</span>
                    <span className="text-lg font-bold text-slate-800">{priceData?.token_amount?.toFixed(2)} {tokenCfg?.symbol}</span>
                  </div>
                  {gasData && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1"><Fuel className="w-3 h-3" /> Комиссия</span>
                      <span className="text-slate-600">~{gasData.gas_cost_native} {gasData.native_symbol}</span>
                    </div>
                  )}
                </div>

                {/* QR Toggle */}
                <button onClick={() => setShowQR(!showQR)} className="w-full flex items-center justify-center gap-2 text-sm text-amber-600 hover:text-amber-700 py-2">
                  <QrCode className="w-4 h-4" />
                  {showQR ? 'Скрыть QR-код' : 'QR-код для мобильного'}
                </button>

                {showQR && paymentData?.receiving_address && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center">
                    <QRCode value={`ethereum:${paymentData.receiving_address}`} size={140} level="M" />
                    <p className="text-xs text-slate-500 mt-2 text-center">Отсканируйте для оплаты</p>
                  </motion.div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Button onClick={executePayment} disabled={loading} className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold" data-testid="pay-btn">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Wallet className="w-4 h-4 mr-2" /> Оплатить {priceData?.token_amount?.toFixed(2)} {tokenCfg?.symbol}</>}
                </Button>

                <Button variant="outline" onClick={() => setStep(1)} disabled={loading} className="w-full h-10 rounded-xl">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Назад
                </Button>
              </motion.div>
            )}

            {/* Step 4: Processing */}
            {step === 4 && (
              <motion.div key="step4" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="text-center py-8">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                  <Loader2 className="w-14 h-14 text-amber-500 mx-auto" />
                </motion.div>
                <h3 className="text-lg font-bold text-slate-800 mt-4">Выполняется транзакция</h3>
                <p className="text-sm text-slate-500 mt-1">Подтвердите в кошельке</p>
              </motion.div>
            )}

            {/* Step 5: Waiting Confirmation */}
            {step === 5 && (
              <motion.div key="step5" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="text-center py-6">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                  <RefreshCw className="w-14 h-14 text-amber-500 mx-auto" />
                </motion.div>
                <h3 className="text-lg font-bold text-slate-800 mt-4">Ожидание подтверждения</h3>
                <p className="text-sm text-slate-500 mt-1">Транзакция в блокчейне...</p>
                {txHash && (
                  <div className="bg-slate-50 rounded-xl p-3 mt-4 inline-block">
                    <p className="text-xs text-slate-500 mb-1">Hash транзакции</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{shortAddr(txHash)}</code>
                      <button onClick={() => copyText(txHash)} className="text-slate-400 hover:text-slate-600">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 6: Success */}
            {step === 6 && (
              <motion.div key="step6" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="text-center py-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </motion.div>
                <h3 className="text-xl font-bold text-green-700 mt-4">Оплата успешна!</h3>
                <p className="text-sm text-slate-500 mt-1">Заказ оплачен и передан в обработку</p>
                
                {txHash && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-4">
                    <p className="text-xs text-green-700 mb-1">Hash транзакции</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-xs font-mono">{shortAddr(txHash)}</code>
                      <button onClick={() => copyText(txHash)} className="text-green-600"><Copy className="w-4 h-4" /></button>
                      <a href={`${chainCfg?.blockExplorerUrls?.[0]}tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-green-600"><ExternalLink className="w-4 h-4" /></a>
                    </div>
                  </div>
                )}

                <Button onClick={handleClose} className="w-full h-11 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold mt-4" data-testid="success-close-btn">
                  Закрыть
                </Button>
              </motion.div>
            )}

            {/* Step 7: Error */}
            {step === 7 && (
              <motion.div key="step7" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="text-center py-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-red-700 mt-4">Ошибка оплаты</h3>
                <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">{error}</p>

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => { setError(''); setStep(3); }} className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
                    Попробовать снова
                  </Button>
                  <Button variant="outline" onClick={handleClose} className="flex-1 h-10 rounded-xl">
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
