import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Package, ChevronRight, CheckCircle, Clock, Truck, XCircle } from 'lucide-react';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import api from '@/utils/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/utils/format';
import { ORDER } from '@/constants/testIds';

const STATUS_ICONS = {
  delivered: CheckCircle, confirmed: CheckCircle,
  out_for_delivery: Truck, preparing: Clock,
  created: Clock, cancelled: XCircle, refunded: XCircle,
};

export default function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const TABS = [
    { value: 'all', label: 'All' },
    { value: 'confirmed', label: 'Active' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const params = activeTab !== 'all' ? { status: activeTab } : {};
        const { data } = await api.get('/orders/my', { params });
        setOrders(data);
      } catch { setOrders([]); }
      finally { setLoading(false); }
    };
    fetchOrders();
  }, [activeTab]);

  return (
    <div className="pb-24 animate-fade-in">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold text-slate-900 mb-3">My Orders</h1>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeTab === tab.value ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white text-slate-600 border-slate-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div data-testid={ORDER.ordersContainer} className="px-4 pt-4 space-y-3">
        {loading ? <SkeletonList count={4} /> :
          orders.length === 0 ? (
            <EmptyState type="orders" title="No orders yet"
              description={activeTab === 'all' ? "You haven't placed any orders yet" : `No ${activeTab} orders`}
              action={() => {}} actionLabel="Browse Shops" />
          ) : orders.map(order => <OrderCard key={order.id} order={order} />)
        }
      </div>
    </div>
  );
}

function OrderCard({ order }) {
  const Icon = STATUS_ICONS[order.fulfillment_status] || Clock;
  return (
    <Link to={`/customer/orders/${order.id}`} data-testid={ORDER.orderCard}
      className="block bg-white rounded-2xl border border-slate-100 shadow-card p-4 hover:shadow-card-hover transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">#{order.order_number}</p>
          <p className="text-sm font-semibold text-slate-800 mt-0.5">{order.store_name}</p>
        </div>
        <span data-testid={ORDER.orderStatus}
          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getStatusColor(order.fulfillment_status)}`}>
          {getStatusLabel(order.fulfillment_status)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <Package className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-500">
          {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-[#0F4C3A]">{formatCurrency(order.final_amount)}</span>
        <span className="text-xs text-slate-400">{formatDate(order.created_at)}</span>
      </div>
      {order.discount_amount > 0 && (
        <p className="text-xs text-green-600 mt-1">Saved {formatCurrency(order.discount_amount)} with NAMCOS offer</p>
      )}
    </Link>
  );
}
