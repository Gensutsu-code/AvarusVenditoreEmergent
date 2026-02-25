import { useState, useEffect, useCallback } from 'react';
import { Wallet, Check, Loader2, AlertCircle, ArrowRight, Copy, ExternalLink, RefreshCw, QrCode, Fuel, TrendingUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ERC20 ABI for token transfers
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Chain configurations with logos
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
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-400'
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
    borderColor: 'border-blue-400'
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
    borderColor: 'border-purple-400'
  }
};

// Token configurations with logos
const TOKEN_CONFIG = {
  usdt: {
    name: 'Tether USD',
    symbol: 'USDT',
    logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg',
    color: '#26A17B',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-400'
  },
  usdc: {
    name: 'USD Coin',
    symbol: 'USDC',
    logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
    color: '#2775CA',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-400'
  }
};

// Wallet configurations
const WALLETS = [
  {
    id: 'metamask',
    name: 'MetaMask',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
    color: '#E2761B',
    check: () => typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    logo: 'https://trustwallet.com/assets/images/media/assets/TWT.svg',
    color: '#3375BB',
    check: () => typeof window.ethereum !== 'undefined' && window.ethereum.isTrust
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    logo: 'https://www.coinbase.com/img/favicon/favicon-256.png',
    color: '#0052FF',
    check: () => typeof window.ethereum !== 'undefined' && window.ethereum.isCoinbaseWallet
  }
];

// Animation variants
const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction < 0 ? 300 : -300, opacity: 0 })
};

