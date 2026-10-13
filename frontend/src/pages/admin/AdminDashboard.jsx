import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Store as StoreIcon, CreditCard, TrendingUp, Clock, AlertCircle,
  Banknote, CheckCircle, Calendar, Filter, Info, Wallet, Users2, Link2, Landmark,
} from 'lucide-react';
import api from '@/utils/api';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { ADMIN } from '@/constants/testIds';

const PRESETS = [
  { value: '3d', label: 'Last 3 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '6mo', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
  { value: 'custom', label: 'Custom range' },
];

function StatCard({ label, value, icon: Icon, color, sub, loading }) {
  if (loading) return <div className="skeleton h-28 rounded-2xl bg-white" />;
  return (
    <div data-testid={ADMIN.statsCard} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5 font-medium">{label}</p>
      {sub && <p className="text-xs mt-1 font-semibold" style={{ color }}>{sub}</p>}
    </div>
  );
}

function MoneyCard({ label, value, icon: Icon, color, info, loading }) {
  if (loading) return <div className="skeleton h-28 rounded-2xl bg-white" />;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow relative group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {info && (
          <div className="relative">
            <Info className="w-4 h-4 text-slate-300 hover:text-slate-500 cursor-help" data-testid={`info-${label}`} />
            <div className="absolute right-0 top-5 z-20 w-56 bg-slate-900 text-white text-[11px] leading-relaxed rounded-lg p-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
              {info}
            </div>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5 font-medium">{label}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Date-based analytics
  const [preset, setPreset] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    const params = {};
    if (preset === 'custom') {
      if (customFrom) params.date_from = customFrom;
      if (customTo) params.date_to = customTo;
    } else {
      params.preset = preset;
    }
    try {
      const [a, m] = await Promise.all([
        api.get('/admin/analytics', { params }),
        api.get('/admin/dashboard-metrics', { params }),
      ]);
      setAnalytics(a.data);
      setMetrics(m.data.metrics);
    } catch { setAnalytics(null); setMetrics(null); }
    setAnalyticsLoading(false);
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    if (preset !== 'custom') loadAnalytics();
  }, [preset, loadAnalytics]);

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    loadAnalytics();
  };

  return (
    <div data-testid={ADMIN.dashboard} className="p-6 animate-fade-in max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform overview & key metrics</p>
      </div>

      {/* Alerts */}
      {!loading && (stats?.pending_stores > 0 || stats?.pending_withdrawals > 0 || stats?.pending_moderation > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Action Required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {[
                stats?.pending_stores > 0 && `${stats.pending_stores} store submission(s) pending`,
                stats?.pending_withdrawals > 0 && `${stats.pending_withdrawals} withdrawal request(s) pending`,
                stats?.pending_moderation > 0 && `${stats.pending_moderation} listing(s) pending moderation`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1 — Overall Stats */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Overall</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard label="Total Users" value={stats?.total_users ?? 0} icon={Users} color="#0F4C3A" loading={loading} />
          <StatCard label="Active Stores" value={stats?.active_stores ?? 0} icon={StoreIcon} color="#16A34A" loading={loading}
            sub={stats?.pending_stores > 0 ? `${stats.pending_stores} pending` : null} />
          <StatCard label="Total Transactions" value={stats?.total_payments ?? 0} icon={CreditCard} color="#2563EB" loading={loading} />
          <StatCard label="GMV" value={formatCurrency(stats?.gmv ?? 0)} icon={TrendingUp} color="#7C3AED" loading={loading}
            sub={`${formatCurrency(stats?.net_revenue ?? 0)} net`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Orders" value={stats?.total_orders ?? 0} icon={CheckCircle} color="#0891B2" loading={loading} />
          <StatCard label="Net Revenue" value={formatCurrency(stats?.net_revenue ?? 0)} icon={Banknote} color="#0F4C3A" loading={loading} />
          <StatCard label="Pending Withdrawals" value={stats?.pending_withdrawals ?? 0} icon={Clock} color="#F59E0B" loading={loading} />
          <StatCard label="Pending Moderation" value={stats?.pending_moderation ?? 0} icon={AlertCircle} color="#DC2626" loading={loading} />
        </div>
      </div>

      {/* SECTION 2 — Date-based Analytics */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">By date range</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />
            {PRESETS.map(p => (
              <button
                key={p.value}
                data-testid={`dashboard-preset-${p.value}`}
                onClick={() => setPreset(p.value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  preset === p.value ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#0F4C3A]'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="flex items-end gap-2 bg-white rounded-2xl border border-slate-200 p-3 mb-4">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                data-testid="dashboard-date-from"
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                data-testid="dashboard-date-to"
                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm" />
            </div>
            <button onClick={applyCustom}
              data-testid="dashboard-apply-custom"
              className="h-10 px-5 bg-[#0F4C3A] text-white rounded-xl text-sm font-bold hover:bg-[#0a3829]">Apply</button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard label="Transactions" value={analytics?.totals?.transactions ?? 0} icon={CreditCard} color="#2563EB" loading={analyticsLoading} />
          <StatCard label="GMV" value={formatCurrency(analytics?.totals?.gmv ?? 0)} icon={TrendingUp} color="#7C3AED" loading={analyticsLoading} />
          <StatCard label="Fees Earned" value={formatCurrency(analytics?.totals?.fees ?? 0)} icon={Banknote} color="#0F4C3A" loading={analyticsLoading} />
          <StatCard label="New Users" value={analytics?.totals?.new_users ?? 0} icon={Users} color="#16A34A" loading={analyticsLoading} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Withdrawals Paid" value={analytics?.totals?.withdrawals_paid ?? 0} icon={CheckCircle} color="#0891B2" loading={analyticsLoading} />
          <StatCard label="Withdrawal Amount" value={formatCurrency(analytics?.totals?.withdrawal_amount ?? 0)} icon={Banknote} color="#DC2626" loading={analyticsLoading} />
        </div>
      </div>

      {/* SECTION 3 — Money & Earnings */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Money & Earnings (selected range)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MoneyCard label="Total Revenue" value={formatCurrency(metrics?.total_revenue ?? 0)} icon={TrendingUp} color="#7C3AED" loading={analyticsLoading}
            info="Gross bill amount (GMV) of all captured transactions in the selected range." />
          <MoneyCard label="Total Transactions" value={metrics?.total_transactions ?? 0} icon={CreditCard} color="#2563EB" loading={analyticsLoading}
            info="Number of captured payments in the selected range." />
          <MoneyCard label="Merchant Revenue" value={formatCurrency(metrics?.merchant_revenue ?? 0)} icon={StoreIcon} color="#16A34A" loading={analyticsLoading}
            info="Net amount merchants receive after all deductions (customer discount, referral, chain, NAMCOS fee)." />
          <MoneyCard label="NAMCOS Revenue" value={formatCurrency(metrics?.namcos_revenue ?? 0)} icon={Landmark} color="#0F4C3A" loading={analyticsLoading}
            info="NAMCOS platform earnings (the per-store NAMCOS fee %)." />
          <MoneyCard label="User Referral Revenue" value={formatCurrency(metrics?.referral_revenue ?? 0)} icon={Users2} color="#2563EB" loading={analyticsLoading}
            info="Total direct referral bonuses paid to referrers when their referred users purchased." />
          <MoneyCard label="Chain Total Revenue" value={formatCurrency(metrics?.chain_revenue ?? 0)} icon={Link2} color="#7C3AED" loading={analyticsLoading}
            info="Total chain bonuses distributed up the multi-level referral chain." />
          <MoneyCard label="Customer Discounts" value={formatCurrency(metrics?.customer_discount ?? 0)} icon={CreditCard} color="#EA580C" loading={analyticsLoading}
            info="Total discounts given to customers across all purchases." />
          <MoneyCard label="Total % Revenue" value={formatCurrency(metrics?.total_percentage_revenue ?? 0)} icon={TrendingUp} color="#DB2777" loading={analyticsLoading}
            info="Sum of all percentage-based allocations: customer discount + referral + chain + NAMCOS fee." />
          <MoneyCard label="Merchant Valid Balance (DMB)" value={formatCurrency(metrics?.merchant_valid_balance ?? 0)} icon={StoreIcon} color="#0F4C3A" loading={analyticsLoading}
            info="DMB = Due Merchant Balance. Total merchant settlement balance that is available and still withdrawable (i.e. valid balance remaining after withdrawals). All-time figure." />
          <MoneyCard label="User Wallet Balance" value={formatCurrency(metrics?.user_wallet_balance ?? 0)} icon={Wallet} color="#0891B2" loading={analyticsLoading}
            info="Total balance currently held across all user wallets. All-time figure." />
          <MoneyCard label="Withdrawal Processed" value={formatCurrency(metrics?.withdrawal_processed ?? 0)} icon={CheckCircle} color="#16A34A" loading={analyticsLoading}
            info="Total amount of withdrawals marked as paid in the selected range." />
          <MoneyCard label="Withdrawal Pending" value={formatCurrency(metrics?.withdrawal_pending ?? 0)} icon={Clock} color="#F59E0B" loading={analyticsLoading}
            info="Total amount of withdrawal requests awaiting processing (all-time)." />
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-800">Recent transactions</h2>
          <span className="text-xs text-slate-400 ml-auto">
            {analytics?.range?.preset ? `Preset: ${analytics.range.preset}` : ''}
          </span>
        </div>
        {analyticsLoading ? (
          <div className="h-32 skeleton rounded-xl bg-slate-50" />
        ) : !analytics?.recent_transactions?.length ? (
          <p className="text-sm text-slate-400 py-8 text-center">No transactions in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="text-left py-2 font-semibold">Date</th>
                  <th className="text-left py-2 font-semibold">Txn ID</th>
                  <th className="text-left py-2 font-semibold">Merchant</th>
                  <th className="text-right py-2 font-semibold">Amount</th>
                  <th className="text-right py-2 font-semibold">Fee</th>
                  <th className="text-right py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.recent_transactions.map((t, i) => (
                  <tr key={t.id || i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2.5 text-slate-500 text-xs">{formatDateTime(t.created_at)}</td>
                    <td className="py-2.5 text-slate-800 font-mono text-xs">{(t.transaction_id || '').slice(0, 14)}…</td>
                    <td className="py-2.5 text-slate-700 text-xs">{t.merchant_id?.slice(0, 8) || '—'}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(t.gross_amount || 0)}</td>
                    <td className="py-2.5 text-right text-slate-500">{formatCurrency(t.platform_fee || 0)}</td>
                    <td className="py-2.5 text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
