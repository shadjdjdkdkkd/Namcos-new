import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Store, Leaf, Wrench, Tag, Loader2, Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import ImageUploader from '@/components/shared/ImageUploader';
import LocationInput from '@/components/shared/LocationInput';

const BUSINESS_TYPES = {
  store:       { label: 'Business / Shop',   icon: Store,  color: '#0F4C3A', examples: 'Restaurant, Supermarket, Pharmacy, Clothing Store' },
  agriculture: { label: 'Agriculture',       icon: Leaf,   color: '#16A34A', examples: 'Vegetable farmer, Dairy, Organic produce seller' },
  service:     { label: 'Service Provider',  icon: Wrench, color: '#2563EB', examples: 'Electrician, Plumber, AC Repair, Cleaning' },
  classified:  { label: 'Post a Classified', icon: Tag,    color: '#7C3AED', examples: 'Vehicle, Property, Jobs, Electronics' },
};

const CLASSIFIED_CATEGORIES = [
  'Vehicles & Bikes', 'Electronics & Gadgets', 'Mobile Phones & Tablets',
  'Furniture & Home Decor', 'Real Estate', 'Jobs & Careers',
  'Clothes & Fashion', 'Sports & Fitness', 'Books & Education',
  'Agriculture & Farm', 'Pets & Animals', 'Others',
];

