import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Star, MapPin, Clock, Phone, CheckCircle2,
  Store, Smartphone, Wallet, CreditCard, Loader2, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, formatDateTime } from '@/utils/format';
import DetailImageGallery from '@/components/shared/DetailImageGallery';
import { payAtStoreWithRazorpay, topupWalletWithRazorpay } from '@/utils/razorpay';

const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI / QR', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'wallet', label: 'Wallet', icon: Wallet },
];

export default function StoreDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [payMethod, setPayMethod] = useState('upi');
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletPrompt, setWalletPrompt] = useState(null);
  const [claimed, setClaimed] = useState(false);

  const accent = '#0F4C3A';

  const loadWallet = () =>
    api.get('/wallet/balance').then(r => setWalletBalance(r.data.balance ?? 0)).catch(() => {});

  useEffect(() => {
    api.get(`/stores/${storeId}`)
      .then(r => setStore(r.data))
      .catch(() => { toast.error('Store not found'); navigate('/customer'); })
      .finally(() => setLoading(false));
    loadWallet();
  }, [storeId]);

  if (loading) return <PageLoader />;
  if (!store) return null;

  const supportPhone = store.support_phone || store.category_support_phone;
  const discountPct = store.discount_percent || 0;
  const amtNum = parseFloat(amount) || 0;
  const payable = (claimed && discountPct > 0) ? Math.round((amtNum - amtNum * discountPct / 100) * 100) / 100 : amtNum;
  const savings = amtNum - payable;

  const completeWalletPay = async (amt) => {
    const { data } = await api.post('/payments/pay-with-wallet', {
      store_id: storeId, amount: amt, notes: notes || `Pay at ${store.business_name}`,
    });
    setWalletBalance(data.balance ?? 0);
    setSuccess({
      transaction_id: data.transaction_id, amount: data.amount,
      paid_at: new Date().toISOString(), store_name: store.business_name,
      order_id: data.order_id,
    });
    toast.success('Paid from wallet!');
  };

  const handleWalletPay = async (amt) => {
    try {
      await completeWalletPay(amt);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail && detail.code === 'INSUFFICIENT_FUNDS') {
        setWalletPrompt({ balance: detail.balance, shortfall: detail.shortfall, amount: amt });
      } else {
        toast.error(formatApiError(e));
      }
    }
  };

  const handleAddAndPay = async () => {
    const { shortfall, amount: amt } = walletPrompt;
    setPaying(true);
    try {
      await topupWalletWithRazorpay({ amount: Math.ceil(shortfall) });
      await loadWallet();
      setWalletPrompt(null);
      await completeWalletPay(amt);
    } catch (e) {
      const msg = e?.message || formatApiError(e);
      if (msg.toLowerCase().includes('cancel')) toast.info('Top-up cancelled');
      else toast.error(msg);
    } finally { setPaying(false); }
  };

  const handlePay = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 1) { toast.error('Enter a valid amount'); return; }
    if (amt > 100000) { toast.error('Amount cannot exceed ₹1,00,000'); return; }
    setPaying(true);
    try {
      if (payMethod === 'wallet') {
        await handleWalletPay(amt);
      } else {
        const result = await payAtStoreWithRazorpay({
          storeId, amount: amt, notes: notes || `Pay at ${store.business_name}`,
        });
        setSuccess({
          transaction_id: result.transaction_id, amount: result.amount,
          paid_at: new Date().toISOString(), store_name: store.business_name,
          order_id: result.order?.order_id,
        });
        toast.success('Payment successful!');
      }
    } catch (e) {
      const msg = e?.message || formatApiError(e);
      if (msg && msg.toLowerCase().includes('cancel')) toast.info('Payment cancelled');
      else toast.error(msg);
    } finally {
      setPaying(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 pb-24 animate-fade-in">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-b from-[#0F4C3A] to-[#0d4032] p-8 text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-white" strokeWidth={1.5} />
              </div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-1">Payment Successful</p>
              <p className="text-4xl font-bold text-white">{formatCurrency(success.amount)}</p>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Paid to</span><span className="font-semibold text-slate-800">{success.store_name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Transaction ID</span><span className="font-mono text-xs text-slate-600">{success.transaction_id}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Date & Time</span><span className="text-slate-600">{formatDateTime(success.paid_at)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Mode</span><span className="text-slate-600 capitalize">{payMethod === 'upi' ? 'UPI / QR' : payMethod}</span></div>
            </div>
            <div className="px-5 pb-5 space-y-2">
              <Button onClick={() => { setSuccess(null); setAmount(''); setNotes(''); }}
                className="w-full h-11 rounded-2xl bg-[#0F4C3A] hover:bg-[#0a3829] text-white">Pay Again</Button>
              {success.order_id && (
                <button onClick={() => navigate(`/customer/orders/${success.order_id}`)}
                  data-testid="view-order-btn"
                  className="w-full text-sm font-semibold text-[#0F4C3A] hover:text-[#0a3829] py-2 transition-colors">View Order Details</button>
              )}
              <button onClick={() => navigate('/customer/orders')}
                className="w-full text-sm text-slate-500 hover:text-[#0F4C3A] py-2 transition-colors">View All Transactions</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 animate-fade-in bg-slate-50 min-h-screen">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            data-testid="store-back-btn"
            onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/customer')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-base font-extrabold text-slate-900 flex-1 truncate">{store.business_name}</h1>
          {store.verified && <CheckCircle2 className="w-4 h-4 text-green-500 fill-green-100" />}
        </div>
      </div>

      <DetailImageGallery
        images={store.images?.length ? store.images : (store.logo ? [store.logo] : [])}
        title={store.business_name}
        accent={accent}
        FallbackIcon={Store}
      />

      <div className="mx-4 -mt-6 bg-white rounded-2xl shadow-md border border-slate-100 p-4 mb-4 relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{store.business_name}</h2>
            <p className="text-xs font-semibold mt-0.5" style={{ color: accent }}>{store.business_type || store.category}</p>
            {discountPct > 0 && (
              <span data-testid="store-discount-badge" className="inline-flex items-center gap-1 mt-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                {discountPct}% OFF with NAMCOS
              </span>
            )}
          </div>
          {store.rating > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-100">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-sm font-bold text-slate-700">{store.rating}</span>
              {store.review_count > 0 && <span className="text-xs text-slate-400">({store.review_count})</span>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-1.5 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /><span className="truncate">{store.locality}, {store.city}</span></div>
          {store.opening_time && (
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /><span>{store.opening_time} – {store.closing_time}</span></div>
          )}
        </div>
        {store.description && (
          <p className="text-xs text-slate-500 mt-3 leading-relaxed border-t border-slate-50 pt-3">{store.description}</p>
        )}
      </div>

      {/* Pay at Store */}
      <div className="mx-4 bg-white rounded-2xl shadow-md border border-slate-100 p-5 mb-4">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl bg-[#0F4C3A]/10 flex items-center justify-center">
            <CreditCard className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Pay at Store</h2>
            <p className="text-xs text-slate-400">Enter the bill amount from the merchant</p>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Bill Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">₹</span>
            <input data-testid="pay-amount-input" type="number" inputMode="numeric" placeholder="0"
              value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full h-16 pl-10 pr-4 text-3xl font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-[#0F4C3A] focus:bg-white transition-all" />
          </div>
        </div>
        {/* Claim discount */}
        {discountPct > 0 && amtNum > 0 && (
          <div className={`mb-4 rounded-2xl border p-4 transition-all ${claimed ? 'border-amber-300 bg-amber-50' : 'border-dashed border-amber-300 bg-amber-50/40'}`}>
            {!claimed ? (
              <button data-testid="claim-discount-btn" onClick={() => setClaimed(true)}
                className="w-full flex items-center justify-between">
                <span className="text-sm font-bold text-amber-700">🎉 Claim {discountPct}% NAMCOS discount</span>
                <span className="text-xs font-semibold text-amber-600 bg-white px-2.5 py-1 rounded-full border border-amber-200">Save {formatCurrency(Math.round(amtNum * discountPct / 100))}</span>
              </button>
            ) : (
              <div data-testid="discount-applied">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Bill amount</span>
                  <span className="line-through text-slate-400">{formatCurrency(amtNum)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-amber-700 font-semibold">You save ({discountPct}%)</span>
                  <span className="text-amber-700 font-semibold">-{formatCurrency(savings)}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200">
                  <span className="text-sm font-bold text-slate-800">You pay</span>
                  <span className="text-lg font-extrabold text-[#0F4C3A]">{formatCurrency(payable)}</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => setPayMethod(value)} data-testid={`pay-method-${value}`}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  payMethod === value ? 'border-[#0F4C3A] bg-[#0F4C3A]/5 text-[#0F4C3A]' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
                {value === 'wallet' && (
                  <span className="text-[9px] text-slate-400">{formatCurrency(walletBalance)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Note <span className="text-slate-300">(optional)</span></label>
          <input type="text" placeholder="e.g. Groceries, Lunch..." value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full h-11 px-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F4C3A] focus:bg-white transition-all" />
        </div>
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">Ask the merchant for the exact bill amount before paying.</p>
        </div>
        <Button data-testid="pay-now-btn" onClick={handlePay} disabled={paying || !amount || parseFloat(amount) < 1}
          className="w-full h-13 rounded-2xl bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-bold text-base py-4 shadow-md disabled:opacity-50">
          {paying ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
            : amount && parseFloat(amount) > 0 ? `Pay ${formatCurrency(payable)}` : 'Enter Amount to Pay'}
        </Button>
      </div>

      {/* Call Store Support (inline, no overlay) */}
      <div className="mx-4 mb-4">
        <a href={supportPhone ? `tel:${supportPhone}` : undefined}
          data-testid="store-call-btn"
          onClick={e => { if (!supportPhone) { e.preventDefault(); toast.info('Support number will be shown here'); } }}
          className="flex items-center justify-center gap-2 w-full h-12 bg-white border border-slate-200 text-[#0F4C3A] font-bold text-sm rounded-2xl shadow-sm active:scale-[0.99] transition-all">
          <Phone className="w-4 h-4" /> Call Store Support
        </a>
      </div>
      {/* Wallet shortfall prompt */}
      {walletPrompt && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end" onClick={() => !paying && setWalletPrompt(null)}>
          <div className="bg-white w-full max-w-[480px] mx-auto rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
              <Wallet className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Not enough wallet balance</h3>
            <p className="text-sm text-slate-500 mt-1">
              Add the remaining amount to complete this payment from your wallet.
            </p>
            <div className="bg-slate-50 rounded-2xl p-4 mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Bill amount</span><span className="font-semibold text-slate-800">{formatCurrency(walletPrompt.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Wallet balance</span><span className="font-semibold text-slate-800">{formatCurrency(walletPrompt.balance)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-500">To add</span><span className="font-bold text-[#0F4C3A]">{formatCurrency(Math.ceil(walletPrompt.shortfall))}</span></div>
            </div>
            <Button data-testid="wallet-add-and-pay-btn" onClick={handleAddAndPay} disabled={paying}
              className="w-full h-12 mt-5 rounded-2xl bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-bold">
              {paying ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
                : `Add ${formatCurrency(Math.ceil(walletPrompt.shortfall))} & Pay`}
            </Button>
            <button onClick={() => setWalletPrompt(null)} disabled={paying}
              className="w-full text-sm text-slate-500 py-3 mt-1">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
