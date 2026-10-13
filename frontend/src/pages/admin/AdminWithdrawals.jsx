import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Banknote, Download, User, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/utils/format';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import Pagination from '@/components/shared/Pagination';
import { ADMIN } from '@/constants/testIds';

const KIND_TABS = [
  { value: 'merchant', label: 'Merchant', icon: Store },
  { value: 'user', label: 'User (Wallet)', icon: User },
];
const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];
const LIMIT = 20;

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('merchant');
  const [statusFilter, setStatusFilter] = useState('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { kind, skip: (page - 1) * LIMIT, limit: LIMIT };
    if (statusFilter) params.status = statusFilter;
    if (month) params.month = month;
    try {
      const { data } = await api.get('/admin/withdrawals-list', { params });
      setWithdrawals(data.items || []);
      setTotal(data.total || 0);
    } catch { setWithdrawals([]); }
    setLoading(false);
  }, [kind, statusFilter, month, page]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id, status) => {
    if (status === 'paid' && !referenceId.trim()) {
      toast.error('Reference ID is required to mark as paid');
      return;
    }
    setActionLoading(true);
    try {
      if (status === 'paid') {
        await api.put(`/admin/withdrawals/${id}/reference`, { reference_id: referenceId.trim(), notes });
      } else {
        await api.put(`/admin/withdrawals/${id}/status`, { status, notes });
      }
      toast.success(`Withdrawal ${status} successfully`);
      setSelected(null); setNotes(''); setReferenceId('');
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setActionLoading(false); }
  };

  const exportCsv = async () => {
    try {
      const params = { kind };
      if (statusFilter) params.status = statusFilter;
      if (month) params.month = month;
      const res = await api.get('/admin/withdrawals-export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `withdrawals_${kind}_${month || 'all'}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('Export downloaded');
    } catch (e) { toast.error('Export failed'); }
  };

  return (
    <div data-testid={ADMIN.withdrawalsTable} className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Withdrawals</h1>
          <p className="text-sm text-slate-500 mt-0.5">Process merchant & user withdrawal requests</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} data-testid="wd-month"
            onChange={e => { setMonth(e.target.value); setPage(1); }}
            className="h-9 px-3 border border-slate-200 rounded-xl text-sm bg-white" />
          <Button onClick={exportCsv} data-testid="wd-export-btn" variant="outline"
            className="rounded-xl border-slate-200 text-slate-700">
            <Download className="w-4 h-4 mr-1.5" /> Excel
          </Button>
        </div>
      </div>

      {/* Kind tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-3 w-fit">
        {KIND_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.value} data-testid={`wd-kind-${t.value}`}
              onClick={() => { setKind(t.value); setPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                kind === t.value ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.value} onClick={() => { setStatusFilter(t.value); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === t.value ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <SkeletonList count={5} /> :
        withdrawals.length === 0 ? (
          <EmptyState type="orders" title="No withdrawal requests"
            description={`No ${kind} withdrawals${statusFilter ? ` (${statusFilter})` : ''}${month ? ` in ${month}` : ''}`} />
        ) : (
          <>
            <div className="grid gap-3">
              {withdrawals.map(w => (
                <div key={w.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Banknote className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {w.merchant_name || w.user_name || 'User'}
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          {w.type === 'wallet' ? 'USER WALLET' : 'MERCHANT'}
                        </span>
                      </h3>
                      <span className="text-xl font-bold text-[#0F4C3A]">{formatCurrency(w.amount)}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                      {w.upi_id && <span data-testid={`wd-upi-${w.id}`}>UPI: <b className="text-slate-700">{w.upi_id}</b></span>}
                      {w.bank_account && <span data-testid={`wd-bank-${w.id}`}>{w.account_holder && <>Holder: <b className="text-slate-700">{w.account_holder}</b> · </>}A/C: <b className="text-slate-700">{w.bank_account}</b> · IFSC: <b className="text-slate-700">{w.ifsc}</b>{w.bank_name && <> · {w.bank_name}</>}</span>}
                      {(w.merchant_phone || w.user_phone) && <span>{w.merchant_phone || w.user_phone}</span>}
                      <span>{formatDate(w.created_at)}</span>
                      {w.reference_id && <span>Ref: {w.reference_id}</span>}
                    </div>
                    {w.admin_notes && <p className="text-xs text-slate-400 mt-1">Note: {w.admin_notes}</p>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${getStatusColor(w.status)}`}>
                    {getStatusLabel(w.status)}
                  </span>
                  {(w.status === 'requested' || w.status === 'under_review') && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setSelected({ ...w, _action: 'paid' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Pay
                      </button>
                      <button onClick={() => setSelected({ ...w, _action: 'approved' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                        <Clock className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => setSelected({ ...w, _action: 'rejected' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} onPageChange={setPage} loading={loading} />
          </>
        )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-1">
              {selected._action === 'paid' ? 'Mark as Paid' :
               selected._action === 'approved' ? 'Approve Request' : 'Reject Request'}
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              {formatCurrency(selected.amount)} — {selected.merchant_name || selected.user_name}
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-3 text-xs text-slate-700 space-y-0.5" data-testid="wd-modal-account">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pay to</p>
              {selected.account_holder && <p>Holder: <b>{selected.account_holder}</b></p>}
              {selected.bank_account && <p>A/C: <b>{selected.bank_account}</b></p>}
              {selected.ifsc && <p>IFSC: <b>{selected.ifsc}</b></p>}
              {selected.bank_name && <p>Bank: <b>{selected.bank_name}</b></p>}
              {selected.upi_id && <p>UPI: <b>{selected.upi_id}</b></p>}
              {!selected.bank_account && !selected.upi_id && <p className="text-red-600">No account details on this request</p>}
            </div>
            {selected._action === 'paid' && (
              <div className="mb-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Reference ID *</label>
                <input value={referenceId} onChange={e => setReferenceId(e.target.value)}
                  data-testid="withdrawal-reference-id" placeholder="UPI txn / bank ref"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4C3A]" />
              </div>
            )}
            <textarea placeholder="Admin notes (optional)" value={notes}
              onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0F4C3A] mb-4 resize-none" />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setSelected(null); setNotes(''); setReferenceId(''); }}>Cancel</Button>
              <Button onClick={() => handleAction(selected.id, selected._action)} disabled={actionLoading}
                className={`flex-1 text-white ${selected._action === 'rejected' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#0F4C3A] hover:bg-[#0a3829]'}`}>
                Confirm {selected._action}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
