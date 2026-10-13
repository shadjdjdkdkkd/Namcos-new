import React, { useState, useEffect } from 'react';
import { TrendingUp, CreditCard, Clock, Banknote, ArrowUpRight } from 'lucide-react';
import api from '@/utils/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/utils/format';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import { MERCHANT } from '@/constants/testIds';

export default function MerchantPayments() {
  const [payments, setPayments] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('payments');

  useEffect(() => {
    Promise.all([
      api.get('/merchant/payments'),
      api.get('/merchant/balance'),
    ]).then(([pRes, bRes]) => {
      setPayments(pRes.data);
      setBalance(bRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">Track payments, settlements and revenue</p>
      </div>

      {/* Balance Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Received', value: balance?.total_received, icon: TrendingUp, color: '#0F4C3A' },
            { label: 'Available Balance', value: balance?.available_balance, icon: Banknote, color: '#16A34A', highlight: true },
            { label: 'Pending Settlement', value: balance?.pending_settlement, icon: Clock, color: '#F59E0B' },
            { label: 'Total Withdrawn', value: balance?.total_withdrawn, icon: ArrowUpRight, color: '#2563EB' },
          ].map(({ label, value, icon: Icon, color, highlight }) => (
            <div key={label} className={`rounded-2xl border shadow-card p-5 ${highlight ? 'bg-gradient-to-br from-[#0F4C3A] to-[#1a6b55] border-transparent' : 'bg-white border-slate-100'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3`}
                style={{ backgroundColor: highlight ? 'rgba(255,255,255,0.15)' : `${color}15` }}>
                <Icon className="w-4.5 h-4.5" style={{ color: highlight ? 'white' : color }} />
              </div>
              <p className={`text-xl font-bold ${highlight ? 'text-white' : 'text-slate-800'}`}>{formatCurrency(value || 0)}</p>
              <p className={`text-xs mt-0.5 ${highlight ? 'text-white/70' : 'text-slate-500'}`}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['payments', 'settlements'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all capitalize ${
              tab === t ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white text-slate-600 border-slate-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div> :
        payments.length === 0 ? (
          <EmptyState type="orders" title="No transactions yet" description="Payment transactions will appear here" />
        ) : (
          <div data-testid={MERCHANT.paymentsTable} className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Transaction ID', 'Customer', 'Bill', 'Customer Discount', 'NAMCOS Fee', 'You Get', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-mono text-slate-600">{p.transaction_id}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-slate-700">{p.customer_name || '—'}</p>
                      {p.customer_phone && <p className="text-xs text-slate-400 font-mono">{p.customer_phone}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{formatCurrency(p.gross_amount ?? p.net_paid)}</td>
                    <td className="px-4 py-3.5 text-sm text-amber-600">{p.discount_amount > 0 ? `-${formatCurrency(p.discount_amount)}` : '—'}{p.discount_percent > 0 ? <span className="text-[10px] text-slate-400 ml-1">({p.discount_percent}%)</span> : null}</td>
                    <td className="px-4 py-3.5 text-sm text-red-600">-{formatCurrency(p.namcos_earning ?? p.platform_fee)}{p.namcos_percent > 0 ? <span className="text-[10px] text-slate-400 ml-1">({p.namcos_percent}%)</span> : null}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-[#0F4C3A]">{formatCurrency(p.merchant_amount)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
