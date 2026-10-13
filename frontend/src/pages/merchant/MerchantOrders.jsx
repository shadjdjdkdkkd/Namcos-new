import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Truck, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/utils/format';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import { MERCHANT } from '@/constants/testIds';

const ORDER_STATUSES = ['created','confirmed','preparing','ready','out_for_delivery','delivered','cancelled'];

export default function MerchantOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const TABS = [
    { value: 'all', label: 'All' },
    { value: 'confirmed', label: 'Active' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  useEffect(() => { fetchOrders(); }, [activeTab]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      const { data } = await api.get('/merchant/orders', { params });
      setOrders(data);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await api.put(`/orders/${orderId}/status`, { fulfillment_status: status });
      toast.success(`Order updated to ${getStatusLabel(status)}`);
      fetchOrders();
      setSelectedOrder(null);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500">{orders.length} orders</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              activeTab === tab.value ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <SkeletonList count={4} /> :
        orders.length === 0 ? (
          <EmptyState type="orders" title="No orders" description={activeTab === 'all' ? 'No orders received yet' : `No ${activeTab} orders`} />
        ) : (
          <div data-testid={MERCHANT.ordersTable} className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Order', 'Customer', 'Items', 'Amount', 'Status', 'Date', 'Action'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-[#0F4C3A]">#{order.order_number}</p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{order.customer_name || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{order.items?.length || 0} item(s)</td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(order.final_amount)}</p>
                      {order.discount_amount > 0 && <p className="text-xs text-green-600">-{formatCurrency(order.discount_amount)}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(order.fulfillment_status)}`}>
                        {getStatusLabel(order.fulfillment_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => setSelectedOrder(order)}
                        className="text-xs px-3 py-1.5 bg-[#0F4C3A]/10 text-[#0F4C3A] rounded-lg hover:bg-[#0F4C3A]/20 transition-colors font-medium">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Order #{selectedOrder.order_number}</h3>
                <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <span className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(selectedOrder.fulfillment_status)}`}>
                  {getStatusLabel(selectedOrder.fulfillment_status)}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                {selectedOrder.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-700">{item.product_name} × {item.quantity}</span>
                    <span className="font-medium text-slate-800">{formatCurrency(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800">
                  <span>Total</span>
                  <span>{formatCurrency(selectedOrder.final_amount)}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUSES.filter(s => s !== selectedOrder.fulfillment_status).slice(0, 4).map(status => (
                    <button key={status} onClick={() => updateStatus(selectedOrder.id, status)}
                      className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${getStatusColor(status)} hover:opacity-80`}>
                      → {getStatusLabel(status)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
