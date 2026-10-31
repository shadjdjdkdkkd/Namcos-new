import { appName } from '@/lib/brand';
import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import ImageUploader from '@/components/shared/ImageUploader';
import { ADMIN } from '@/constants/testIds';

function BannerForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    title: '', subtitle: '', image_url: '', cta_text: 'Explore Now',
    cta_link: '/customer/explore', is_active: true, display_order: 1,
    ...(initial || {})
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      if (initial?.id) {
        await api.put(`/admin/banners/${initial.id}`, form);
        toast.success('Banner updated');
      } else {
        await api.post('/admin/banners', form);
        toast.success('Banner created');
      }
      onSave();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{initial?.id ? 'Edit Banner' : 'New Banner'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { key: 'title', label: 'Title *', placeholder: `Welcome to ${appName()}` },
            { key: 'subtitle', label: 'Subtitle', placeholder: 'Discover local businesses' },
            { key: 'cta_text', label: 'Button Text', placeholder: 'Explore Now' },
            { key: 'cta_link', label: 'Button Link', placeholder: '/customer/explore' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
              <Input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
                className="rounded-xl border-slate-200 h-10" />
            </div>
          ))}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Banner Image <span className="normal-case font-normal text-slate-400">(16:9, e.g. 1600×900 px)</span></label>
            <ImageUploader
              value={form.image_url ? [form.image_url] : []}
              onChange={(imgs) => set('image_url', imgs[0] || '')}
              min={1} max={1}
              testIdPrefix="banner-image"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Display Order</label>
              <Input type="number" value={form.display_order} onChange={e => set('display_order', parseInt(e.target.value))}
                className="rounded-xl border-slate-200 h-10" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => set('is_active', !form.is_active)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${form.is_active ? 'bg-[#0F4C3A]' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.is_active ? 'left-5.5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-slate-600 font-medium">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#0F4C3A] hover:bg-[#0a3829] text-white">
              {saving ? 'Saving...' : 'Save Banner'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/banners'); setBanners(data); }
    catch { setBanners([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const toggleActive = async (b) => {
    try {
      await api.put(`/admin/banners/${b.id}`, { is_active: !b.is_active });
      toast.success(`Banner ${b.is_active ? 'deactivated' : 'activated'}`);
      fetch();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const deleteBanner = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    try { await api.delete(`/admin/banners/${id}`); toast.success('Banner deleted'); fetch(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div data-testid="admin-banners" className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banners</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage home screen promotional banners</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}
          className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl gap-2">
          <Plus className="w-4 h-4" /> New Banner
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3">{[1,2].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}</div>
      ) : banners.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="font-medium">No banners yet</p>
          <p className="text-sm mt-1">Click "New Banner" to create your first promotional banner</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {banners.map((b, i) => (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
              {b.image_url ? (
                <img src={b.image_url} alt={b.title} className="w-28 aspect-video rounded-xl object-cover flex-shrink-0 border border-slate-200" />
              ) : (
                <div className="w-20 h-16 rounded-xl bg-gradient-to-br from-[#0F4C3A] to-[#1a6b55] flex-shrink-0 flex items-center justify-center">
                  <span className="text-white/50 text-xs font-medium">No Image</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800 truncate">{b.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${b.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-500'}`}>
                    {b.is_active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                {b.subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{b.subtitle}</p>}
                {b.cta_text && <p className="text-xs text-blue-600 mt-1 truncate">{b.cta_text} → {b.cta_link}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(b)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${b.is_active ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-50'}`}>
                  {b.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => { setEditing(b); setShowForm(true); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteBanner(b.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <BannerForm
          initial={editing}
          onSave={() => { setShowForm(false); setEditing(null); fetch(); }}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
