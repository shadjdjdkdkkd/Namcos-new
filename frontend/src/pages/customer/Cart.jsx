import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Trash2, Minus, Plus, Tag, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import EmptyState from '@/components/shared/EmptyState';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency } from '@/utils/format';
import { useCart } from '@/contexts/CartContext';
import { CART } from '@/constants/testIds';

export default function Cart() {
  const navigate = useNavigate();
  const { items, storeId, storeName, updateQuantity, removeItem, clearCart, total } = useCart();
  const [loading, setLoading] = useState(false);
  const [discount, setDiscount] = useState(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [address, setAddress] = useState({ line1: '', locality: '', city: '', pincode: '' });

  const fetchDiscount = async () => {
    if (!storeId) return;
    setDiscountLoading(true);
    try {
      const { data } = await api.get('/discounts/applicable', { params: { store_id: storeId, amount: total } });
      if (data.length > 0) setDiscount(data[0]);
      else setDiscount(null);
    } catch { }
    finally { setDiscountLoading(false); }
  };

  React.useEffect(() => { if (items.length > 0) fetchDiscount(); }, [total, storeId]);

  const discountAmount = discount?.calculated_discount || 0;
  const finalAmount = total - discountAmount;

  const handleCheckout = async () => {
    if (!address.line1 || !address.city) { toast.error('Please enter delivery address'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/orders', {
        store_id: storeId,
        items: items.map(i => ({
          product_id: i.product_id, product_name: i.product_name,
          quantity: i.quantity, unit_price: i.unit_price, image: i.image
        })),
        delivery_address: address,
        discount_rule_id: discount?.id || undefined,
      });

      // Initiate payment
      const payRes = await api.post('/payments/initiate', { order_id: data.order_id });
      const txnId = payRes.data.transaction_id;

      // Mock payment success
      await api.post('/payments/mock-success', { transaction_id: txnId });

      clearCart();
      toast.success('Order placed successfully!', { description: `Order #${data.order_number}` });
      navigate('/customer/orders');
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-50 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="font-bold text-slate-800">Cart</h1>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <EmptyState type="orders" title="Your cart is empty" description="Add items from a store to get started"
            action={() => navigate('/customer')} actionLabel="Browse Shops" />
        </div>
      </div>
    );
  }

  return (
    <div data-testid={CART.cartContainer} className="min-h-screen bg-slate-50 pb-24 animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-50 rounded-xl">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="font-bold text-slate-800">Cart</h1>
        <span className="text-sm text-slate-500 ml-1">from {storeName}</span>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Items */}
        {items.map(item => (
          <div key={item.product_id} data-testid={CART.cartItem}
            className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{item.product_name}</p>
              <p className="text-xs text-slate-500">{formatCurrency(item.unit_price)} × {item.quantity}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 rounded-full px-2 py-1">
                <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                  className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-600">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-bold text-slate-700 w-4 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                  className="w-5 h-5 bg-[#0F4C3A] rounded-full flex items-center justify-center shadow-sm text-white">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <p className="text-sm font-bold text-[#0F4C3A] w-16 text-right">
                {formatCurrency(item.unit_price * item.quantity)}
              </p>
              <button onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-500 ml-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Address */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Delivery Address</h3>
          <div className="space-y-2">
            <input type="text" placeholder="Street / House No." value={address.line1}
              onChange={e => setAddress(p => ({ ...p, line1: e.target.value }))}
              className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#0F4C3A]" />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Locality" value={address.locality}
                onChange={e => setAddress(p => ({ ...p, locality: e.target.value }))}
                className="h-10 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#0F4C3A]" />
              <input type="text" placeholder="City" value={address.city}
                onChange={e => setAddress(p => ({ ...p, city: e.target.value }))}
                className="h-10 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#0F4C3A]" />
            </div>
            <input type="text" placeholder="Pincode" value={address.pincode}
              onChange={e => setAddress(p => ({ ...p, pincode: e.target.value }))}
              className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:border-[#0F4C3A]" />
          </div>
        </div>

        {/* Bill Summary */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Bill Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal ({items.length} items)</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {discount && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> {discount.name}</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-slate-600">
              <span>Delivery Fee</span>
              <span className="text-green-600">FREE</span>
            </div>
            <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between font-bold text-slate-800">
              <span>Total</span>
              <span data-testid={CART.totalAmount}>{formatCurrency(finalAmount)}</span>
            </div>
          </div>
          {discount && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-2.5 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-700">NAMCOS Offer applied: Save {formatCurrency(discountAmount)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Checkout */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4">
        <Button data-testid={CART.checkoutBtn} onClick={handleCheckout} disabled={loading}
          className="w-full h-13 rounded-2xl bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-semibold shadow-lg py-4">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Pay {formatCurrency(finalAmount)} →
        </Button>
      </div>
    </div>
  );
}