const CONDITIONS = [
  { value: 'new', label: 'Brand New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

const AGRI_UNITS = ['kg', 'g', 'litre', 'piece', 'bunch', 'dozen', 'quintal', 'bag'];

export default function MerchantRegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const defaultType = params.get('type') || 'store';

  const [type, setType] = useState(defaultType);
  useEffect(() => { setType(defaultType); }, [defaultType]);
  const [images, setImages] = useState([]);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [location, setLocation] = useState({ locality: '', city: '', state: 'Kerala', lat: null, lng: null });
  const [form, setForm] = useState({
    business_name: '', business_type: '', owner_name: '', phone: '', description: '', address: '', pincode: '',
    service_radius: 10, upi_id: '', opening_time: '09:00', closing_time: '21:00',
    classified_category: '', condition: 'good', price: '',
    // Agriculture-specific
    unit: 'kg', available_quantity: '', is_organic: false,
    // Service-specific
    starting_price: '', experience_years: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.get('/business-types').then(r => setBusinessTypes(r.data || [])).catch(() => setBusinessTypes([]));
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validateCommon = () => {
    if (images.length < 4) { toast.error('Minimum 4 photos required'); return false; }
    if (!location.locality || !location.city) { toast.error('Location is mandatory'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateCommon()) return;

    setLoading(true);
    try {
      const loc = { locality: location.locality, city: location.city, state: location.state || 'Kerala',
                    latitude: location.lat, longitude: location.lng };
      if (type === 'classified') {
        if (!form.business_name.trim() || !form.classified_category) { toast.error('Fill title and category'); setLoading(false); return; }
        await api.post('/classifieds/submit', {
          title: form.business_name.trim(), category: form.classified_category,
          description: form.description.trim(), condition: form.condition,
          price: form.price ? parseFloat(form.price) : undefined,
          is_negotiable: true, contact_preference: 'phone',
          images, ...loc,
        });
      } else if (type === 'agriculture') {
        if (!form.business_name.trim() || !form.price) { toast.error('Fill product name and price'); setLoading(false); return; }
        await api.post('/agriculture/submit', {
          product_name: form.business_name.trim(),
          category: form.classified_category || 'Fruits & Vegetables',
          description: form.description.trim(),
          price: parseFloat(form.price),
          unit: form.unit, min_quantity: 1,
          available_quantity: parseFloat(form.available_quantity || 10),
          is_organic: form.is_organic,
          pickup_available: true, delivery_available: false, bulk_available: false,
          images, ...loc,
        });
      } else if (type === 'service') {
        if (!form.business_name.trim() || !form.owner_name.trim() || !form.phone.trim()) {
          toast.error('Fill service name, provider name and phone'); setLoading(false); return;
        }
        await api.post('/services/submit', {
          service_name: form.business_name.trim(),
          provider_name: form.owner_name.trim(),
          phone: form.phone,
          category: form.classified_category || 'General',
          description: form.description.trim() || 'Professional service',
          starting_price: form.starting_price ? parseFloat(form.starting_price) : 0,
          experience_years: form.experience_years ? parseInt(form.experience_years) : 0,
          service_radius: form.service_radius,
          opening_time: form.opening_time, closing_time: form.closing_time,
          images, ...loc,
        });
      } else {
        // store
        if (!form.business_name.trim() || !form.owner_name.trim() || !form.phone.trim()) {
          toast.error('Fill shop name, owner and phone'); setLoading(false); return;
        }
        if (!form.business_type.trim()) {
          toast.error('Select or type a business type'); setLoading(false); return;
        }
        await api.post('/stores/submit', {
          business_name: form.business_name.trim(),
          business_type: form.business_type.trim(),
          owner_name: form.owner_name.trim(),
          phone: form.phone,
          description: form.description,
          address: form.address, pincode: form.pincode,
          service_radius: form.service_radius,
          upi_id: form.upi_id,
          opening_time: form.opening_time, closing_time: form.closing_time,
          categories: [type],
          images, ...loc,
        });
      }
      setSubmitted(true);
      toast.success('Submitted! Admin will review within a few hours.');
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 pb-24 animate-fade-in">
        <div className="bg-white rounded-3xl shadow-md border border-slate-100 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-[#0F4C3A]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-[#0F4C3A]" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Submitted!</h2>
          <p className="text-sm text-slate-500 mb-6">
            Our team is reviewing your listing. Once approved, it will go live on NAMCOS.
          </p>
          <Button onClick={() => navigate('/customer')} className="w-full bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const sel = BUSINESS_TYPES[type];
  const isClassified = type === 'classified';
  const isAgri = type === 'agriculture';
  const isService = type === 'service';

  return (
    <div className="pb-24 animate-fade-in bg-slate-50 min-h-screen">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/customer')}
            data-testid="mr-back-btn"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-base font-extrabold text-slate-900">List on NAMCOS</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Choose Type</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(BUSINESS_TYPES).map(([key, val]) => {
              const Icon = val.icon;
              return (
                <button key={key} onClick={() => setType(key)}
                  data-testid={`mr-type-${key}`}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                    type === key ? 'border-[#0F4C3A] bg-[#0F4C3A]/5' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${val.color}15` }}>
                    <Icon className="w-4 h-4" style={{ color: val.color }} />
                  </div>
                  <p className={`text-xs font-bold ${type === key ? 'text-[#0F4C3A]' : 'text-slate-700'}`}>{val.label}</p>
                </button>
              );
            })}
          </div>
          {sel?.examples && <p className="text-[10px] text-slate-400 mt-2">{sel.examples}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Photos — required first */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <ImageUploader value={images} onChange={setImages} min={4} max={8} />
          </div>

          {/* Basic Details */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isClassified ? 'Listing Details'
               : isAgri ? 'Produce Details'
               : isService ? 'Service Details'
               : 'Business Details'}
            </p>

            <Field
              label={isClassified ? 'Listing Title *'
                    : isAgri ? 'Product Name *'
                    : isService ? 'Service Name *'
                    : 'Business / Shop Name *'}
              placeholder={isClassified ? 'e.g. Honda Activa 2022'
                    : isAgri ? 'Fresh Tomatoes, Organic Rice...'
                    : isService ? 'AC Repair, Home Cleaning...'
                    : 'Green Mart, Ravi Electricals'}
              value={form.business_name}
              onChange={v => set('business_name', v)}
            />

            {type === 'store' && (
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Business Type *</label>
                <input
                  list="mr-biz-types"
                  data-testid="mr-business-type-input"
                  value={form.business_type}
                  onChange={e => set('business_type', e.target.value)}
                  placeholder="Start typing… e.g. Bakery, Jewellery, Supermarket"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:border-[#0F4C3A]"
                />
                <datalist id="mr-biz-types">
                  {businessTypes.map(b => <option key={b.id} value={b.name} />)}
                </datalist>
                <p className="text-[10px] text-slate-400 mt-1">Pick a suggestion or type your own</p>
              </div>
            )}

            {(isClassified || isAgri || isService) && (
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Category *</label>
                <div className="relative">
                  <select
                    data-testid="mr-category-select"
                    value={form.classified_category}
                    onChange={e => set('classified_category', e.target.value)}
                    className="w-full h-11 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4C3A] appearance-none text-slate-700">
                    <option value="">Select a category...</option>
                    {(isAgri ? ['Vegetables & Fruits','Grains & Cereals','Spices','Poultry & Dairy','Nuts & Dry Fruits','Herbs','Others']
                      : isService ? ['Electrician','Plumber','Cleaning Services','AC/Appliance Repair','Painting','Carpentry','Beauty & Salon','Tutoring','Photography','Others']
                      : CLASSIFIED_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            {isClassified && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Condition</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CONDITIONS.map(c => (
                      <button key={c.value} type="button" onClick={() => set('condition', c.value)}
                        className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                          form.condition === c.value ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'border-slate-200 text-slate-600 hover:border-[#7C3AED]'
                        }`}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <PriceField label="Asking Price" value={form.price} onChange={v => set('price', v)} accent="#7C3AED" />
              </>
            )}

            {isAgri && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <PriceField label="Price *" value={form.price} onChange={v => set('price', v)} accent="#16A34A" />
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Unit</label>
                    <select value={form.unit} onChange={e => set('unit', e.target.value)}
                      className="w-full h-11 px-3 border border-slate-200 rounded-xl text-sm bg-white">
                      {AGRI_UNITS.map(u => <option key={u} value={u}>per {u}</option>)}
                    </select>
                  </div>
                </div>
                <Field label="Available Quantity" placeholder="10" type="number"
                  value={form.available_quantity} onChange={v => set('available_quantity', v)} />
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                  <input type="checkbox" checked={form.is_organic} onChange={e => set('is_organic', e.target.checked)} />
                  This is organic produce
                </label>
              </>
            )}

            {isService && (
              <div className="grid grid-cols-2 gap-2">
                <PriceField label="Starting Price *" value={form.starting_price} onChange={v => set('starting_price', v)} accent="#2563EB" />
                <Field label="Years Experience" placeholder="0" type="number"
                  value={form.experience_years} onChange={v => set('experience_years', v)} />
              </div>
            )}

            {!isClassified && !isAgri && (
              <>
                <Field label="Your Name (Owner) *" placeholder="Full name" value={form.owner_name} onChange={v => set('owner_name', v)} />
                <Field label="Contact Number *" placeholder="10-digit mobile" type="tel"
                  value={form.phone} onChange={v => set('phone', v.replace(/\D/g,'').slice(0,10))} />
              </>
            )}
            {isService && (
              <>
                <Field label="Provider Name *" placeholder="Your business name" value={form.owner_name} onChange={v => set('owner_name', v)} />
                <Field label="Contact Number *" placeholder="10-digit mobile" type="tel"
                  value={form.phone} onChange={v => set('phone', v.replace(/\D/g,'').slice(0,10))} />
              </>
            )}

            <Field label="Description" multiline
              placeholder={isClassified ? 'Describe your listing...' : 'Brief details about your listing'}
              value={form.description} onChange={v => set('description', v)} />
          </div>

          {/* Location (mandatory) */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <LocationInput value={location} onChange={setLocation} testId="mr-location-input" />
            {!isClassified && !isAgri && (
              <Field label="Full Address" placeholder="Door No, Street, Landmark"
                value={form.address} onChange={v => set('address', v)} />
            )}
          </div>

          {(type === 'store' || isService) && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment (optional)</p>
              <Field label="UPI ID" placeholder="yourname@upi" value={form.upi_id} onChange={v => set('upi_id', v)} />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            data-testid="merchant-register-submit"
            className="w-full h-13 text-white rounded-2xl font-bold text-base shadow-md py-4"
            style={{ backgroundColor: sel?.color || '#0F4C3A' }}>
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</>
              : 'Submit for Review'}
          </Button>
          <p className="text-center text-xs text-slate-400 pb-2">Admin approval required · usually within a few hours</p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, type = 'text', multiline }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">{label}</label>
      {multiline
        ? <textarea placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0F4C3A] resize-none" />
        : <Input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
            className="h-11 rounded-xl border-slate-200 focus:border-[#0F4C3A] text-sm" />
      }
    </div>
  );
}

function PriceField({ label, value, onChange, accent = '#0F4C3A' }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
        <Input type="number" placeholder="0" value={value} onChange={e => onChange(e.target.value)}
          className="pl-7 h-11 rounded-xl border-slate-200 focus:border-[color] text-sm"
          style={{ '--color': accent }} />
      </div>
    </div>
  );
}
