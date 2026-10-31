import { appName, appLogo } from '@/lib/brand';
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Store, CreditCard, FileText,
  Banknote, Settings, Menu, X, LogOut, Bell, Grid3X3, Image, Phone, Plus, Layers, Briefcase, UserCog, Megaphone, LifeBuoy, Network
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ADMIN } from '@/constants/testIds';


const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }]
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/stores', label: 'Stores', icon: Store },
      { to: '/admin/listings', label: 'Listings', icon: FileText },
      { to: '/admin/categories', label: 'Categories', icon: Grid3X3 },
      { to: '/admin/subcategories', label: 'Subcategories', icon: Layers },
      { to: '/admin/business-types', label: 'Business Types', icon: Briefcase },
      { to: '/admin/add', label: 'Add Listing', icon: Plus },
      { to: '/admin/inquiries', label: 'Inquiries', icon: Phone },
    ]
  },
  {
    label: 'Finance',
    items: [
      { to: '/admin/transactions', label: 'Transactions', icon: CreditCard },
      { to: '/admin/withdrawals', label: 'Withdrawals', icon: Banknote },
      { to: '/admin/chain', label: 'Chain Earnings', icon: Network },
    ]
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/banners', label: 'Banners', icon: Image },
      { to: '/admin/notifications', label: 'Notifications', icon: Megaphone },
      { to: '/admin/support', label: 'Support Tickets', icon: LifeBuoy },
    ]
  },
  {
    label: 'System',
    items: [
      { to: '/admin/account', label: 'My Account', icon: UserCog },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ]
  },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        data-testid={ADMIN.sidebar}
        className={`fixed inset-y-0 left-0 z-50 w-56 bg-[#0F4C3A] flex flex-col transform transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-white/10 flex-shrink-0">
          <img src={appLogo()} alt={`${appName()}`} className="h-7 w-7 object-contain" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">{appName()}</p>
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Admin</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-3 mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} data-testid={`admin-nav-${to.split('/').pop()}`}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-white/12 text-white shadow-inner'
                          : 'text-white/55 hover:text-white hover:bg-white/6'
                      }`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="px-3 py-4 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/6 mb-1">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{(user?.name || 'A')[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Admin'}</p>
              <p className="text-[10px] text-white/40 truncate">{user?.email || user?.phone}</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-400/70 hover:text-red-300 text-xs rounded-xl hover:bg-white/5 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-50">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/admin/notifications')} data-testid="admin-topbar-bell" className="p-2 rounded-lg hover:bg-slate-50 text-slate-500">
              <Bell className="w-4.5 h-4.5" />
            </button>
            <button onClick={() => navigate('/customer')}
              className="text-xs text-slate-500 hover:text-[#0F4C3A] border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">
              Customer View
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
