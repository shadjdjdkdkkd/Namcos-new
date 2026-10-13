import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';

export default function CustomerAddresses() {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();
  const [addr, setAddr] = useState({ address: '', locality: '', city: '', state: '', pincode: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAddr({
      address: user?.address || '', locality: user?.locality || '',
      city: user?.city || '', state: user?.state || '', pincode: user?.pincode || '',
    });
  }, [user]);

  const save = async () => {
    if (!addr.locality.trim() || !addr.city.trim()) { toast.error('Locality and city are required'); return; }
    setSaving(true);
    try {
      await api.put('/auth/profile', addr);
      await checkAuth?.();
      toast.success('Address saved');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not save'); }
    finally { setSaving(false); }
  };

  const hasSaved = user?.locality || user?.city;

  const fields = [
    { label: 'Flat / House / Street', k: 'address', placeholder: 'House no, street, landmark' },
    { label: 'Locality / Area *', k: 'locality', placeholder: 'e.g. Calicut Beach' },
    { label: 'City *', k: 'city', placeholder: 'e.g. Kozhikode' },
    { label: 'State', k: 'state', placeholder: 'e.g. Kerala' },
    { label: 'Pincode', k: 'pincode', placeholder: '673001' },
  ];

  return (
    <div className="pb-24 min-h-screen bg-slate-50 animate-fade-in">
      <header className="sticky top-0 z-20 bg-[#0F4C3A] px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/customer/profile')} data-testid="address-back-btn" className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white flex-1">Saved Address</h1>
      </header>

      <div className="p-4">
        {hasSaved && (
          <div className="mb-4 flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4" data-testid="address-current">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0"><MapPin className="w-4 h-4 text-emerald-600" /></div>
            <div className="text-sm text-slate-700">
              <p className="font-semibold text-slate-800 flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-600" /> Current Address</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {[user?.address, user?.locality, user?.city, user?.state, user?.pincode].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        )}

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3" data-testid="address-form">
          {fields.map(({ label, k, placeholder }) => (
            <div key={k}>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
              <input value={addr[k]} data-testid={`address-${k}-input`} placeholder={placeholder}
                onChange={e => setAddr(a => ({ ...a, [k]: e.target.value }))}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4C3A]" />
            </div>
          ))}
          <Button onClick={save} disabled={saving} data-testid="address-save-btn"
            className="w-full h-11 bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-bold rounded-2xl">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Save Address'}
          </Button>
        </section>
      </div>
    </div>
  );
}
