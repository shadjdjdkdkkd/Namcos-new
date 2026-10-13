import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Store, Leaf, Wrench, Tag, Loader2, ToggleLeft, ToggleRight, CheckCircle2,
  MapPin, Eye, TrendingUp, Banknote, LayoutDashboard, Clock,
} from 'lucide-react';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';
import PayoutFields, { useSavedPayout, validatePayout, payoutPayload } from '@/components/shared/PayoutFields';

const KIND_MAP = {
  store:       { icon: Store,  color: '#0F4C3A', label: 'Shop' },
  agriculture: { icon: Leaf,   color: '#16A34A', label: 'Agriculture' },
  service:     { icon: Wrench, color: '#2563EB', label: 'Service' },
  classified:  { icon: Tag,    color: '#7C3AED', label: 'Classified' },
};

const STATUS_STYLES = {
  submitted:  'bg-amber-50 text-amber-700 border-amber-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved:   'bg-blue-50 text-blue-700 border-blue-200',
  published:  'bg-green-50 text-green-700 border-green-200',
  paused:     'bg-slate-100 text-slate-500 border-slate-200',
  sold:       'bg-purple-50 text-purple-700 border-purple-200',
  rejected:   'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS = {
  submitted: 'Pending', under_review: 'Under Review',
  approved: 'Approved', published: 'Live',
  paused: 'Paused', sold: 'Sold', rejected: 'Rejected',
};

const KIND_FILTERS = [
  { value: '', label: 'All' },
  { value: 'store', label: 'Shops' },
  { value: 'agriculture', label: 'Produce' },
  { value: 'service', label: 'Services' },
  { value: 'classified', label: 'Classifieds' },
];

