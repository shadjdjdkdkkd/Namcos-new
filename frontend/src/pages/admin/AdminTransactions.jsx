import { appName } from '@/lib/brand';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, Store as StoreIcon, Landmark, Users, Link2, Wallet, Banknote, Filter,
} from 'lucide-react';
import api from '@/utils/api';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import Pagination from '@/components/shared/Pagination';

const GROUPS = [
  { key: 'customer', label: 'Customer Discounts', icon: ShoppingBag, color: '#EA580C' },
  { key: 'merchant', label: 'Merchant Earnings', icon: StoreIcon, color: '#16A34A' },
  { key: 'namcos', label: `${appName()} Earnings`, icon: Landmark, color: '#0F4C3A' },
  { key: 'referral', label: 'Referral Earnings', icon: Users, color: '#2563EB' },
  { key: 'chain', label: 'Chain Earnings', icon: Link2, color: '#7C3AED' },
  { key: 'wallet', label: 'Wallet Top-ups', icon: Wallet, color: '#0891B2' },
  { key: 'withdrawal', label: 'Withdrawals', icon: Banknote, color: '#DC2626' },
];
const LIMIT = 25;

export default function AdminTransactions() {
  const [summary, setSummary] = useState({});
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { skip: (page - 1) * LIMIT, limit: LIMIT };
    if (group) params.group = group;
    if (month) params.month = month;
    try {
      const { data } = await api.get('/admin/transactions', { params });
      setSummary(data.summary || {});
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch { setItems([]); }
    setLoading(false);
  }, [group, month, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div data-testid="admin-transactions" className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Every money flow across the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <input type="month" value={month} data-testid="txn-month"
            onChange={e => { setMonth(e.target.value); setPage(1); }}
            className="h-9 px-3 border border-slate-200 rounded-xl text-sm bg-white" />
          {month && <button onClick={() => { setMonth(''); setPage(1); }}
            className="text-xs text-slate-500 hover:text-[#0F4C3A]">Clear</button>}
        </div>
      </div>

      {/* Group summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {GROUPS.map(({ key, label, icon: Icon, color }) => {
          const s = summary[key] || { total: 0, count: 0 };
          const active = group === key;
          return (
            <button key={key} data-testid={`txn-group-${key}`}
              onClick={() => { setGroup(active ? '' : key); setPage(1); }}
              className={`text-left bg-white rounded-2xl border p-4 transition-all ${active ? 'border-[#0F4C3A] ring-2 ring-[#0F4C3A]/20' : 'border-slate-200 hover:shadow-md'}`}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${color}18` }}>
                <Icon className="w-4.5 h-4.5" style={{ color }} />
              </div>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(s.total)}</p>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{s.count} txns</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
          {group ? GROUPS.find(g => g.key === group)?.label : 'All transactions'}
        </h2>
        {group && <button onClick={() => { setGroup(''); setPage(1); }} className="text-xs text-[#0F4C3A] hover:underline">Show all</button>}
      </div>

      {loading ? <SkeletonList count={6} /> :
        items.length === 0 ? <EmptyState title="No transactions" description="Nothing recorded for this filter yet." /> : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Beneficiary</th>
                  <th className="text-left px-4 py-3">Store</th>
                  <th className="text-right px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t, i) => {
                  const g = GROUPS.find(x => x.key === t.txn_group);
                  return (
                    <tr key={t.id || i} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(t.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${g?.color || '#64748b'}18`, color: g?.color || '#64748b' }}>
                          {(t.txn_type || t.txn_group || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{t.user_name || t.buyer_name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{t.store_name || '—'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${t.direction === 'debit' ? 'text-red-600' : 'text-slate-900'}`}>
                        {t.direction === 'debit' ? '-' : ''}{formatCurrency(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-100">
              <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} onPageChange={setPage} loading={loading} />
            </div>
          </div>
        )}
    </div>
  );
}
