import React, { useState, useEffect } from 'react';
import { Banknote, Plus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/utils/format';
import EmptyState from '@/components/shared/EmptyState';
import { MERCHANT } from '@/constants/testIds';
import PayoutFields, { useSavedPayout, validatePayout, payoutPayload } from '@/components/shared/PayoutFields';

export default function MerchantWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({ amount: '', notes: '' });
  const { payout, setPayout, method, setMethod } = useSavedPayout();

  useEffect(() => {
    Promise.all([
      api.get('/merchant/withdrawals'),
      api.get('/merchant/balance'),
    ]).then(([wRes, bRes]) => {
      setWithdrawals(wRes.data);
      setBalance(bRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) < 100) { toast.error('Minimum withdrawal is ₹100'); return; }
    const err = validatePayout(payout, method);
    if (err) { toast.error(err); return; }
    setFormLoading(true);
    try {
      await api.post('/merchant/withdrawals', { notes: form.notes, amount: parseFloat(form.amount), ...payoutPayload(payout, method) });
      toast.success('Withdrawal request submitted');
      setShowForm(false);
      const [wRes, bRes] = await Promise.all([api.get('/merchant/withdrawals'), api.get('/merchant/balance')]);
      setWithdrawals(wRes.data); setBalance(bRes.data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setFormLoading(false); }
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Withdrawals</h1>
          <p className="text-sm text-slate-500">Request and track fund withdrawals</p>
        </div>
        <Button data-testid={MERCHANT.withdrawBtn} onClick={() => setShowForm(true)}
          className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl gap-2">
          <Banknote className="w-4 h-4" /> Request Withdrawal
        </Button>
      </div>

      {/* Balance */}
      {balance && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-[#0F4C3A] to-[#1a6b55] rounded-2xl p-5 text-white">
            <p className="text-xs opacity-75 mb-1">Available Balance</p>
            <p className="text-2xl font-bold">{formatCurrency(balance.available_balance)}</p>
            <p className="text-xs opacity-60 mt-1">Available to withdraw</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <p className="text-xs text-slate-500 mb-1">Pending Settlement</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(balance.pending_settlement)}</p>
            <p className="text-xs text-slate-400 mt-1">Will be available soon</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <p className="text-xs text-slate-500 mb-1">Total Withdrawn</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(balance.total_withdrawn)}</p>
          </div>
        </div>
      )}

      {/* Withdrawal History */}
      {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div> :
        withdrawals.length === 0 ? (
          <EmptyState type="orders" title="No withdrawal requests" description="Your withdrawal history will appear here"
            action={() => setShowForm(true)} actionLabel="Request Withdrawal" icon={Banknote} />
        ) : (
          <div className="space-y-3">
            {withdrawals.map(w => (
              <div key={w.id} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{formatCurrency(w.amount)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(w.created_at)}</p>
                  {w.admin_notes && <p className="text-xs text-slate-500 mt-1 italic">"{w.admin_notes}"</p>}
                </div>
                <div className="text-right">
                  <span className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(w.status)}`}>
                    {getStatusLabel(w.status)}
                  </span>
                  {w.bank_account && <p className="text-xs text-slate-400 mt-1">A/C: ****{w.bank_account.slice(-4)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Withdrawal Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Request Withdrawal</h3>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-green-700">Available balance: <span className="font-bold text-green-800">{formatCurrency(balance?.available_balance || 0)}</span></p>
                <p className="text-xs text-green-600 mt-0.5">Minimum withdrawal: ₹100</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Amount (₹) *</label>
                <Input type="number" placeholder="Enter amount" value={form.amount} onChange={e => set('amount', e.target.value)} className="rounded-xl border-slate-200" />
              </div>
              <PayoutFields payout={payout} setPayout={setPayout} method={method} setMethod={setMethod} />
              <Input placeholder="Note (optional)" value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-xl border-slate-200" />
              <div className="flex gap-3">
                <Button type="button" onClick={() => setShowForm(false)} variant="outline" className="flex-1 rounded-xl">Cancel</Button>
                <Button type="submit" disabled={formLoading} className="flex-1 bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Submit
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
