import React, { useState, useEffect } from 'react';
import { Search, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import api from '@/utils/api';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '@/utils/format';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import Pagination from '@/components/shared/Pagination';
import { ADMIN } from '@/constants/testIds';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'captured', label: 'Captured' },
  { value: 'initiated', label: 'Initiated' },
  { value: 'failed', label: 'Failed' },
];

const LIMIT = 20;

export default function AdminOrders() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = { skip: (page - 1) * LIMIT, limit: LIMIT };
    if (statusFilter) params.status = statusFilter;
    api.get('/admin/payments', { params })
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : r.data.items || [];
        setPayments(list);
        setTotal(r.data.total || list.length);
      })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  return (
    <div data-testid={ADMIN.transactionsTable} className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <p className="text-sm text-slate-500 mt-0.5">All platform payments & settlements</p>
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

      {loading ? <SkeletonList count={6} /> :
        payments.length === 0 ? (
          <EmptyState type="orders" title="No transactions found" description="Transactions will appear here once payments are made" />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Transaction ID', 'Store', 'Customer', 'Amount', 'Platform Fee', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#0F4C3A]/8 flex items-center justify-center">
                          <CreditCard className="w-3.5 h-3.5 text-[#0F4C3A]" />
                        </div>
                        <span className="text-xs font-mono text-slate-600">{p.transaction_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{p.store_name || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 font-mono text-xs">{p.customer_id?.slice(-8)}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(p.gross_amount)}</p>
                      {p.discount_amount > 0 && (
                        <p className="text-xs text-green-600">-{formatCurrency(p.discount_amount)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#0F4C3A] font-semibold">{formatCurrency(p.platform_fee)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{formatDateTime(p.created_at)}</td>
                  </tr>
                ))}
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
