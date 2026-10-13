import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';

export default function AdminBusinessTypes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/business-types', { params: search ? { search } : {} });
      setItems(data || []);
    } catch { setItems([]); }
    setLoading(false);
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post('/admin/business-types', { name: newName.trim() });
      toast.success('Business type added');
      setNewName('');
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  const toggle = async (it) => {
    try {
      await api.put(`/admin/business-types/${it.id}`, { is_active: !it.is_active });
      setItems(prev => prev.map(x => x.id === it.id ? { ...x, is_active: !x.is_active } : x));
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (it) => {
    if (!window.confirm(`Delete "${it.name}"?`)) return;
    try {
      await api.delete(`/admin/business-types/${it.id}`);
      setItems(prev => prev.filter(x => x.id !== it.id));
      toast.success('Deleted');
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div data-testid="admin-business-types" className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Business Types</h1>
        <p className="text-sm text-slate-500 mt-0.5">Suggestions shown to merchants when registering a business ({items.length})</p>
      </div>

      <form onSubmit={add} className="flex gap-2 mb-5">
        <Input value={newName} onChange={e => setNewName(e.target.value)}
          data-testid="bt-new-name" placeholder="Add a new business type, e.g. Pet Grooming"
          className="rounded-xl border-slate-200 bg-white max-w-sm" />
        <Button type="submit" disabled={saving} data-testid="bt-add-btn"
          className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Add</>}
        </Button>
      </form>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search types..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 rounded-xl border-slate-200 bg-white" />
      </div>

      {loading ? <SkeletonList count={6} /> :
        items.length === 0 ? <EmptyState title="No business types" description="Add one above." /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {items.map(it => (
              <div key={it.id} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center justify-between gap-2">
                <span className={`text-sm font-medium truncate ${it.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{it.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => toggle(it)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${it.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {it.is_active ? 'Active' : 'Hidden'}
                  </button>
                  <button onClick={() => remove(it)} className="p-1 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
