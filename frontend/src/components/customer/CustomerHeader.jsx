import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronDown, Wallet, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/format';
import { CUSTOMER } from '@/constants/testIds';
import LocationPicker from '@/components/shared/LocationPicker';

export default function CustomerHeader({ locality, onLocationChange, km, onKmChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [walletBalance, setWalletBalance] = useState(0);
  const [unread, setUnread] = useState(0);
  const [showLocModal, setShowLocModal] = useState(false);

  useEffect(() => {
    if (user) {
      api.get('/wallet/balance').then(r => setWalletBalance(r.data.balance ?? 0)).catch(() => setWalletBalance(0));
      api.get('/notifications').then(r => setUnread(r.data.unread_count || 0)).catch(() => {});
    }
  }, [user]);

  const handleSelect = (place) => {
    onLocationChange(place.locality || '');
    if (place.km && onKmChange) onKmChange(place.km);
    // stash coords for later distance queries
    if (place.lat && place.lng) {
      localStorage.setItem('namcos_coords', JSON.stringify({ lat: place.lat, lng: place.lng }));
    } else if (!place.locality) {
      localStorage.removeItem('namcos_coords');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          {/* Brand — compact */}
          <div className="flex flex-col leading-none flex-shrink-0">
            <span className="text-lg font-black text-[#0F4C3A] tracking-tight">NAMCOS</span>
            <span className="text-[9px] text-slate-400 font-semibold tracking-wide">Local Commerce Ecosystem</span>
          </div>

          {/* Right cluster: Location + Wallet + Bell (kept close together) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              data-testid={CUSTOMER.locationSelector}
              onClick={() => setShowLocModal(true)}
              className="flex items-center gap-1 max-w-[130px] bg-emerald-50 border border-emerald-100 rounded-full pl-2.5 pr-2 py-1.5 hover:border-[#0F4C3A]/40 transition-all"
            >
              <MapPin className="w-3.5 h-3.5 text-[#0F4C3A] flex-shrink-0" />
              <span className="text-[11px] font-bold text-[#0F4C3A] truncate">
                {locality || 'Set Location'}
              </span>
              <ChevronDown className="w-3 h-3 text-[#0F4C3A]/60 flex-shrink-0" />
            </button>

            <button
              onClick={() => navigate('/customer/wallet')}
              data-testid="wallet-btn"
              className="flex items-center gap-1 bg-[#0F4C3A]/8 rounded-full pl-2 pr-2.5 py-1.5 hover:bg-[#0F4C3A]/12 transition-colors"
            >
              <Wallet className="w-3.5 h-3.5 text-[#0F4C3A]" />
              <span className="text-[11px] font-bold text-[#0F4C3A]">{formatCurrency(walletBalance)}</span>
            </button>

            <button
              className="relative p-1.5 hover:bg-slate-50 rounded-full"
              onClick={() => navigate('/customer/orders')}
              data-testid="notifications-btn"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <LocationPicker
        open={showLocModal}
        onClose={() => setShowLocModal(false)}
        locality={locality}
        km={km}
        onSelect={handleSelect}
      />
    </>
  );
}
