import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, Megaphone, CreditCard, Gift, Wallet as WalletIcon, LifeBuoy } from 'lucide-react';
import api from '@/utils/api';
import { formatRelativeTime } from '@/utils/format';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';

const ICONS = {
  announcement: Megaphone, payment: CreditCard, referral: Gift,
  wallet: WalletIcon, withdrawal: WalletIcon, support: LifeBuoy, default: Bell,
};

export default function CustomerNotifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get('/notifications').then(({ data }) => setItems(data.notifications || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    setItems(items.map(n => ({ ...n, is_read: true })));
  };

  const openNotif = async (n) => {
    if (!n.is_read) {
      await api.put(`/notifications/${n.id}/read`).catch(() => {});
      setItems(items.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 animate-fade-in">
      <header className="sticky top-0 z-20 bg-[#0F4C3A] px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/customer/profile')} data-testid="notif-back-btn" className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white flex-1">Notifications</h1>
        <button onClick={markAllRead} data-testid="notif-mark-all-btn" className="flex items-center gap-1 text-xs text-white/80 hover:text-white">
          <CheckCheck className="w-4 h-4" /> Mark all read
        </button>
      </header>

      <div className="p-4">
        {loading ? <SkeletonList count={4} /> : items.length === 0 ? (
          <EmptyState type="orders" title="No notifications yet" description="Updates and announcements from NAMCOS will appear here" />
        ) : (
          <div className="space-y-2.5" data-testid="notif-list">
            {items.map(n => {
              const Icon = ICONS[n.type] || ICONS.default;
              return (
                <button key={n.id} onClick={() => openNotif(n)} data-testid={`notif-item-${n.id}`}
                  className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border shadow-sm transition-colors ${
                    n.is_read ? 'bg-white border-slate-100' : 'bg-emerald-50/60 border-emerald-100'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.is_read ? 'bg-slate-100' : 'bg-[#0F4C3A]/10'}`}>
                    <Icon className={`w-4 h-4 ${n.is_read ? 'text-slate-500' : 'text-[#0F4C3A]'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 flex-1">{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatRelativeTime(n.created_at)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
