import React, { useState } from 'react';
import { Store, Leaf, Wrench, Tag, Loader2, Save, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import ImageUploader from '@/components/shared/ImageUploader';
import LocationInput from '@/components/shared/LocationInput';

const TYPES = [
  { key: 'store',       label: 'Shop / Business', icon: Store,  color: '#0F4C3A', endpoint: '/admin/add/store' },
  { key: 'agriculture', label: 'Agriculture',     icon: Leaf,   color: '#16A34A', endpoint: '/admin/add/agriculture' },
  { key: 'service',     label: 'Service',         icon: Wrench, color: '#2563EB', endpoint: '/admin/add/service' },
  { key: 'classified',  label: 'Classified',      icon: Tag,    color: '#7C3AED', endpoint: '/admin/add/classified' },
];

const AGRI_CATEGORIES = ['Vegetables & Fruits','Grains & Cereals','Spices','Poultry & Dairy','Nuts & Dry Fruits','Herbs','Others'];
const SERVICE_CATEGORIES = ['Electrician','Plumber','Cleaning Services','AC/Appliance Repair','Painting','Carpentry','Beauty & Salon','Tutoring','Photography','Others'];
const CLASSIFIED_CATEGORIES = ['Vehicles & Bikes','Electronics & Gadgets','Mobile Phones & Tablets','Furniture & Home Decor','Real Estate','Jobs & Careers','Clothes & Fashion','Sports & Fitness','Books & Education','Agriculture & Farm','Pets & Animals','Others'];

export default function AdminManualAdd() {
  const [type, setType] = useState('store');
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState({ locality: '', city: '', state: 'Kerala', lat: null, lng: null });
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({});
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));

  const cfg = TYPES.find(t => t.key === type);

  const reset = () => { setImages([]); setLocation({ locality: '', city: '', state: 'Kerala', lat: null, lng: null }); setF({}); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (images.length < 4) { toast.error('Minimum 4 photos required'); return; }
    if (!location.locality || !location.city) { toast.error('Location is mandatory'); return; }

    const loc = { locality: location.locality, city: location.city, state: location.state,
                  latitude: location.lat, longitude: location.lng };
    let payload = { images, ...loc };

    if (type === 'store') {
      if (!f.business_name || !f.owner_name || !f.phone) { toast.error('Fill business name, owner and phone'); return; }
      payload = { ...payload,
        business_name: f.business_name, business_type: f.business_type || 'Shop',
        owner_name: f.owner_name, phone: f.phone,
        description: f.description || '', address: f.address || '',
        opening_time: f.opening_time || '09:00', closing_time: f.closing_time || '21:00',
        service_radius: Number(f.service_radius || 5),
        category: f.category || 'shops',
        status: 'published',
      };
    } else if (type === 'agriculture') {
      if (!f.product_name || !f.price) { toast.error('Fill product name and price'); return; }
      payload = { ...payload,
        product_name: f.product_name, category: f.category || 'Vegetables & Fruits',
        description: f.description || '', unit: f.unit || 'kg',
        price: Number(f.price), available_quantity: Number(f.available_quantity || 10),
        seller_name: f.seller_name || 'Admin Added', seller_phone: f.seller_phone || '',
        is_organic: !!f.is_organic, status: 'published',
      };
    } else if (type === 'service') {
      if (!f.service_name || !f.phone) { toast.error('Fill service name and phone'); return; }
      payload = { ...payload,
        service_name: f.service_name, provider_name: f.provider_name || 'Admin Added',
        category: f.category || 'Others', phone: f.phone,
        description: f.description || '',
        starting_price: Number(f.starting_price || 0),
        experience_years: Number(f.experience_years || 0),
        service_radius: Number(f.service_radius || 10),
        status: 'published',
      };
    } else {
      if (!f.title || !f.price) { toast.error('Fill title and price'); return; }
      payload = { ...payload,
        title: f.title, category: f.category || 'Others',
        condition: f.condition || 'good', price: Number(f.price),
        description: f.description || '',
        seller_name: f.seller_name || 'Admin Added', seller_phone: f.seller_phone || '',
        is_negotiable: !!f.is_negotiable, status: 'published',
      };
    }

    setSaving(true);
    try {
      await api.post(cfg.endpoint, payload);
      toast.success('Listing published!');
      reset();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Add Listing</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manually add a store, produce, service or classified — location and 4+ photos are required</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {TYPES.map(t => (
          <button key={t.key}
            data-testid={`add-type-${t.key}`}
            onClick={() => setType(t.key)}
            className={`flex items-center gap-2 p-3 rounded-2xl border transition-all text-left ${
              type === t.key ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${t.color}18` }}>
              <t.icon className="w-4 h-4" style={{ color: t.color }} />
            </div>
            <p className="text-xs font-bold text-slate-800">{t.label}</p>
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <Section title="Photos">
          <ImageUploader value={images} onChange={setImages} min={4} max={8} testIdPrefix={`add-${type}-images`} />
        </Section>

        <Section title="Details">
          {type === 'store' && <>
            <Two>
              <Field label="Business Name *" value={f.business_name} onChange={v => set('business_name', v)} />
              <Field label="Business Type" value={f.business_type} onChange={v => set('business_type', v)} placeholder="Supermarket, Restaurant..." />
            </Two>
            <Two>
              <Field label="Owner Name *" value={f.owner_name} onChange={v => set('owner_name', v)} />
              <Field label="Phone *" value={f.phone} onChange={v => set('phone', v)} type="tel" />
            </Two>
            <Field label="Address" value={f.address} onChange={v => set('address', v)} />
            <Field label="Description" value={f.description} onChange={v => set('description', v)} multiline />
            <Two>
              <Field label="Opening" value={f.opening_time} onChange={v => set('opening_time', v)} placeholder="09:00" />
              <Field label="Closing" value={f.closing_time} onChange={v => set('closing_time', v)} placeholder="21:00" />
            </Two>
          </>}

          {type === 'agriculture' && <>
            <Two>
              <Field label="Product Name *" value={f.product_name} onChange={v => set('product_name', v)} />
              <Select label="Category" value={f.category} onChange={v => set('category', v)} options={AGRI_CATEGORIES} />
            </Two>
            <Two>
              <Field label="Price *" value={f.price} onChange={v => set('price', v)} type="number" />
              <Field label="Unit" value={f.unit} onChange={v => set('unit', v)} placeholder="kg / piece / bunch" />
            </Two>
            <Two>
              <Field label="Seller Name" value={f.seller_name} onChange={v => set('seller_name', v)} />
              <Field label="Seller Phone" value={f.seller_phone} onChange={v => set('seller_phone', v)} type="tel" />
            </Two>
            <Field label="Description" value={f.description} onChange={v => set('description', v)} multiline />
            <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
              <input type="checkbox" checked={!!f.is_organic} onChange={e => set('is_organic', e.target.checked)} />
              This is organic produce
            </label>
          </>}

          {type === 'service' && <>
            <Two>
              <Field label="Service Name *" value={f.service_name} onChange={v => set('service_name', v)} />
              <Select label="Category" value={f.category} onChange={v => set('category', v)} options={SERVICE_CATEGORIES} />
            </Two>
            <Two>
              <Field label="Provider / Business" value={f.provider_name} onChange={v => set('provider_name', v)} />
              <Field label="Phone *" value={f.phone} onChange={v => set('phone', v)} type="tel" />
            </Two>
            <Two>
              <Field label="Starting Price" value={f.starting_price} onChange={v => set('starting_price', v)} type="number" />
              <Field label="Years Experience" value={f.experience_years} onChange={v => set('experience_years', v)} type="number" />
            </Two>
            <Field label="Description" value={f.description} onChange={v => set('description', v)} multiline />
          </>}

          {type === 'classified' && <>
            <Two>
              <Field label="Title *" value={f.title} onChange={v => set('title', v)} />
              <Select label="Category" value={f.category} onChange={v => set('category', v)} options={CLASSIFIED_CATEGORIES} />
            </Two>
            <Two>
              <Select label="Condition" value={f.condition} onChange={v => set('condition', v)} options={['new','like_new','good','fair','poor']} />
              <Field label="Price *" value={f.price} onChange={v => set('price', v)} type="number" />
            </Two>
            <Two>
              <Field label="Seller Name" value={f.seller_name} onChange={v => set('seller_name', v)} />
              <Field label="Seller Phone" value={f.seller_phone} onChange={v => set('seller_phone', v)} type="tel" />
            </Two>
            <Field label="Description" value={f.description} onChange={v => set('description', v)} multiline />
            <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
              <input type="checkbox" checked={!!f.is_negotiable} onChange={e => set('is_negotiable', e.target.checked)} />
              Price negotiable
            </label>
          </>}
        </Section>

        <Section title="Location">
          <LocationInput value={location} onChange={setLocation} testId={`add-${type}-location`} />
        </Section>

        <button type="submit" disabled={saving}
          data-testid={`add-${type}-submit`}
          className="w-full h-13 flex items-center justify-center gap-2 text-white rounded-2xl font-bold text-base shadow-md py-4"
          style={{ background: cfg.color }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Publish {cfg.label}</>}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Two({ children }) { return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>; }
function Field({ label, value = '', onChange, type = 'text', placeholder = '', multiline }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
      {multiline
        ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0F4C3A] resize-none" />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full h-11 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4C3A]" />}
    </div>
  );
}
function Select({ label, value = '', onChange, options }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full h-11 px-3 pr-8 border border-slate-200 rounded-xl text-sm bg-white appearance-none focus:outline-none focus:border-[#0F4C3A]">
          <option value="">Select...</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}