export default function CryptoPaymentModal({ 
  open, 
  onClose, 
  orderId, 
  amountRub, 
  onSuccess 
}) {
  const [step, setStep] = useState('select');
  const [direction, setDirection] = useState(0);
  const [chains, setChains] = useState([]);
  const [selectedChain, setSelectedChain] = useState('bsc');
  const [selectedToken, setSelectedToken] = useState('usdt');
  const [priceData, setPriceData] = useState(null);
  const [gasData, setGasData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [txHash, setTxHash] = useState('');
  const [tokenBalance, setTokenBalance] = useState(null);
  const [showQR, setShowQR] = useState(false);

  const goToStep = (newStep) => {
    const steps = ['select', 'connect', 'approve', 'pay', 'verifying', 'success', 'error'];
    const currentIndex = steps.indexOf(step);
    const newIndex = steps.indexOf(newStep);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setStep(newStep);
  };

  useEffect(() => {
    if (open) {
      fetchChains();
      if (amountRub) {
        fetchPrice(amountRub);
      }
    }
  }, [open, amountRub]);

  useEffect(() => {
    if (selectedChain) {
      fetchGasEstimate(selectedChain);
    }
  }, [selectedChain]);

  const fetchChains = async () => {
    try {
      const res = await axios.get(`${API}/crypto/chains`);
      setChains(res.data.chains || []);
    } catch (err) {
      console.error('Failed to fetch chains:', err);
    }
  };

  const fetchPrice = async (amount) => {
    try {
      const res = await axios.get(`${API}/crypto/price?amount_rub=${amount}`);
      setPriceData(res.data);
    } catch (err) {
      console.error('Failed to fetch price:', err);
    }
  };

  const fetchGasEstimate = async (chain) => {
    try {
      const res = await axios.get(`${API}/crypto/gas-estimate?chain=${chain}`);
      setGasData(res.data);
    } catch (err) {
      console.error('Failed to fetch gas estimate:', err);
    }
  };

  const checkWalletConnection = useCallback(async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          return accounts[0];
        }
      } catch (err) {
        console.error('Check wallet error:', err);
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (open) {
      checkWalletConnection();
    }
  }, [open, checkWalletConnection]);

  const connectWallet = async (walletId) => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('Крипто-кошелёк не найден. Установите MetaMask или Trust Wallet.');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      toast.success('Кошелёк подключен!');
      goToStep('approve');
    } catch (err) {
      if (err.code === 4001) {
        setError('Вы отклонили подключение кошелька');
      } else {
        setError(err.message || 'Ошибка подключения кошелька');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchNetwork = async (chainId) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      });
      return true;
    } catch (err) {
      if (err.code === 4902) {
        const config = CHAIN_CONFIG[selectedChain];
        if (config) {
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
            setError('Не удалось добавить сеть: ' + addErr.message);
            return false;
          }
        }
      }
      setError('Не удалось переключить сеть: ' + err.message);
      return false;
    }
  };

  const createPayment = async () => {
    setLoading(true);
    setError('');

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
    } finally {
      setLoading(false);
    }
  };

  const checkTokenBalance = async (tokenAddress, decimals) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(address);
      const balanceFormatted = Number(ethers.formatUnits(balance, decimals));
      setTokenBalance(balanceFormatted);
      return balanceFormatted;
    } catch (err) {
      console.error('Check balance error:', err);
      return 0;
    }
  };

  const executePayment = async () => {
    setLoading(true);
    setError('');
    goToStep('pay');

    try {
      let payment = paymentData;
      if (!payment) {
        payment = await createPayment();
        if (!payment) return;
      }

      const switched = await switchNetwork(payment.chain_id_hex);
      if (!switched) {
        goToStep('approve');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const balance = await checkTokenBalance(payment.token_address, payment.decimals);
      if (balance < payment.token_amount) {
        setError(`Недостаточно ${selectedToken.toUpperCase()}. Баланс: ${balance.toFixed(2)}, нужно: ${payment.token_amount.toFixed(2)}`);
        goToStep('approve');
        return;
      }

      const tokenContract = new ethers.Contract(
        payment.token_address,
        ERC20_ABI,
        signer
      );

      const amountWei = ethers.parseUnits(
        payment.token_amount.toFixed(payment.decimals),
        payment.decimals
      );

      toast.info('Подтвердите транзакцию в кошельке...');

      const tx = await tokenContract.transfer(
        payment.receiving_address,
        amountWei
      );

      setTxHash(tx.hash);
      toast.success('Транзакция отправлена! Ожидаем подтверждения...');
      goToStep('verifying');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        const verifyRes = await axios.post(`${API}/crypto/payment/verify`, {
          payment_id: payment.payment_id,
          tx_hash: tx.hash
        });

        if (verifyRes.data.verified) {
          goToStep('success');
          toast.success('Оплата успешно подтверждена!');
          if (onSuccess) {
            onSuccess(tx.hash);
          }
        } else {
          setError(verifyRes.data.error || 'Не удалось верифицировать платёж');
          goToStep('error');
        }
      } else {
        setError('Транзакция не прошла');
        goToStep('error');
      }

    } catch (err) {
      console.error('Payment error:', err);
      
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
        setError('Вы отклонили транзакцию');
      } else if (err.message?.includes('insufficient funds')) {
        setError('Недостаточно средств для оплаты комиссии сети');
      } else {
        setError(err.message || 'Ошибка выполнения платежа');
      }
      goToStep('approve');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано!');
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));
  const shortenAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const handleClose = () => {
    setStep('select');
    setError('');
    setTxHash('');
    setPaymentData(null);
    setShowQR(false);
    onClose();
  };

  const chainConfig = CHAIN_CONFIG[selectedChain] || {};
  const tokenConfig = TOKEN_CONFIG[selectedToken] || {};

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden" data-testid="crypto-payment-modal">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white text-xl">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              Оплата криптовалютой
            </DialogTitle>
            <DialogDescription className="text-amber-100 mt-2">
              Быстро и безопасно через блокчейн
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait" custom={direction}>
            {/* Step: Select chain and token */}
            {step === 'select' && (
              <motion.div
                key="select"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {/* Price info */}
                {priceData && (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-amber-700 font-medium">Сумма к оплате</span>
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <TrendingUp className="w-3 h-3" />
                        <span>CoinGecko</span>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-amber-900 mb-1">
                      {formatPrice(amountRub)} ₽
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-amber-700">
                        ≈ {priceData.token_amount.toFixed(2)} USD
                      </span>
                      <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                        1 USD = {priceData.rate.toFixed(2)} ₽
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Chain selection */}
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 mb-3 block tracking-wider">
                    Выберите сеть
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(CHAIN_CONFIG).map(([id, config]) => (
                      <motion.button
                        key={id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedChain(id)}
                        className={`p-4 border-2 rounded-xl text-center transition-all ${
                          selectedChain === id
                            ? `${config.borderColor} ${config.bgColor} shadow-lg`
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        data-testid={`chain-${id}`}
                      >
                        <img 
                          src={config.logo} 
                          alt={config.chainName}
                          className="w-8 h-8 mx-auto mb-2"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                        <p className="font-semibold text-sm text-slate-800">{config.shortName}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Token selection */}
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500 mb-3 block tracking-wider">
                    Выберите токен
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(TOKEN_CONFIG).map(([id, config]) => (
                      <motion.button
                        key={id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedToken(id)}
                        className={`p-4 border-2 rounded-xl flex items-center justify-center gap-3 transition-all ${
                          selectedToken === id
                            ? `${config.borderColor} ${config.bgColor} shadow-lg`
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        data-testid={`token-${id}`}
                      >
                        <img 
                          src={config.logo} 
                          alt={config.symbol}
                          className="w-8 h-8"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                        <div className="text-left">
                          <p className="font-bold text-slate-800">{config.symbol}</p>
                          <p className="text-xs text-slate-500">{config.name}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Gas estimate */}
                {gasData && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-200"
                  >
                    <div className="flex items-center gap-2 text-slate-600">
                      <Fuel className="w-4 h-4" />
                      <span className="text-sm">Комиссия сети</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-slate-800">
                        ~{gasData.gas_cost_native} {gasData.native_symbol}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        (${gasData.gas_cost_usd})
                      </span>
                    </div>
                  </motion.div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (walletAddress) {
                      goToStep('approve');
                    } else {
                      goToStep('connect');
                    }
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white h-14 rounded-xl text-base font-semibold shadow-lg shadow-amber-500/30"
                  data-testid="proceed-to-payment-btn"
                >
                  Продолжить
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* Step: Connect wallet */}
            {step === 'connect' && (
              <motion.div
                key="connect"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div className="text-center py-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-10 h-10 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Подключите кошелёк</h3>
                  <p className="text-slate-500 text-sm">
                    Выберите способ подключения
                  </p>
                </div>

                <div className="space-y-3">
                  {WALLETS.map((wallet) => (
                    <motion.button
                      key={wallet.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => connectWallet(wallet.id)}
                      disabled={loading}
                      className="w-full p-4 border-2 border-slate-200 rounded-xl flex items-center gap-4 hover:border-amber-300 hover:bg-amber-50 transition-all"
                    >
                      <img 
                        src={wallet.logo} 
                        alt={wallet.name}
                        className="w-10 h-10 rounded-lg"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                      <span className="font-semibold text-slate-800">{wallet.name}</span>
                      {wallet.check() && (
                        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Установлен
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={() => goToStep('select')}
                  className="w-full h-12 rounded-xl"
                >
                  Назад
                </Button>
              </motion.div>
            )}

            {/* Step: Approve and pay */}
            {step === 'approve' && (
              <motion.div
                key="approve"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Connected wallet */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-700 font-medium">Кошелёк подключен</p>
                    <p className="text-sm font-mono truncate text-green-800">{shortenAddress(walletAddress)}</p>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(walletAddress)}
                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4 text-green-600" />
                  </button>
                </div>

                {/* Payment details */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Сеть</span>
                    <div className="flex items-center gap-2">
                      <img src={chainConfig.logo} alt="" className="w-5 h-5" onError={(e) => e.target.style.display = 'none'} />
                      <span className="font-semibold text-slate-800">{chainConfig.chainName}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Токен</span>
                    <div className="flex items-center gap-2">
                      <img src={tokenConfig.logo} alt="" className="w-5 h-5" onError={(e) => e.target.style.display = 'none'} />
                      <span className="font-semibold text-slate-800">{tokenConfig.symbol}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Сумма</span>
                    <span className="text-xl font-bold text-slate-800">
                      {priceData?.token_amount.toFixed(2)} {tokenConfig.symbol}
                    </span>
                  </div>
                  {tokenBalance !== null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Ваш баланс</span>
                      <span className={`font-semibold ${tokenBalance < (priceData?.token_amount || 0) ? 'text-red-500' : 'text-green-600'}`}>
                        {tokenBalance.toFixed(2)} {tokenConfig.symbol}
                      </span>
                    </div>
                  )}
                  {gasData && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Fuel className="w-3 h-3" /> Комиссия
                      </span>
                      <span className="text-slate-600">
                        ~{gasData.gas_cost_native} {gasData.native_symbol}
                      </span>
                    </div>
                  )}
                </div>

                {/* QR Code toggle */}
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-amber-600 hover:text-amber-700 py-2"
                >
                  <QrCode className="w-4 h-4" />
                  {showQR ? 'Скрыть QR-код' : 'Показать QR-код для мобильного кошелька'}
                </button>

                {/* QR Code */}
                <AnimatePresence>
                  {showQR && paymentData?.receiving_address && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center">
                        <QRCode 
                          value={`ethereum:${paymentData.receiving_address}@${CHAIN_CONFIG[selectedChain]?.chainId?.replace('0x', '')}?value=${paymentData.token_amount_wei}`}
                          size={160}
                          level="M"
                        />
                        <p className="text-xs text-slate-500 mt-3 text-center">
                          Отсканируйте для оплаты с мобильного кошелька
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Button
                  onClick={executePayment}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white h-14 rounded-xl text-base font-semibold shadow-lg shadow-green-500/30"
                  data-testid="execute-payment-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Wallet className="w-5 h-5 mr-2" />
                      Оплатить {priceData?.token_amount.toFixed(2)} {tokenConfig.symbol}
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => goToStep('select')}
                  className="w-full h-12 rounded-xl"
                  disabled={loading}
                >
                  Назад
                </Button>
              </motion.div>
            )}

            {/* Step: Processing payment */}
            {step === 'pay' && (
              <motion.div
                key="pay"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-4 text-center py-8"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-16 h-16 text-amber-500 mx-auto" />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-800">Выполняется транзакция</h3>
                <p className="text-slate-500">
                  Подтвердите транзакцию в вашем кошельке
                </p>
              </motion.div>
            )}

            {/* Step: Verifying */}
            {step === 'verifying' && (
              <motion.div
                key="verifying"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-4 text-center py-8"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-16 h-16 text-amber-500 mx-auto" />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-800">Подтверждение платежа</h3>
                <p className="text-slate-500">
                  Ожидаем подтверждения в блокчейне...
                </p>
                {txHash && (
                  <div className="bg-slate-50 rounded-xl p-4 mt-4">
                    <p className="text-xs text-slate-500 mb-2">Hash транзакции</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{shortenAddress(txHash)}</code>
                      <button onClick={() => copyToClipboard(txHash)} className="text-slate-400 hover:text-slate-600">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step: Success */}
            {step === 'success' && (
              <motion.div
                key="success"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-4 text-center py-6"
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto"
                >
                  <Check className="w-10 h-10 text-green-600" />
                </motion.div>
                <h3 className="text-2xl font-bold text-green-700">Оплата успешна!</h3>
                <p className="text-slate-500">
                  Ваш заказ оплачен и передан в обработку
                </p>
                
                {txHash && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs text-green-700 mb-2">Hash транзакции</p>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-xs font-mono">{shortenAddress(txHash)}</code>
                      <button onClick={() => copyToClipboard(txHash)} className="text-green-600 hover:text-green-700">
                        <Copy className="w-4 h-4" />
                      </button>
                      <a 
                        href={`${CHAIN_CONFIG[selectedChain]?.blockExplorerUrls[0]}tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleClose}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white h-12 rounded-xl font-semibold"
                  data-testid="payment-success-close-btn"
                >
                  Закрыть
                </Button>
              </motion.div>
            )}

            {/* Step: Error */}
            {step === 'error' && (
              <motion.div
                key="error"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-4 text-center py-6"
              >
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-red-700">Ошибка оплаты</h3>
                <p className="text-slate-500">{error}</p>

                <Button
                  onClick={() => goToStep('approve')}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white h-12 rounded-xl font-semibold"
                >
                  Попробовать снова
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="w-full h-12 rounded-xl"
                >
                  Закрыть
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
