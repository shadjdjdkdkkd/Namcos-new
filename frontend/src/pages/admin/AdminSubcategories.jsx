import React, { useState, useEffect } from 'react';
import { Check, X, Trash2, Plus, Clock, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';

const CATS = ['shops', 'food', 'health', 'home', 'services', 'agriculture', 'classifieds'];

export default function AdminSubcategories() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('shops');

  const fetchSubs = async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/subcategories'); setSubs(data); }
    catch { setSubs([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchSubs(); }, []);

  const update = async (id, body) => {
    try { await api.put(`/admin/subcategories/${id}`, body); fetchSubs(); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const del = async (id) => {
    try { await api.delete(`/admin/subcategories/${id}`); toast.success('Deleted'); fetchSubs(); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const create = async () => {
    if (!newName.trim()) { toast.error('Enter a name'); return; }
    try {
      await api.post('/admin/subcategories', { name: newName.trim(), category: newCat });
      toast.success('Subcategory added'); setNewName(''); fetchSubs();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const pending = subs.filter(s => s.status === 'pending');
  const approved = subs.filter(s => s.status === 'approved');

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subcategories</h1>
        <p className="text-sm text-slate-500 mt-0.5">Approve custom subcategories and manage the list shown to customers</p>
      </div>

      {/* Add new */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5 flex flex-col sm:flex-row gap-2 items-end">
        <div className="flex-1 w-full">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">New subcategory</label>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Opticals"
            data-testid="new-subcat-name" className="rounded-xl border-slate-200 h-10" />
        </div>
        <select value={newCat} onChange={e => setNewCat(e.target.value)}
          className="h-10 px-3 rounded-xl border border-slate-200 text-sm capitalize bg-white">
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button onClick={create} data-testid="add-subcat-btn" className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl h-10">
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {loading ? <div className="h-40 bg-white rounded-2xl animate-pulse" /> : (
        <>
          {pending.length > 0 && (
            <div className="mb-5">
              <h2 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Pending approval ({pending.length})</h2>
              <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
                {pending.map((s, i) => (
                  <div key={s.id} data-testid={`pending-subcat-${s.id}`} className={`flex items-center gap-3 px-4 py-3 ${i < pending.length - 1 ? 'border-b border-slate-50' : ''}`}>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                      <p className="text-[11px] text-slate-400 capitalize">{s.category}</p>
                    </div>
                    <button onClick={() => update(s.id, { status: 'approved' })} data-testid={`approve-subcat-${s.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100">
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => update(s.id, { status: 'rejected' })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100">
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Layers className="w-4 h-4" /> Active subcategories</h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {approved.length === 0 ? <p className="p-4 text-sm text-slate-400">None yet</p> :
              approved.map((s, i) => (
                <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${i < approved.length - 1 ? 'border-b border-slate-50' : ''}`}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                    <p className="text-[11px] text-slate-400 capitalize">{s.category}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {s.is_active ? 'Visible' : 'Hidden'}
                  </span>
                  <button onClick={() => update(s.id, { is_active: !s.is_active })} className="text-xs text-slate-500 hover:text-[#0F4C3A] font-medium">
                    {s.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => del(s.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
