import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Store, Package, ShoppingBag, CreditCard,
  Banknote, Settings, BarChart2, Menu, X, LogOut, Bell, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MERCHANT } from '@/constants/testIds';

const LOGO_URL = "https://customer-assets-gfyr7b9c.emergentagent.net/job_8644c173-92fb-4985-b9f0-9ff438711506/artifacts/73hc9mup_ChatGPT%20Image%20Sep%2028%2C%202026%2C%2010_40_54%20PM.webp";

const NAV_ITEMS = [
  { to: '/merchant', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/merchant/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/merchant/payments', label: 'Payments', icon: CreditCard },
  { to: '/merchant/withdrawals', label: 'Withdrawals', icon: Banknote },
  { to: '/merchant/settings', label: 'Settings', icon: Settings },
];

export default function MerchantLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-[#0B192C] transform transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
            <img src={LOGO_URL} alt="NAMCOS" className="h-8 w-8 object-contain" />
            <div>
              <p className="text-sm font-bold text-white">NAMCOS</p>
              <p className="text-[10px] text-white/50">Merchant Portal</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-white/50">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav */}
          <nav data-testid={MERCHANT.sidebar} className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User */}
          <div className="px-3 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-semibold">{(user?.name || 'M')[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-white/50 truncate">{user?.phone || user?.email}</p>
              </div>
            </div>
            <button onClick={logout}
              className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 text-xs transition-colors rounded-xl hover:bg-white/5">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 hover:bg-slate-50 rounded-lg">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1 lg:flex-none" />
          <div className="flex items-center gap-3">
            <button className="relative p-2 hover:bg-slate-50 rounded-lg text-slate-500">
              <Bell className="w-4.5 h-4.5" />
            </button>
            <button onClick={() => navigate('/customer')}
              className="text-xs text-slate-500 hover:text-[#0F4C3A] border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">
              Customer App
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
