import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Landmark, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import PayoutFields, { useSavedPayout, validatePayout, payoutPayload } from '@/components/shared/PayoutFields';

export default function CustomerSettings() {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const { payout, setPayout, method, setMethod } = useSavedPayout();
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => { setName(user?.name || ''); }, [user]);

  const saveName = async () => {
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSavingName(true);
    try {
      await api.put('/auth/profile', { name: name.trim() });
      await checkAuth?.();
      toast.success('Profile updated');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not save'); }
    finally { setSavingName(false); }
  };

  const saveBank = async () => {
    const err = validatePayout(payout, method);
    if (err) { toast.error(err); return; }
    setSavingBank(true);
    try {
      await api.put('/my/payout-details', payoutPayload(payout, method));
      toast.success('Bank / UPI details saved');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not save'); }
    finally { setSavingBank(false); }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 animate-fade-in">
      <header className="sticky top-0 z-20 bg-[#0F4C3A] px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/customer/profile')} data-testid="settings-back-btn" className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white flex-1">Settings</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Profile */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <UserIcon className="w-4 h-4 text-[#0F4C3A]" />
            <h2 className="text-sm font-bold text-slate-800">Profile</h2>
          </div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Full Name</label>
          <input value={name} data-testid="settings-name-input" onChange={e => setName(e.target.value)}
            className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm mb-2 focus:outline-none focus:border-[#0F4C3A]" />
          <p className="text-[10px] text-slate-400 mb-3">Phone: {user?.phone}</p>
          <Button onClick={saveName} disabled={savingName} data-testid="settings-save-name-btn"
            className="w-full h-11 bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-bold rounded-2xl">
            {savingName ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Save Profile'}
          </Button>
        </section>

        {/* Bank Account */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5" data-testid="settings-bank-section">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-4 h-4 text-[#0F4C3A]" />
            <h2 className="text-sm font-bold text-slate-800">Bank Account for Payouts</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">Saved details are auto-filled when you request a withdrawal.</p>
          <PayoutFields payout={payout} setPayout={setPayout} method={method} setMethod={setMethod} />
          <Button onClick={saveBank} disabled={savingBank} data-testid="settings-save-bank-btn"
            className="mt-4 w-full h-11 bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-bold rounded-2xl">
            {savingBank ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Save Bank Details'}
          </Button>
        </section>
      </div>
    </div>
  );
}
