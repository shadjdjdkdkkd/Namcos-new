import React, { useState, useEffect } from 'react';
import { ShoppingBag, CreditCard, TrendingUp, Package, Clock, CheckCircle, AlertCircle, Banknote } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/utils/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/utils/format';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import { MERCHANT } from '@/constants/testIds';

const CHART_DATA = [
  { day: 'Mon', sales: 4200 }, { day: 'Tue', sales: 6800 }, { day: 'Wed', sales: 5200 },
  { day: 'Thu', sales: 8900 }, { day: 'Fri', sales: 7300 }, { day: 'Sat', sales: 12000 }, { day: 'Sun', sales: 9400 },
];

function StatCard({ label, value, icon: Icon, color, loading, sub }) {
  if (loading) return <div className="skeleton h-28 rounded-2xl" />;
  return (
    <div data-testid={MERCHANT.statsCard} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs font-medium mt-1" style={{ color }}>{sub}</p>}
    </div>
  );
}

export default function MerchantDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/merchant/dashboard/stats').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div data-testid={MERCHANT.dashboard} className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Welcome back! Here's your business overview.</p>
      </div>

      {/* Store status info */}
      {!loading && stats?.stores?.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">No approved store yet</p>
            <p className="text-xs text-amber-700 mt-0.5">Submit your store for review to start selling on NAMCOS.</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Orders" value={stats?.total_orders ?? 0} icon={ShoppingBag} color="#0F4C3A" loading={loading} sub={`${stats?.today_orders ?? 0} today`} />
        <StatCard label="Total Revenue" value={formatCurrency(stats?.total_received ?? 0)} icon={TrendingUp} color="#16A34A" loading={loading} />
        <StatCard label="Pending Orders" value={stats?.pending_orders ?? 0} icon={Clock} color="#F59E0B" loading={loading} />
        <StatCard label="Available Balance" value={formatCurrency(stats?.available_balance ?? 0)} icon={Banknote} color="#2563EB" loading={loading} sub={formatCurrency(stats?.pending_settlement ?? 0) + ' pending'} />
      </div>

      {/* Sales Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Weekly Sales</h2>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={CHART_DATA}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0F4C3A" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#0F4C3A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip formatter={(v) => [formatCurrency(v), 'Sales']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <Area type="monotone" dataKey="sales" stroke="#0F4C3A" strokeWidth={2} fill="url(#salesGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Recent Orders</h2>
        {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div> :
          !stats?.recent_orders?.length ? (
            <EmptyState type="orders" title="No orders yet" description="Your orders will appear here" />
          ) : (
            <div data-testid={MERCHANT.ordersTable} className="space-y-2">
              {stats.recent_orders.map(order => (
                <div key={order.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">#{order.order_number}</p>
                    <p className="text-xs text-slate-400">{order.customer_name} · {formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#0F4C3A]">{formatCurrency(order.final_amount)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(order.fulfillment_status)}`}>
                      {getStatusLabel(order.fulfillment_status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
