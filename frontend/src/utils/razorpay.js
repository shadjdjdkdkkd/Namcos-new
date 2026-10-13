/**
 * Razorpay checkout launcher. Loads the SDK on demand, then opens the checkout.
 * Resolves with the verified backend response on success, rejects on cancel/failure.
 */
import api from '@/utils/api';

let _sdkLoad = null;

function loadSdk() {
  if (window.Razorpay) return Promise.resolve();
  if (_sdkLoad) return _sdkLoad;
  _sdkLoad = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(s);
  });
  return _sdkLoad;
}

export async function payAtStoreWithRazorpay({ storeId, amount, notes }) {
  await loadSdk();
  const { data: order } = await api.post('/razorpay/order', {
    store_id: storeId,
    amount,
    notes,
  });

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'NAMCOS',
      description: `Pay at ${order.store_name}`,
      order_id: order.razorpay_order_id,
      prefill: {
        name: order.customer_name || '',
        contact: order.customer_phone || '',
      },
      notes: { order_id: order.order_id },
      theme: { color: '#0F4C3A' },
      handler: async (resp) => {
        try {
          const { data } = await api.post('/razorpay/verify', {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
            order_id: order.order_id,
          });
          resolve({ ...data, order });
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'Payment failed')));
    rzp.open();
  });
}


export async function topupWalletWithRazorpay({ amount }) {
  await loadSdk();
  const { data: order } = await api.post('/razorpay/wallet-topup/order', { amount });

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'NAMCOS Wallet',
      description: `Add ₹${amount} to your wallet`,
      order_id: order.razorpay_order_id,
      prefill: {
        name: order.customer_name || '',
        contact: order.customer_phone || '',
      },
      theme: { color: '#0F4C3A' },
      handler: async (resp) => {
        try {
          const { data } = await api.post('/razorpay/wallet-topup/verify', {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
            topup_id: order.topup_id,
          });
          resolve(data);
        } catch (e) { reject(e); }
      },
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r?.error?.description || 'Payment failed')));
    rzp.open();
  });
}