export default function MyListings() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('');
  const [earnings, setEarnings] = useState(null);
  const [showWd, setShowWd] = useState(false);
  const [wdAmount, setWdAmount] = useState('');
  const { payout, setPayout, method, setMethod } = useSavedPayout();
  const [wdBusy, setWdBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [l, e] = await Promise.allSettled([api.get('/my/listings'), api.get('/my/earnings')]);
      if (l.status === 'fulfilled') setItems(l.value.data || []);
      if (e.status === 'fulfilled') setEarnings(e.value.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = kind ? items.filter(i => i.kind === kind) : items;

  const handleToggle = async (it) => {
    const nextActive = !(it.is_active !== false && it.status !== 'paused');
    try {
      await api.put(`/my/listings/${it.kind}/${it.id}/toggle`, { is_active: nextActive });
      toast.success(nextActive ? 'Listing enabled' : 'Listing paused');
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const handleMarkSold = async (it) => {
    if (!window.confirm(`Mark "${it.title}" as sold?`)) return;
    try {
      await api.put(`/my/listings/${it.kind}/${it.id}/mark-sold`);
      toast.success('Marked as sold');
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const requestWithdrawal = async () => {
    const amt = parseFloat(wdAmount);
    if (!amt || amt < 100) { toast.error('Minimum ₹100'); return; }
    if (amt > (earnings?.available_balance ?? 0)) { toast.error('Amount exceeds available balance'); return; }
    const err = validatePayout(payout, method);
    if (err) { toast.error(err); return; }
    setWdBusy(true);
    try {
      await api.post('/merchant/withdrawals', { amount: amt, ...payoutPayload(payout, method) });
      toast.success('Withdrawal requested — admin will process it');
      setShowWd(false); setWdAmount('');
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setWdBusy(false);
  };

  return (
    <div data-testid="my-listings-page" className="pb-24 animate-fade-in bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm px-4 py-3">
        <h1 className="text-lg font-black text-slate-900">My Listings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Track, edit and manage everything you list on NAMCOS</p>
      </div>

      {/* Earnings Summary */}
      <div className="mx-4 mt-4 rounded-3xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #0F4C3A, #1a6b4d)' }}>
        <p className="text-[10px] uppercase tracking-widest text-white/70 font-bold">Available Balance</p>
        <p className="text-4xl font-black mt-1">{formatCurrency(earnings?.available_balance ?? 0)}</p>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          <div className="bg-white/10 rounded-2xl py-2">
            <p className="text-[10px] text-white/70 uppercase tracking-wider">Total Earned</p>
            <p className="text-sm font-bold mt-0.5">{formatCurrency(earnings?.total_net ?? 0)}</p>
          </div>
          <div className="bg-white/10 rounded-2xl py-2">
            <p className="text-[10px] text-white/70 uppercase tracking-wider">Withdrawn</p>
            <p className="text-sm font-bold mt-0.5">{formatCurrency(earnings?.total_withdrawn ?? 0)}</p>
          </div>
          <div className="bg-white/10 rounded-2xl py-2">
            <p className="text-[10px] text-white/70 uppercase tracking-wider">Pending</p>
            <p className="text-sm font-bold mt-0.5">{formatCurrency(earnings?.pending_withdrawal ?? 0)}</p>
          </div>
        </div>
        <button
          data-testid="request-withdrawal-btn"
          onClick={() => setShowWd(true)}
          disabled={!earnings?.available_balance}
          className="w-full mt-4 h-11 bg-white text-[#0F4C3A] rounded-2xl font-bold text-sm shadow-md hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed">
          Request Withdrawal
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto px-4 pt-4 pb-2 scrollbar-none">
        {KIND_FILTERS.map(f => (
          <button key={f.value || 'all'}
            data-testid={`my-filter-${f.value || 'all'}`}
            onClick={() => setKind(f.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              kind === f.value ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white text-slate-700 border-slate-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-6">
          <Package className="w-14 h-14 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600 mb-1">Nothing listed yet</p>
          <p className="text-xs text-slate-400 mb-4">Start earning by listing your business, produce or item</p>
          <button
            onClick={() => navigate('/customer/register-merchant')}
            className="h-11 px-6 bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-2xl text-sm font-bold">
            Create a Listing
          </button>
        </div>
      ) : (
        <div className="px-4 pt-2 space-y-3">
          {filtered.map(it => <MyItem key={`${it.kind}-${it.id}`} it={it} onToggle={handleToggle} onMarkSold={handleMarkSold}
            onDashboard={() => navigate(`/customer/my-listings/${it.kind}/${it.id}/dashboard`)} onOpen={() => {
            const routes = { store: `/customer/store/${it.id}`, agriculture: `/customer/agriculture/${it.id}`,
                             service: `/customer/service/${it.id}`, classified: `/customer/classified/${it.id}` };
            navigate(routes[it.kind]);
          }} />)}
        </div>
      )}

      {/* Withdrawal Modal */}
      {showWd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowWd(false)}>
          <div className="bg-white w-full max-w-[480px] rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-900 mb-1">Request Withdrawal</h3>
            <p className="text-xs text-slate-500 mb-4">Available balance: <strong>{formatCurrency(earnings?.available_balance ?? 0)}</strong> · Min ₹100</p>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Amount (₹)</label>
            <input data-testid="wd-amount" type="number" value={wdAmount} onChange={e => setWdAmount(e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 rounded-xl text-sm mb-3" placeholder="500" />
            <div className="mb-4"><PayoutFields payout={payout} setPayout={setPayout} method={method} setMethod={setMethod} /></div>
            <div className="flex gap-2">
              <button onClick={() => setShowWd(false)}
                className="flex-1 h-12 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600">Cancel</button>
              <button data-testid="wd-submit" onClick={requestWithdrawal} disabled={wdBusy}
                className="flex-[2] h-12 bg-[#0F4C3A] text-white rounded-2xl text-sm font-bold disabled:opacity-60">
                {wdBusy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Submit request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyItem({ it, onToggle, onMarkSold, onOpen, onDashboard }) {
  const cfg = KIND_MAP[it.kind] || KIND_MAP.store;
  const Icon = cfg.icon;
  const badge = STATUS_STYLES[it.status] || 'bg-slate-50 text-slate-500 border-slate-200';
  const badgeLabel = STATUS_LABELS[it.status] || it.status;
  const image = it.images?.[0];
  const isLive = it.status === 'published' && it.is_active !== false;
  const isSold = it.status === 'sold';
  const canToggle = it.status === 'published' || it.status === 'paused';

  return (
    <div data-testid={`my-item-${it.id}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex gap-3 p-3" onClick={onOpen}>
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 relative">
          {image
            ? <img src={image} alt={it.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Icon className="w-8 h-8" style={{ color: `${cfg.color}40` }} /></div>}
          <span className="absolute top-1 left-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white uppercase tracking-widest" style={{ background: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-slate-900 truncate flex-1">{it.title || '—'}</p>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${badge}`}>
              {badgeLabel}
            </span>
          </div>
          {it.category && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{it.category}</p>}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
            {it.locality && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {it.locality}</span>}
            {it.view_count > 0 && <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" /> {it.view_count}</span>}
            {it.created_at && <span>{formatDate(it.created_at)}</span>}
          </div>
          {it.price != null && <p className="text-base font-black mt-1" style={{ color: cfg.color }}>{formatCurrency(it.price)}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 pb-3 pt-1 border-t border-slate-50 flex-wrap">
        <button data-testid={`my-dashboard-${it.id}`}
          onClick={(e) => { e.stopPropagation(); onDashboard(); }}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-[#0F4C3A] bg-[#0F4C3A]/10 hover:bg-[#0F4C3A]/15">
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </button>
        {!isSold && !canToggle && (
          <span data-testid={`my-awaiting-${it.id}`} className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5" /> {it.status === 'rejected' ? 'Rejected by admin' : it.status === 'suspended' ? 'Suspended by admin' : 'Awaiting admin approval'}
          </span>
        )}
      {!isSold && canToggle && (
        <>
          <button
            data-testid={`my-toggle-${it.id}`}
            onClick={(e) => { e.stopPropagation(); onToggle(it); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${
              isLive ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
            }`}>
            {isLive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {isLive ? 'On' : 'Paused'}
          </button>
          <button
            data-testid={`my-sold-${it.id}`}
            onClick={(e) => { e.stopPropagation(); onMarkSold(it); }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100">
            <CheckCircle2 className="w-4 h-4" /> Mark Sold
          </button>
        </>
      )}
      </div>
    </div>
  );
}
