import React, { useState } from 'react';
import { User, Lock, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminAccount() {
  const { user, checkAuth } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error('Enter a valid name'); return; }
    setSavingName(true);
    try {
      await api.put('/admin/profile', { name: name.trim() });
      toast.success('Name updated');
      checkAuth();
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingName(false);
  };

  const savePw = async (e) => {
    e.preventDefault();
    if (nw.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (nw !== confirm) { toast.error('Passwords do not match'); return; }
    setSavingPw(true);
    try {
      await api.post('/admin/change-password', { current_password: cur, new_password: nw });
      toast.success('Password changed');
      setCur(''); setNw(''); setConfirm('');
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingPw(false);
  };

  return (
    <div data-testid="admin-account" className="p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Account</h1>
        <p className="text-sm text-slate-500 mt-0.5">Update your display name and password</p>
      </div>

      <form onSubmit={saveName} className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-[#0F4C3A]" />
          <h2 className="font-semibold text-slate-800">Profile</h2>
        </div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Display Name</label>
        <div className="flex gap-2">
          <Input value={name} onChange={e => setName(e.target.value)} data-testid="account-name-input"
            className="rounded-xl border-slate-200 max-w-sm" />
          <Button type="submit" disabled={savingName} data-testid="account-name-save"
            className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl">
            {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Email: {user?.email}</p>
      </form>

      <form onSubmit={savePw} className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-[#0F4C3A]" />
          <h2 className="font-semibold text-slate-800">Change Password</h2>
        </div>
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Current Password</label>
            <Input type="password" value={cur} onChange={e => setCur(e.target.value)} data-testid="account-cur-pw" className="rounded-xl border-slate-200" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">New Password</label>
            <Input type="password" value={nw} onChange={e => setNw(e.target.value)} data-testid="account-new-pw" className="rounded-xl border-slate-200" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Confirm New Password</label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} data-testid="account-confirm-pw" className="rounded-xl border-slate-200" />
          </div>
          <Button type="submit" disabled={savingPw} data-testid="account-pw-save"
            className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl w-full">
            {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </Button>
        </div>
      </form>
    </div>
  );
}
