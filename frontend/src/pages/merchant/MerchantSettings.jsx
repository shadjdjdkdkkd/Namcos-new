import React, { useState, useEffect } from 'react';
import { Store, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

export default function MerchantSettings() {
  const { user } = useAuth();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/merchant/stores').then(r => {
      setStores(r.data);
      if (r.data.length > 0) { setSelectedStore(r.data[0].id); setForm(r.data[0]); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!selectedStore) return;
    setSaving(true);
    try {
      await api.put(`/merchant/stores/${selectedStore}`, form);
      toast.success('Store settings saved');
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-6"><div className="skeleton h-40 rounded-2xl" /></div>;

  if (stores.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <Store className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-amber-800">No store found</p>
          <p className="text-sm text-amber-700 mt-1">Submit your store from the Customer App to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Store Settings</h1>
        <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {stores.length > 1 && (
        <div className="mb-5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 block">Select Store</label>
          <select value={selectedStore} onChange={e => { setSelectedStore(e.target.value); setForm(stores.find(s => s.id === e.target.value) || {}); }}
            className="h-10 border border-slate-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-[#0F4C3A]">
            {stores.map(s => <option key={s.id} value={s.id}>{s.business_name}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-5">
        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Store Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Business Name</label>
              <Input value={form.business_name || ''} onChange={e => set('business_name', e.target.value)} className="rounded-xl border-slate-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Business Type</label>
              <Input value={form.business_type || ''} onChange={e => set('business_type', e.target.value)} className="rounded-xl border-slate-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Phone</label>
              <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="rounded-xl border-slate-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Email</label>
              <Input value={form.email || ''} onChange={e => set('email', e.target.value)} className="rounded-xl border-slate-200" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Description</label>
              <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F4C3A] resize-none" />
            </div>
          </div>
        </div>

        {/* Timings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Operating Hours</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Opening Time</label>
              <Input type="time" value={form.opening_time || '09:00'} onChange={e => set('opening_time', e.target.value)} className="rounded-xl border-slate-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Closing Time</label>
              <Input type="time" value={form.closing_time || '21:00'} onChange={e => set('closing_time', e.target.value)} className="rounded-xl border-slate-200" />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Store Status</h2>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              form.status === 'published' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {form.status?.replace('_', ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown'}
            </div>
            {form.status !== 'published' && (
              <p className="text-xs text-slate-500">Your store is under review</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
