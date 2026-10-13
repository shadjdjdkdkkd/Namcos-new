import React, { useState, useEffect } from 'react';
import { Store, Leaf, Wrench, Tag, ShoppingBag, Heart, Home as HomeIcon, Grid3X3,
  Pencil, Phone, ChevronUp, ChevronDown, ToggleLeft, ToggleRight, Zap, Car, Building, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import ImageUploader from '@/components/shared/ImageUploader';
import { ADMIN } from '@/constants/testIds';

const ICON_OPTIONS = [
  { name: 'Store', icon: Store }, { name: 'Leaf', icon: Leaf }, { name: 'Wrench', icon: Wrench },
  { name: 'Tag', icon: Tag }, { name: 'ShoppingBag', icon: ShoppingBag }, { name: 'Heart', icon: Heart },
  { name: 'HomeIcon', icon: HomeIcon }, { name: 'Grid3X3', icon: Grid3X3 }, { name: 'Zap', icon: Zap },
  { name: 'Car', icon: Car }, { name: 'Building', icon: Building }, { name: 'Package', icon: Package },
];

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(o => [o.name, o.icon]));
const COLOR_OPTIONS = ['#0F4C3A','#16A34A','#2563EB','#7C3AED','#EA580C','#DB2777','#0891B2','#D97706','#DC2626','#0B192C'];

function EditModal({ cat, onSave, onClose }) {
  const [form, setForm] = useState({ ...cat });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/categories/${cat.id}`, form);
      toast.success('Category updated');
      onSave();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const SelectedIcon = ICON_MAP[form.icon] || Store;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Edit Category: {cat.name}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${form.color}20` }}>
              <SelectedIcon className="w-5 h-5" style={{ color: form.color }} />
            </div>
            <div>
              <p className="font-bold text-slate-800">{form.name}</p>
              <p className="text-xs text-slate-500">{form.description}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Category Name</label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} className="rounded-xl border-slate-200 h-10" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Description</label>
            <Input value={form.description || ''} onChange={e => set('description', e.target.value)} className="rounded-xl border-slate-200 h-10" />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Icon</label>
            <div className="grid grid-cols-6 gap-2">
              {ICON_OPTIONS.map(({ name, icon: Icon }) => (
                <button key={name} type="button" onClick={() => set('icon', name)}
                  className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                    form.icon === name ? 'border-[#0F4C3A] bg-[#0F4C3A]/8' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <Icon className="w-5 h-5" style={{ color: form.icon === name ? form.color : '#94a3b8' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Optional Image Upload */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Custom Image (optional)</label>
            <ImageUploader
              value={form.image_url ? [form.image_url] : []}
              onChange={(imgs) => set('image_url', imgs[0] || '')}
              min={1} max={1}
              testIdPrefix="category-image"
            />
            <p className="text-[10px] text-slate-400 mt-1">If uploaded, this image will override the icon on the home screen.</p>
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => set('color', c)} type="button"
                  className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Support Phone */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Support / Booking Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input type="tel" value={form.support_phone || ''} onChange={e => set('support_phone', e.target.value)}
                placeholder="+91 98765 43210"
                className="pl-9 rounded-xl border-slate-200 h-10" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Customers tap "Call to Book" → opens dialer with this number</p>
          </div>

          {/* Max Distance */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Max Distance (km)</label>
            <div className="flex gap-2">
              {[5, 10, 20, 50].map(k => (
                <button key={k} type="button" onClick={() => set('max_distance_km', k)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                    form.max_distance_km === k ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'border-slate-200 text-slate-600'
                  }`}>
                  {k}km
                </button>
              ))}
            </div>
          </div>

          {/* Enable / Disable */}
          <div className="flex items-center justify-between py-2 border-t border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-700">Show on App</p>
              <p className="text-xs text-slate-400">Visible to customers</p>
            </div>
            <button type="button" onClick={() => set('is_active', !form.is_active)}
              className={`w-12 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-[#0F4C3A]' : 'bg-slate-200'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.is_active ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#0F4C3A] hover:bg-[#0a3829] text-white">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/categories'); setCategories(data); }
    catch { setCategories([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const toggleActive = async (cat) => {
    try {
      await api.put(`/admin/categories/${cat.id}`, { is_active: !cat.is_active });
      toast.success(`${cat.name} ${cat.is_active ? 'disabled' : 'enabled'}`);
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c));
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div data-testid={ADMIN.settings} className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage app categories — icons, visibility, support numbers, coverage</p>
      </div>

      {loading ? (
        <div className="grid gap-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {categories.map((cat, i) => {
            const Icon = ICON_MAP[cat.icon] || Store;
            return (
              <div key={cat.id} className={`flex items-center gap-4 px-4 py-3.5 ${i !== categories.length - 1 ? 'border-b border-slate-50' : ''} hover:bg-slate-50/50`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${cat.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{cat.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {cat.is_active ? 'Active' : 'Hidden'}
                    </span>
                    {cat.support_phone && (
                      <span className="text-[10px] flex items-center gap-0.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        <Phone className="w-2.5 h-2.5" /> {cat.support_phone}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{cat.description} · Max {cat.max_distance_km || 20}km</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(cat)}
                    className={`transition-colors ${cat.is_active ? 'text-green-500' : 'text-slate-300'}`}>
                    {cat.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button onClick={() => setEditing(cat)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditModal cat={editing} onSave={() => { setEditing(null); fetch(); }} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
