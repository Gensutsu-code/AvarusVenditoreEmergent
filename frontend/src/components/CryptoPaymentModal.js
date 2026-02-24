import { useState, useEffect, useCallback } from 'react';
import { Wallet, Check, Loader2, AlertCircle, ArrowRight, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { ethers } from 'ethers';

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

// Chain configurations
const CHAIN_CONFIG = {
  bsc: {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com/']
  },
  base: {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org/']
  },
  polygon: {
    chainId: '0x89',
    chainName: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com/']
  }
};

const TOKEN_ICONS = {
  usdt: '💵',
  usdc: '💲'
};

export default function CryptoPaymentModal({ 
  open, 
  onClose, 
  orderId, 
  amountRub, 
  onSuccess 
}) {
  const [step, setStep] = useState('select'); // select | connect | approve | pay | verifying | success | error
  const [chains, setChains] = useState([]);
  const [selectedChain, setSelectedChain] = useState('bsc');
  const [selectedToken, setSelectedToken] = useState('usdt');
  const [priceData, setPriceData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [txHash, setTxHash] = useState('');
  const [tokenBalance, setTokenBalance] = useState(null);

  // Fetch supported chains and price on mount
  useEffect(() => {
    if (open) {
      fetchChains();
      if (amountRub) {
        fetchPrice(amountRub);
      }
    }
  }, [open, amountRub]);

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

  // Check wallet on open
  useEffect(() => {
    if (open) {
      checkWalletConnection();
    }
  }, [open, checkWalletConnection]);

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('MetaMask не установлен. Установите MetaMask для оплаты криптовалютой.');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      toast.success('Кошелёк подключен!');
      setStep('approve');
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
      // Chain not added, try to add it
      if (err.code === 4902) {
        const chainKey = Object.keys(CHAIN_CONFIG).find(
          k => CHAIN_CONFIG[k].chainId === chainId
        );
        if (chainKey) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [CHAIN_CONFIG[chainKey]]
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
    setStep('pay');

    try {
      // Create payment if not exists
      let payment = paymentData;
      if (!payment) {
        payment = await createPayment();
        if (!payment) return;
      }

      // Switch to correct network
      const switched = await switchNetwork(payment.chain_id_hex);
      if (!switched) {
        setStep('approve');
        return;
      }

      // Get provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Check balance
      const balance = await checkTokenBalance(payment.token_address, payment.decimals);
      if (balance < payment.token_amount) {
        setError(`Недостаточно ${selectedToken.toUpperCase()}. Баланс: ${balance.toFixed(2)}, нужно: ${payment.token_amount.toFixed(2)}`);
        setStep('approve');
        return;
      }

      // Create token contract instance
      const tokenContract = new ethers.Contract(
        payment.token_address,
        ERC20_ABI,
        signer
      );

      // Convert amount to wei (token smallest unit)
      const amountWei = ethers.parseUnits(
        payment.token_amount.toFixed(payment.decimals),
        payment.decimals
      );

      toast.info('Подтвердите транзакцию в MetaMask...');

      // Execute transfer
      const tx = await tokenContract.transfer(
        payment.receiving_address,
        amountWei
      );

      setTxHash(tx.hash);
      toast.success('Транзакция отправлена! Ожидаем подтверждения...');
      setStep('verifying');

      // Wait for confirmation
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        // Verify payment on backend
        const verifyRes = await axios.post(`${API}/crypto/payment/verify`, {
          payment_id: payment.payment_id,
          tx_hash: tx.hash
        });

        if (verifyRes.data.verified) {
          setStep('success');
          toast.success('Оплата успешно подтверждена!');
          if (onSuccess) {
            onSuccess(tx.hash);
          }
        } else {
          setError(verifyRes.data.error || 'Не удалось верифицировать платёж');
          setStep('error');
        }
      } else {
        setError('Транзакция не прошла');
        setStep('error');
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
      setStep('approve');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано!');
  };

  const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(Math.round(price));

  const getChainInfo = (chainId) => chains.find(c => c.id === chainId) || {};

  const handleClose = () => {
    setStep('select');
    setError('');
    setTxHash('');
    setPaymentData(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-testid="crypto-payment-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-500" />
            Оплата криптовалютой
          </DialogTitle>
          <DialogDescription className="sr-only">
            Оплата заказа криптовалютой через MetaMask
          </DialogDescription>
        </DialogHeader>

        {/* Step: Select chain and token */}
        {step === 'select' && (
          <div className="space-y-4 mt-4">
            {/* Amount display */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-700">Сумма к оплате</p>
              <p className="text-2xl font-bold text-amber-900">{formatPrice(amountRub)} ₽</p>
              {priceData && (
                <p className="text-lg font-semibold text-amber-700 mt-1">
                  ≈ {priceData.token_amount.toFixed(2)} USD
                </p>
              )}
              {priceData && (
                <p className="text-xs text-amber-600 mt-1">
                  Курс: 1 USD = {priceData.rate.toFixed(2)} ₽ (+{priceData.markup_percent}%)
                </p>
              )}
            </div>

            {/* Chain selection */}
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">
                Выберите сеть
              </label>
              <div className="grid grid-cols-3 gap-2">
                {chains.filter(c => ['bsc', 'base', 'polygon'].includes(c.id)).map(chain => (
                  <button
                    key={chain.id}
                    onClick={() => setSelectedChain(chain.id)}
                    className={`p-3 border-2 rounded-lg text-center transition-all ${
                      selectedChain === chain.id
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                    data-testid={`chain-${chain.id}`}
                  >
                    <p className="font-semibold text-sm">{chain.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Token selection */}
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500 mb-2 block">
                Выберите токен
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['usdt', 'usdc'].map(token => (
                  <button
                    key={token}
                    onClick={() => setSelectedToken(token)}
                    className={`p-4 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                      selectedToken === token
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                    data-testid={`token-${token}`}
                  >
                    <span className="text-2xl">{TOKEN_ICONS[token]}</span>
                    <span className="font-bold">{token.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              onClick={() => {
                if (walletAddress) {
                  setStep('approve');
                } else {
                  setStep('connect');
                }
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white h-12"
              data-testid="proceed-to-payment-btn"
            >
              Продолжить
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step: Connect wallet */}
        {step === 'connect' && (
          <div className="space-y-4 mt-4">
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Подключите кошелёк</h3>
              <p className="text-zinc-500 text-sm">
                Для оплаты необходимо подключить MetaMask или другой Web3 кошелёк
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              onClick={connectWallet}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white h-12"
              data-testid="connect-wallet-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Wallet className="w-5 h-5 mr-2" />
                  Подключить MetaMask
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setStep('select')}
              className="w-full"
            >
              Назад
            </Button>
          </div>
        )}

        {/* Step: Approve and pay */}
        {step === 'approve' && (
          <div className="space-y-4 mt-4">
            {/* Connected wallet */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-700">Кошелёк подключен</p>
                <p className="text-sm font-mono truncate">{walletAddress}</p>
              </div>
            </div>

            {/* Payment details */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Сеть:</span>
                <span className="font-semibold">{getChainInfo(selectedChain).name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Токен:</span>
                <span className="font-semibold">{selectedToken.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Сумма:</span>
                <span className="font-bold text-lg">
                  {priceData?.token_amount.toFixed(2)} {selectedToken.toUpperCase()}
                </span>
              </div>
              {tokenBalance !== null && (
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-zinc-500">Ваш баланс:</span>
                  <span className={`font-semibold ${tokenBalance < (priceData?.token_amount || 0) ? 'text-red-500' : 'text-green-600'}`}>
                    {tokenBalance.toFixed(2)} {selectedToken.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              onClick={executePayment}
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white h-12"
              data-testid="execute-payment-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Wallet className="w-5 h-5 mr-2" />
                  Оплатить {priceData?.token_amount.toFixed(2)} {selectedToken.toUpperCase()}
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setStep('select')}
              className="w-full"
              disabled={loading}
            >
              Назад
            </Button>
          </div>
        )}

        {/* Step: Processing payment */}
        {step === 'pay' && (
          <div className="space-y-4 mt-4 text-center py-6">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
            <h3 className="text-lg font-semibold">Выполняется транзакция</h3>
            <p className="text-zinc-500 text-sm">
              Подтвердите транзакцию в MetaMask
            </p>
          </div>
        )}

        {/* Step: Verifying */}
        {step === 'verifying' && (
          <div className="space-y-4 mt-4 text-center py-6">
            <RefreshCw className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
            <h3 className="text-lg font-semibold">Подтверждение платежа</h3>
            <p className="text-zinc-500 text-sm">
              Ожидаем подтверждения транзакции в блокчейне...
            </p>
            {txHash && (
              <div className="bg-zinc-50 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-1">Hash транзакции:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-xs font-mono truncate max-w-[200px]">{txHash}</code>
                  <button onClick={() => copyToClipboard(txHash)} className="text-zinc-400 hover:text-zinc-600">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="space-y-4 mt-4 text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-700">Оплата успешна!</h3>
            <p className="text-zinc-500 text-sm">
              Ваш заказ оплачен и передан в обработку
            </p>
            
            {txHash && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-green-700 mb-1">Hash транзакции:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-xs font-mono truncate max-w-[180px]">{txHash}</code>
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
              className="w-full bg-green-500 hover:bg-green-600 text-white"
              data-testid="payment-success-close-btn"
            >
              Закрыть
            </Button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="space-y-4 mt-4 text-center py-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-red-700">Ошибка оплаты</h3>
            <p className="text-zinc-500 text-sm">{error}</p>

            <Button
              onClick={() => setStep('approve')}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            >
              Попробовать снова
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full"
            >
              Закрыть
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
