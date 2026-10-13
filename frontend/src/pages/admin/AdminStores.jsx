import React, { useState, useEffect, useCallback } from 'react';
import { Search, CheckCircle, XCircle, Clock, MapPin, Star, Pencil, BarChart3, Loader2, Landmark } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/utils/format';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import Pagination from '@/components/shared/Pagination';
import ImageUploader from '@/components/shared/ImageUploader';
import { ADMIN } from '@/constants/testIds';
import PayoutDetailsModal from '@/components/admin/PayoutDetailsModal';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'paused', label: 'Paused' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];
const LIMIT = 15;

export default function AdminStores() {
  const [stores, setStores] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [txnStore, setTxnStore] = useState(null);
  const [txnData, setTxnData] = useState(null);
  const [editStore, setEditStore] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [payoutStore, setPayoutStore] = useState(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const params = { skip: (page - 1) * LIMIT, limit: LIMIT };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const [listRes, countRes] = await Promise.all([
        api.get('/admin/merchants', { params }),
        api.get('/admin/merchants-count', { params: { search: search || undefined, status: statusFilter || undefined } }),
      ]);
      setStores(listRes.data);
      setTotal(countRes.data.total || listRes.data.length);
    } catch { setStores([]); }
    finally { setLoading(false); }
  }, [search, statusFilter, page]);

  useEffect(() => {
    const t = setTimeout(fetchStores, 300);
    return () => clearTimeout(t);
  }, [fetchStores]);

  const handleAction = async (storeId, status) => {
    setActionLoading(true);
    try {
      await api.put(`/admin/merchants/${storeId}/status`, { status, reason });
      toast.success(`Store ${status} successfully`);
      setSelected(null); setReason('');
      fetchStores();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setActionLoading(false); }
  };

  const saveRate = async (storeId, field, value) => {
    const v = parseFloat(value) || 0;
    try {
      await api.put(`/admin/stores/${storeId}/rates`, { [field]: v });
      setStores(prev => prev.map(s => s.id === storeId ? { ...s, [field]: v } : s));
      toast.success('Allocation updated');
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const openTxns = async (store) => {
    setTxnStore(store); setTxnData(null);
    try {
      const { data } = await api.get(`/admin/stores/${store.id}/transactions`);
      setTxnData(data);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const saveStoreEdit = async () => {
    setSavingEdit(true);
    try {
      const payload = {
        business_name: editStore.business_name,
        business_type: editStore.business_type,
        owner_name: editStore.owner_name,
        phone: editStore.phone,
        description: editStore.description,
        address: editStore.address,
        locality: editStore.locality,
        city: editStore.city,
        pincode: editStore.pincode,
        state: editStore.state,
        service_radius: parseFloat(editStore.service_radius) || 0,
        upi_id: editStore.upi_id,
        bank_account: editStore.bank_account,
        ifsc: (editStore.ifsc || '').toUpperCase(),
        account_holder: editStore.account_holder,
        opening_time: editStore.opening_time,
        closing_time: editStore.closing_time,
        images: editStore.images || [],
        logo: (editStore.images && editStore.images[0]) || editStore.logo || null,
      };
      await api.put(`/admin/edit/store/${editStore.id}`, payload);
      toast.success('Store updated');
      setEditStore(null);
      fetchStores();
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingEdit(false);
  };

  return (
    <div data-testid={ADMIN.storesTable} className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Store Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Approve, review and manage store registrations</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {STATUS_TABS.map(t => (
          <button key={t.value} onClick={() => setStatusFilter(t.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === t.value ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search stores..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 rounded-xl border-slate-200 bg-white" />
      </div>

      {loading ? <SkeletonList count={5} /> :
        stores.length === 0 ? (
          <EmptyState type="stores" title="No stores found"
            description={statusFilter ? `No ${statusFilter} stores` : 'No stores registered yet'} />
        ) : (
          <div className="grid gap-3">
            {stores.map(store => (
              <div key={store.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-4 hover:shadow-sm transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-[#0F4C3A]/8 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-[#0F4C3A]">{store.business_name?.[0] || 'S'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">{store.business_name}</h3>
                      <p className="text-xs text-slate-500">{store.business_type}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${getStatusColor(store.status)}`}>
                      {getStatusLabel(store.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="w-3 h-3" />{store.locality}, {store.city}
                    </span>
                    <span className="text-xs text-slate-500">Owner: {store.owner_name}</span>
                    <span className="text-xs text-slate-500">{formatDate(store.created_at)}</span>
                    {store.rating > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />{store.rating}
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-50">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Per-store allocation (% of bill)</p>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { f: 'discount_percent', label: 'Customer', color: '#F6B400' },
                        { f: 'referral_percent', label: 'Referral', color: '#2563EB' },
                        { f: 'chain_percent', label: 'Chain', color: '#7C3AED' },
                        { f: 'namcos_percent', label: 'NAMCOS Fee', color: '#0F4C3A' },
                      ].map(({ f, label, color }) => (
                        <label key={f} className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
                          <input type="number" min="0" max="90" step="0.5"
                            defaultValue={store[f] ?? 0}
                            data-testid={`store-${f}-${store.id}`}
                            onBlur={e => { if ((parseFloat(e.target.value) || 0) !== (store[f] || 0)) saveRate(store.id, f, e.target.value); }}
                            className="w-14 h-7 px-2 text-xs font-bold text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F4C3A]" />
                          <span className="text-[10px] text-slate-400">%</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openTxns(store)} data-testid={`store-txns-${store.id}`}
                    title="Transaction totals"
                    className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors">
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditStore({ ...store, images: store.images || [] })}
                    data-testid={`store-edit-${store.id}`} title="Edit store"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => setPayoutStore(store)}
                    data-testid={`store-bank-${store.id}`} title="Account details"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium transition-colors">
                    <Landmark className="w-3.5 h-3.5" /> Bank
                  </button>
                  {store.status === 'submitted' && (
                    <>
                      <button data-action="approve" data-testid={`store-approve-${store.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
                        onClick={() => handleAction(store.id, 'published')}>
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => setSelected({ ...store, _rejectMode: true })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                  {(store.status === 'published' || store.status === 'paused') && (
                    <button onClick={() => handleAction(store.id, 'suspended')} data-testid={`store-suspend-${store.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-medium transition-colors">
                      <Clock className="w-3.5 h-3.5" /> Suspend
                    </button>
                  )}
                  {store.status === 'suspended' && (
                    <button onClick={() => handleAction(store.id, 'published')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors">
                      Reinstate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      {!loading && stores.length > 0 && (
        <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} onPageChange={setPage} loading={loading} />
      )}

      {payoutStore && (
        <PayoutDetailsModal url={`/admin/stores/${payoutStore.id}/payout`} title={payoutStore.business_name} onClose={() => setPayoutStore(null)} />
      )}

      {/* Per-store transactions modal */}
      {txnStore && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setTxnStore(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Transactions · {txnStore.business_name}</h3>
              <button onClick={() => setTxnStore(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            {!txnData ? <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0F4C3A]" /></div> : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Total Transactions</p><p className="text-xl font-bold text-slate-900">{txnData.total_transactions}</p></div>
                <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Total Amount</p><p className="text-xl font-bold text-slate-900">{formatCurrency(txnData.total_amount)}</p></div>
                <div className="bg-emerald-50 rounded-xl p-3"><p className="text-xs text-emerald-700">Store Revenue (after deductions)</p><p className="text-xl font-bold text-[#0F4C3A]">{formatCurrency(txnData.merchant_revenue_after_deduction)}</p></div>
                <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">NAMCOS Earning</p><p className="text-lg font-bold text-slate-700">{formatCurrency(txnData.namcos_earning)}</p></div>
                <div className="bg-amber-50 rounded-xl p-3 col-span-2"><p className="text-xs text-amber-700">Customer Discounts Given</p><p className="text-lg font-bold text-amber-700">{formatCurrency(txnData.customer_discount)}</p></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full store edit modal */}
      {editStore && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditStore(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-slate-800">Edit Store · {editStore.business_name}</h3>
              <button onClick={() => setEditStore(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <ImageUploader value={editStore.images || []} onChange={imgs => setEditStore({ ...editStore, images: imgs })} min={0} max={8} testIdPrefix="store-edit-images" />
              {[
                ['business_name', 'Business Name'], ['business_type', 'Business Type'],
                ['owner_name', 'Owner Name'], ['phone', 'Contact Phone'],
                ['address', 'Address'], ['locality', 'Locality'], ['city', 'City'],
                ['state', 'State'], ['pincode', 'Pincode'], ['service_radius', 'Service Radius (km)'],
                ['upi_id', 'UPI ID'], ['account_holder', 'Bank Account Holder'], ['bank_account', 'Bank Account Number'], ['ifsc', 'IFSC Code'],
              ].map(([f, label]) => (
                <div key={f}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
                  <Input value={editStore[f] || ''} onChange={e => setEditStore({ ...editStore, [f]: e.target.value })}
                    data-testid={`store-edit-${f}`} className="rounded-xl border-slate-200" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Opening Time</label>
                  <Input type="time" value={editStore.opening_time || ''} onChange={e => setEditStore({ ...editStore, opening_time: e.target.value })} className="rounded-xl border-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Closing Time</label>
                  <Input type="time" value={editStore.closing_time || ''} onChange={e => setEditStore({ ...editStore, closing_time: e.target.value })} className="rounded-xl border-slate-200" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Description</label>
                <textarea value={editStore.description || ''} onChange={e => setEditStore({ ...editStore, description: e.target.value })} rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0F4C3A] resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditStore(null)}>Cancel</Button>
                <Button onClick={saveStoreEdit} disabled={savingEdit} data-testid="store-edit-save"
                  className="flex-1 bg-[#0F4C3A] hover:bg-[#0a3829] text-white">
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail/Reject Modal */}
      {selected?._rejectMode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-2">Reject Store: {selected.business_name}</h3>
            <textarea placeholder="Reason for rejection (optional)" value={reason}
              onChange={e => setReason(e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 mb-4 resize-none" />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setSelected(null); setReason(''); }}>Cancel</Button>
              <Button onClick={() => handleAction(selected.id, 'rejected')} disabled={actionLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                Confirm Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
