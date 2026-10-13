import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Phone, Settings, Store, Leaf, Wrench, Tag, ChevronRight, LogOut, Bell, HelpCircle, Gift, Copy, Share2, Link2, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import { formatPhone, formatDate, formatCurrency } from '@/utils/format';

export default function CustomerProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [ref, setRef] = useState(null);

  useEffect(() => { api.get('/referrals/me').then(r => setRef(r.data)).catch(() => {}); }, []);

  const copyCode = () => {
    if (ref?.referral_code) {
      navigator.clipboard?.writeText(ref.referral_code);
      toast.success('Referral code copied!');
    }
  };

  const shareInvite = async () => {
    const code = ref?.referral_code || '';
    const msg = `Join me on NAMCOS — shop local & save! Use my referral code ${code} when you sign up. https://namcos.app`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join NAMCOS', text: msg });
      } else {
        navigator.clipboard?.writeText(msg);
        toast.success('Invite message copied — share it anywhere!');
      }
    } catch { /* user cancelled share */ }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
  };

  const SELL_OPTIONS = [
    { icon: Store, label: 'List My Store', desc: 'Register your business', color: '#0F4C3A', path: '/customer/register-merchant?type=store' },
    { icon: Leaf, label: 'Sell Agriculture', desc: 'Fresh produce, crops', color: '#16A34A', path: '/customer/register-merchant?type=agriculture' },
    { icon: Wrench, label: 'Offer a Service', desc: 'Electrician, plumber, etc.', color: '#2563EB', path: '/customer/register-merchant?type=service' },
    { icon: Tag, label: 'Post Classified', desc: 'Buy/sell anything', color: '#7C3AED', path: '/customer/register-merchant?type=classified' },
  ];

  return (
    <div className="pb-24 animate-fade-in">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-[#0F4C3A] to-[#1a6b55] px-4 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
            {user?.profile_photo ? (
              <img src={user.profile_photo} alt={user.name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <User className="w-8 h-8 text-white" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{user?.name || 'User'}</h1>
            <p className="text-sm text-white/70">{formatPhone(user?.phone) || user?.email}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {user?.roles?.map(role => (
                <span key={role} className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full capitalize">
                  {role.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-white/50 mt-3">Member since {formatDate(user?.created_at)}</p>
      </div>

      {/* Invite & Earn Card */}
      <section className="px-4 pt-5">
        <div data-testid="referral-card" className="rounded-2xl bg-gradient-to-br from-[#0F4C3A] to-[#1a6b55] p-5 text-white shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-300" />
              <h2 className="text-sm font-bold">Invite &amp; Earn</h2>
            </div>
            <span className="text-[10px] bg-amber-300/20 text-amber-200 font-bold px-2 py-0.5 rounded-full">LIVE EARNINGS</span>
          </div>
          <p className="text-xs text-white/70 mb-3">Share your code. Earn a direct bonus when a friend pays — plus a chain bonus when their friends pay too.</p>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl p-3 mb-3">
            <span data-testid="referral-code" className="flex-1 text-lg font-black tracking-widest">{ref?.referral_code || '—'}</span>
            <button onClick={copyCode} data-testid="copy-referral-btn" className="flex items-center gap-1 bg-white/90 text-[#0F4C3A] text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition">
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button onClick={shareInvite} data-testid="share-referral-btn" className="flex items-center gap-1 bg-amber-400 text-[#0F4C3A] text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition">
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-2">
            <div className="bg-white/10 rounded-xl py-2.5">
              <p className="text-lg font-bold flex items-center justify-center gap-1"><UsersIcon className="w-3.5 h-3.5 text-white/60" />{ref?.referred_count ?? 0}</p>
              <p className="text-[10px] text-white/60">Referred</p>
            </div>
            <div className="bg-white/10 rounded-xl py-2.5">
              <p className="text-lg font-bold text-amber-300" data-testid="referral-direct-earnings">{formatCurrency(ref?.direct_earnings ?? 0)}</p>
              <p className="text-[10px] text-white/60">Direct Bonus</p>
            </div>
            <div className="bg-white/10 rounded-xl py-2.5">
              <p className="text-lg font-bold text-amber-300 flex items-center justify-center gap-1" data-testid="referral-chain-earnings"><Link2 className="w-3.5 h-3.5 text-white/60" />{formatCurrency(ref?.chain_earnings ?? 0)}</p>
              <p className="text-[10px] text-white/60">Chain Bonus</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-xl py-2.5 text-center">
            <p className="text-xl font-black text-amber-300" data-testid="referral-total-earnings">{formatCurrency(ref?.total_earnings ?? 0)}</p>
            <p className="text-[10px] text-white/60">Total Earned (credited to your wallet)</p>
          </div>
        </div>
      </section>

      {/* Merchant Dashboard — one click */}
      <section className="px-4 pt-5">
        <button onClick={() => navigate('/merchant')} data-testid="open-merchant-dashboard-btn"
          className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-card-hover transition-all active:scale-95">
          <div className="w-10 h-10 rounded-xl bg-[#0F4C3A]/10 flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5 text-[#0F4C3A]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-slate-800">Merchant Dashboard</p>
            <p className="text-[11px] text-slate-500">Manage your business, orders, payments &amp; withdrawals</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
      </section>

      {/* Start Selling */}
      <section className="px-4 pt-5">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Start Selling / Providing</h2>
        <div className="grid grid-cols-2 gap-2">
          {SELL_OPTIONS.map(({ icon: Icon, label, desc, color, path }) => (
            <button key={label} onClick={() => navigate(path)} data-testid={`profile-sell-${path.split('=')[1]}`}
              className="flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-card-hover transition-all text-left active:scale-95">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}12` }}>
                <Icon className="w-4.5 h-4.5" style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Settings Menu */}
      <section className="px-4 pt-5">
        <h2 className="text-sm font-bold text-slate-700 mb-2">Account</h2>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          {[
            { icon: MapPin, label: 'Saved Addresses', path: '/customer/profile/addresses' },
            { icon: Bell, label: 'Notifications', path: '/customer/profile/notifications' },
            { icon: HelpCircle, label: 'Help & Support', path: '/customer/profile/support' },
            { icon: Settings, label: 'Settings', path: '/customer/profile/settings' },
          ].map(({ icon: Icon, label, path }, i, arr) => (
            <button key={label} onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <Icon className="w-4.5 h-4.5 text-slate-400" />
              <span className="text-sm text-slate-700 flex-1 text-left">{label}</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>
      </section>

      {/* Logout */}
      <div className="px-4 pt-4">
        {showConfirmLogout ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-red-700 mb-3">Are you sure you want to logout?</p>
            <div className="flex gap-2">
              <Button onClick={handleLogout} variant="destructive" size="sm" className="flex-1 rounded-xl">Logout</Button>
              <Button onClick={() => setShowConfirmLogout(false)} variant="outline" size="sm" className="flex-1 rounded-xl">Cancel</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowConfirmLogout(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 text-red-500 hover:text-red-600 text-sm font-medium transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        )}
      </div>
    </div>
  );
}
