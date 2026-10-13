import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, ShoppingBag, Wallet, User, Package } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { CUSTOMER } from '@/constants/testIds';

const NAV_ITEMS = [
  { to: '/customer', label: 'Home', icon: Home, testId: CUSTOMER.navHome, end: true },
  { to: '/customer/explore', label: 'Explore', icon: Search, testId: CUSTOMER.navExplore },
  { to: '/customer/my-listings', label: 'My Listings', icon: Package, testId: 'nav-my-listings' },
  { to: '/customer/wallet', label: 'Wallet', icon: Wallet, testId: CUSTOMER.navWallet },
  { to: '/customer/profile', label: 'Profile', icon: User, testId: CUSTOMER.navProfile },
];

export default function BottomNav() {
  const { count } = useCart();

  return (
    <nav data-testid={CUSTOMER.bottomNav}
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-slate-100 shadow-bottom-nav z-50">
      <div className="flex items-center justify-around py-1 px-2 safe-area-pb">
        {NAV_ITEMS.map(({ to, label, icon: Icon, testId, end }) => (
          <NavLink key={to} to={to} end={end} data-testid={testId}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all min-w-[56px] ${
                isActive ? 'text-[#0F4C3A]' : 'text-slate-400 hover:text-slate-600'
              }`}>
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-all ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                  {label === 'Orders' && count > 0 && (
                    <span data-testid={CUSTOMER.cartBadge}
                      className="absolute -top-1.5 -right-1.5 bg-[#0F4C3A] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
