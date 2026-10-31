import { appName } from '@/lib/brand';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, TrendingUp, Banknote, Percent, Package, Eye, Loader2, ExternalLink, Clock } from 'lucide-react';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/format';

const STATUS_NOTE = {
  submitted: 'Waiting for admin approval. It will go live once approved.',
  under_review: 'Under admin review.',
  rejected: 'Rejected by admin.',
  suspended: 'Suspended by admin.',
  paused: 'Paused by you — not visible to customers.',
  published: 'Live — visible to customers.',
  sold: 'Marked as sold.',
};

function Stat({ label, value, icon: Icon, color, testId }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4" data-testid={testId}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-lg font-black text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

export default function ListingDashboard() {
  const { kind, id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/my/listings/${kind}/${id}/dashboard`).then(r => setData(r.data)).catch(e => setError(formatApiError(e)));
  }, [kind, id]);

  const item = data?.item || {};
  const title = item.business_name || item.product_name || item.service_name || item.title;
  const isStore = kind === 'store';
  const previewPath = { store: `/customer/store/${id}`, agriculture: `/customer/agriculture/${id}`,
    service: `/customer/service/${id}`, classified: `/customer/classified/${id}` }[kind];

  return (
    <div data-testid="listing-dashboard-page" className="pb-24 bg-slate-50 min-h-screen animate-fade-in">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/customer/my-listings')} data-testid="listing-dashboard-back"
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-black text-slate-900 truncate">{title || 'Dashboard'}</h1>
          <p className="text-[11px] text-slate-500">Merchant dashboard</p>
        </div>
      </div>

      {error ? <p className="p-6 text-sm text-red-600" data-testid="listing-dashboard-error">{error}</p> : !data ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0F4C3A]" /></div>
      ) : (
        <div className="px-4 pt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-start gap-3" data-testid="listing-dashboard-status">
            <Clock className="w-4 h-4 text-[#0F4C3A] mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Status: {data.status}</p>
              <p className="text-sm text-slate-700 mt-0.5">{STATUS_NOTE[data.status] || ''}</p>
              {item.rejection_reason && <p className="text-xs text-red-600 mt-1">Reason: {item.rejection_reason}</p>}
            </div>
            <button onClick={() => navigate(previewPath)} data-testid="listing-dashboard-preview"
              className="flex items-center gap-1 text-xs font-bold text-[#0F4C3A]">Preview <ExternalLink className="w-3 h-3" /></button>
          </div>

          {isStore ? (
            <>
              <div className="rounded-3xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #0F4C3A, #1a6b4d)' }}>
                <p className="text-[10px] uppercase tracking-widest text-white/70 font-bold">Available Balance (this store)</p>
                <p className="text-3xl font-black mt-1" data-testid="ld-available">{formatCurrency(data.available_balance)}</p>
                <p className="text-xs text-white/70 mt-1">Withdrawn: {formatCurrency(data.withdrawn)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Total Orders" value={data.total_orders} icon={ShoppingBag} color="#0F4C3A" testId="ld-orders" />
                <Stat label="Gross Sales" value={formatCurrency(data.gross_sales)} icon={TrendingUp} color="#16A34A" testId="ld-gross" />
                <Stat label="Net Earnings" value={formatCurrency(data.net_earnings)} icon={Banknote} color="#2563EB" testId="ld-net" />
                <Stat label={`${appName()} Fee`} value={formatCurrency(data.namcos_fee)} icon={Percent} color="#7C3AED" testId="ld-fee" />
                <Stat label="Customer Discounts" value={formatCurrency(data.customer_discount)} icon={Percent} color="#F59E0B" testId="ld-discount" />
                <Stat label="Products" value={data.products_count} icon={Package} color="#0891B2" testId="ld-products" />
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Allocation set by admin</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700">Customer {data.rates.discount_percent || 0}%</span>
                  <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700">Referral {data.rates.referral_percent || 0}%</span>
                  <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700">Chain {data.rates.chain_percent || 0}%</span>
                  <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">{appName()} {data.rates.namcos_percent || 0}%</span>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4" data-testid="ld-recent-payments">
                <p className="text-sm font-bold text-slate-800 mb-3">Recent Payments</p>
                {data.recent_payments.length === 0 ? <p className="text-xs text-slate-400">No payments yet</p> :
                  data.recent_payments.map(p => (
                    <div key={p.transaction_id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{p.customer_name || 'Customer'}</p>
                        <p className="text-[11px] text-slate-400">{p.customer_phone} · {formatDate(p.created_at)} · {p.payment_method}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#0F4C3A]">{formatCurrency(p.merchant_amount)}</p>
                        <p className="text-[10px] text-slate-400">of {formatCurrency(p.net_paid)}</p>
                      </div>
                    </div>
                  ))}
              </div>
              <button onClick={() => navigate('/merchant')} data-testid="ld-open-full-portal"
                className="w-full h-11 rounded-2xl border border-[#0F4C3A] text-[#0F4C3A] text-sm font-bold">
                Open full merchant portal (orders, products)
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Views" value={data.view_count || 0} icon={Eye} color="#0F4C3A" testId="ld-views" />
              <Stat label="Price" value={formatCurrency(item.price ?? item.starting_price ?? 0)} icon={Banknote} color="#16A34A" testId="ld-price" />
              <div className="col-span-2 bg-white rounded-2xl border border-slate-100 p-4 text-sm text-slate-600">
                <p><strong>Category:</strong> {item.category || '—'}</p>
                <p className="mt-1"><strong>Location:</strong> {[item.locality, item.city].filter(Boolean).join(', ')}</p>
                <p className="mt-1"><strong>Listed on:</strong> {formatDate(item.created_at)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
