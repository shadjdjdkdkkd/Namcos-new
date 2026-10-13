import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, Plus, X, Loader2 } from 'lucide-react';
import api from '@/utils/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/utils/format';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { topupWalletWithRazorpay } from '@/utils/razorpay';
import PayoutFields, { useSavedPayout, validatePayout, payoutPayload } from '@/components/shared/PayoutFields';

const ADD_AMOUNTS = [100, 200, 500, 1000, 2000];

export default function CustomerWallet() {
  const [payments, setPayments] = useState([]);
  const [topups, setTopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wd, setWd] = useState({ amount: '' });
  const { payout, setPayout, method, setMethod } = useSavedPayout();
  const [withdrawals, setWithdrawals] = useState([]);

  const refresh = () =>
    Promise.allSettled([
      api.get('/wallet/balance'),
      api.get('/payments/my'),
      api.get('/wallet/transactions'),
    ]).then(([balRes, payRes, txRes]) => {
      if (balRes.status === 'fulfilled') setBalance(balRes.value.data.balance ?? 0);
      if (payRes.status === 'fulfilled') {
        const data = payRes.value.data;
        setPayments(data);
        const captured = data.filter(p => p.status === 'captured');
        setTotalSpent(captured.reduce((s, p) => s + (p.net_paid || 0), 0));
        setTotalSaved(captured.reduce((s, p) => s + (p.discount_amount || 0), 0));
      }
      if (txRes.status === 'fulfilled') {
        setTopups(txRes.value.data.filter(t => t.type === 'credit'));
      }
    }).then(() => api.get('/wallet/withdrawals').then(r => setWithdrawals(r.data)).catch(() => {}));

  const handleWithdraw = async () => {
    const amt = parseFloat(wd.amount);
    if (!amt || amt < 100) { toast.error('Minimum withdrawal is ₹100'); return; }
    if (amt > balance) { toast.error('Amount exceeds wallet balance'); return; }
    const err = validatePayout(payout, method);
    if (err) { toast.error(err); return; }
    setProcessing(true);
    try {
      const { data } = await api.post('/wallet/withdrawals', { amount: amt, ...payoutPayload(payout, method) });
      setBalance(data.balance ?? balance - amt);
      toast.success('Withdrawal requested — under admin review');
      setShowWithdraw(false); setWd({ amount: '' });
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Withdrawal failed');
    } finally { setProcessing(false); }
  };

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);

  const handleAddMoney = async () => {
    const amt = customAmount ? parseFloat(customAmount) : selectedAmount;
    if (!amt || amt < 10) { toast.error('Minimum ₹10'); return; }
    if (amt > 100000) { toast.error('Maximum ₹1,00,000 per top-up'); return; }
    setProcessing(true);
    try {
      const result = await topupWalletWithRazorpay({ amount: amt });
      setBalance(result.balance ?? balance + amt);
      toast.success(`₹${amt} added to your wallet!`);
      setShowAddMoney(false);
      setCustomAmount('');
      refresh();
    } catch (e) {
      const msg = e?.message || 'Payment failed';
      if (msg.toLowerCase().includes('cancel')) toast.info('Payment cancelled');
      else toast.error(msg);
    } finally { setProcessing(false); }
  };

  return (
    <div className="pb-24 animate-fade-in bg-slate-50 min-h-screen">

      {/* My Money Section */}
      <div className="bg-gradient-to-b from-[#0F4C3A] to-[#0d4032] px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-sm font-semibold text-white/70 uppercase tracking-wider">My Money</h1>
          <Wallet className="w-4 h-4 text-white/50" />
        </div>
        <p data-testid="wallet-balance" className="text-4xl font-bold text-white mb-1">{formatCurrency(balance)}</p>
        <p className="text-xs text-white/60">NAMCOS Wallet Balance</p>

        <button
          data-testid="add-money-btn"
          onClick={() => setShowAddMoney(true)}
          className="mt-5 flex items-center gap-2 bg-white text-[#0F4C3A] font-bold text-sm px-5 py-2.5 rounded-2xl shadow-md hover:bg-slate-50 active:scale-95 transition-all">
          <Plus className="w-4 h-4" /> Add Money
        </button>
        <button
          data-testid="withdraw-btn"
          onClick={() => setShowWithdraw(true)}
          className="mt-5 ml-2 inline-flex items-center gap-2 bg-white/15 text-white font-bold text-sm px-5 py-2.5 rounded-2xl hover:bg-white/25 active:scale-95 transition-all">
          <ArrowUpRight className="w-4 h-4" /> Withdraw
        </button>
        {withdrawals.filter(w => ['requested','under_review','approved','processing'].includes(w.status)).length > 0 && (
          <p className="text-[11px] text-white/70 mt-2">
            {withdrawals.filter(w => ['requested','under_review','approved','processing'].includes(w.status)).length} withdrawal(s) under review
          </p>
        )}
      </div>

      {/* Stats Row */}
      <div className="px-4 -mt-4 grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <TrendingUp className="w-4 h-4 text-slate-400 mb-2" />
          <p className="text-xs text-slate-500">Total Spent</p>
          <p className="text-lg font-bold text-slate-800 mt-0.5">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <p className="text-xs text-slate-500">Total Saved</p>
          <p className="text-lg font-bold text-green-600 mt-0.5">{formatCurrency(totalSaved)}</p>
          <p className="text-[9px] text-slate-400">via NAMCOS offers</p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="px-4">
        <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Transaction History</h2>
        {loading ? <SkeletonList count={4} /> : (() => {
          const history = [
            ...payments.map(p => ({ kind: 'pay', key: 'p' + p.id, date: p.created_at, ...p })),
            ...topups.map(t => ({ kind: 'topup', key: 't' + t.id, date: t.created_at, ...t })),
          ].sort((a, b) => new Date(b.date) - new Date(a.date));
          if (history.length === 0) {
            return <EmptyState type="orders" title="No transactions yet" description="Your payment history will appear here" />;
          }
          return (
            <div className="space-y-3">
              {history.map(item => item.kind === 'topup' ? (
                <div key={item.key} data-testid={`txn-${item.key}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-50">
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Money Added</p>
                        <p className="text-[10px] text-slate-400">{item.note || 'Wallet top-up'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">+{formatCurrency(item.amount)}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">Credited</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">{formatDate(item.date)}</p>
                </div>
              ) : (
                <div key={item.key} data-testid={`txn-${item.id}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        item.status === 'captured' ? 'bg-slate-100' : 'bg-red-50'}`}>
                        <ArrowDownLeft className={`w-4 h-4 ${item.status === 'captured' ? 'text-slate-600' : 'text-red-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.store_name || 'Payment'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{item.transaction_id}{item.payment_method === 'wallet' ? ' · Wallet' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${item.status === 'captured' ? 'text-slate-800' : 'text-red-500'}`}>
                        -{formatCurrency(item.net_paid)}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                  </div>
                  {item.discount_amount > 0 && (
                    <p className="text-xs text-green-600 mt-2">Saved {formatCurrency(item.discount_amount)} with NAMCOS</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">{formatDate(item.date)}</p>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end" onClick={() => !processing && setShowWithdraw(false)}>
          <div className="bg-white w-full max-w-[480px] mx-auto rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-slate-800">Withdraw to Bank / UPI</h3>
              <button onClick={() => setShowWithdraw(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Available balance: <strong>{formatCurrency(balance)}</strong>. Requests are reviewed by admin before payout.</p>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Amount</label>
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input type="number" placeholder="0" value={wd.amount} data-testid="withdraw-amount-input"
                onChange={e => setWd(w => ({ ...w, amount: e.target.value }))}
                className="w-full h-12 pl-8 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:border-[#0F4C3A]" />
            </div>
            <div className="mb-5"><PayoutFields payout={payout} setPayout={setPayout} method={method} setMethod={setMethod} /></div>
            <button onClick={handleWithdraw} disabled={processing} data-testid="withdraw-submit-btn"
              className="w-full h-12 bg-[#0F4C3A] hover:bg-[#0a3829] disabled:opacity-60 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2">
              {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : `Request Withdrawal`}
            </button>
          </div>
        </div>
      )}

      {/* Add Money Modal */}
      {showAddMoney && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end" onClick={() => setShowAddMoney(false)}>
          <div
            className="bg-white w-full max-w-[480px] mx-auto rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-800">Add Money to Wallet</h3>
              <button onClick={() => setShowAddMoney(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select Amount</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {ADD_AMOUNTS.map(amt => (
                <button key={amt} onClick={() => { setSelectedAmount(amt); setCustomAmount(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    selectedAmount === amt && !customAmount
                      ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                      : 'border-slate-200 text-slate-700 hover:border-[#0F4C3A]'
                  }`}>
                  ₹{amt}
                </button>
              ))}
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Or enter custom amount</p>
            <div className="relative mb-5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input type="number" placeholder="0"
                value={customAmount} onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(0); }}
                className="w-full h-12 pl-8 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:border-[#0F4C3A]"
                style={{ MozAppearance: 'textfield' }} />
            </div>

            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4">
              <div className="w-4 h-4 rounded-full bg-emerald-500 flex-shrink-0" />
              <p className="text-xs text-emerald-700">
                Secure payment via Razorpay. UPI / Cards / Netbanking supported.
              </p>
            </div>

            <button onClick={handleAddMoney} disabled={processing}
              data-testid="wallet-topup-btn"
              className="w-full h-12 bg-[#0F4C3A] hover:bg-[#0a3829] disabled:opacity-60 text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2">
              {processing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                : `Proceed to Pay ₹${customAmount || selectedAmount}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
