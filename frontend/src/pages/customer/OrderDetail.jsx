import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Store, Clock, Receipt, Wallet, CreditCard } from 'lucide-react';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import api from '@/utils/api';
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '@/utils/format';
import { toast } from 'sonner';

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/orders/${orderId}`)
      .then(r => setOrder(r.data))
      .catch(() => { toast.error('Order not found'); navigate('/customer/orders'); })
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <PageLoader />;
  if (!order) return null;

  const paid = order.payment_status === 'paid';
  const PaidIcon = order.paid_via === 'wallet' ? Wallet : CreditCard;

  return (
    <div className="pb-24 animate-fade-in bg-slate-50 min-h-screen" data-testid="order-detail-page">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button data-testid="order-back-btn"
            onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/customer/orders')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-base font-extrabold text-slate-900 flex-1 truncate">Order #{order.order_number}</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status banner */}
        <div className={`rounded-3xl p-6 text-center ${paid ? 'bg-gradient-to-b from-[#0F4C3A] to-[#0d4032]' : 'bg-white border border-slate-100'}`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${paid ? 'bg-white/10' : 'bg-amber-50'}`}>
            {paid ? <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={1.5} /> : <Clock className="w-8 h-8 text-amber-500" />}
          </div>
          <p className={`text-xs font-medium uppercase tracking-widest mb-1 ${paid ? 'text-white/70' : 'text-slate-400'}`}>
            {paid ? 'Payment Successful' : 'Payment Pending'}
          </p>
          <p className={`text-4xl font-bold ${paid ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(order.final_amount)}</p>
        </div>

        {/* Store */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F4C3A]/10 flex items-center justify-center">
            <Store className="w-5 h-5 text-[#0F4C3A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{order.store_name}</p>
            <p className="text-xs text-slate-400">Merchant</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(order.fulfillment_status)}`}>
            {getStatusLabel(order.fulfillment_status)}
          </span>
        </div>

        {/* Items */}
        {order.items?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Items
            </p>
            <div className="space-y-2.5">
              {order.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-700">{it.product_name} × {it.quantity}</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(it.unit_price * it.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bill breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2.5 text-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bill Details</p>
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="text-slate-800">{formatCurrency(order.subtotal ?? order.gross_amount)}</span></div>
          {order.delivery_fee > 0 && <div className="flex justify-between"><span className="text-slate-500">Delivery</span><span className="text-slate-800">{formatCurrency(order.delivery_fee)}</span></div>}
          {order.discount_amount > 0 && <div className="flex justify-between text-green-600"><span>NAMCOS discount</span><span>-{formatCurrency(order.discount_amount)}</span></div>}
          <div className="flex justify-between border-t border-slate-100 pt-2.5 text-base font-bold"><span className="text-slate-800">Total Paid</span><span className="text-[#0F4C3A]">{formatCurrency(order.final_amount)}</span></div>
        </div>

        {/* Payment meta */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2.5 text-sm">
          <div className="flex justify-between items-center"><span className="text-slate-500">Payment mode</span>
            <span className="flex items-center gap-1.5 font-semibold text-slate-800 capitalize"><PaidIcon className="w-4 h-4" />{order.paid_via || (paid ? 'Razorpay' : '—')}</span></div>
          {order.payment_id && <div className="flex justify-between"><span className="text-slate-500">Transaction ID</span><span className="font-mono text-xs text-slate-600">{order.payment_id}</span></div>}
          <div className="flex justify-between"><span className="text-slate-500">Order date</span><span className="text-slate-600">{formatDateTime(order.created_at)}</span></div>
          {order.notes && <div className="flex justify-between"><span className="text-slate-500">Note</span><span className="text-slate-600 text-right max-w-[60%]">{order.notes}</span></div>}
        </div>
      </div>
    </div>
  );
}
