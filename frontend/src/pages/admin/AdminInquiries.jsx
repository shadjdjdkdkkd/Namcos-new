import React, { useState, useCallback } from 'react';
import { Phone, MapPin, Search, ChevronDown, Loader2, Package, User } from 'lucide-react';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/format';

const CATEGORIES = [
  { slug: 'shops', label: 'Shops' },
  { slug: 'services', label: 'Services' },
  { slug: 'agriculture', label: 'Agriculture' },
  { slug: 'classifieds', label: 'Classifieds' },
  { slug: 'food', label: 'Food' },
  { slug: 'health', label: 'Health' },
  { slug: 'home', label: 'Home' },
];

export default function AdminInquiries() {
  const [category, setCategory] = useState('agriculture');
  const [locality, setLocality] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.get('/admin/inquiries', {
        params: { category, locality: locality || undefined, search: search || undefined, limit: 50 },
      });
      setItems(data || []);
    } catch { setItems([]); }
    setLoading(false);
  }, [category, locality, search]);

  return (
    <div className="p-6 animate-fade-in max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Customer Inquiries</h1>
        <p className="text-sm text-slate-500 mt-0.5">Find nearby vendors to route incoming customer calls</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Category *</label>
            <div className="relative">
              <select
                data-testid="inquiries-category"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-11 px-3 pr-8 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:border-[#0F4C3A]">
                {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                data-testid="inquiries-locality"
                type="text" placeholder="Locality or City"
                value={locality} onChange={e => setLocality(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full h-11 pl-10 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4C3A]" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                data-testid="inquiries-search"
                type="text" placeholder="Product, service, title..."
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full h-11 pl-10 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4C3A]" />
            </div>
          </div>
        </div>
        <button
          data-testid="inquiries-search-btn"
          onClick={handleSearch} disabled={loading}
          className="h-11 px-6 bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl text-sm font-bold disabled:opacity-60">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2 inline" /> Searching...</> : 'Find Vendors'}
        </button>
      </div>

      {searched && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-600">
              <strong>{items.length}</strong> vendor{items.length !== 1 ? 's' : ''} found
              {locality ? ` near ${locality}` : ''}
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl skeleton" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No vendors match your filters. Try widening the search.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(v => <VendorRow key={v.id} v={v} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VendorRow({ v }) {
  const img = v.images?.[0];
  return (
    <div data-testid={`inquiry-vendor-${v.id}`}
      className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
        {img ? <img src={img} alt={v.name} className="w-full h-full object-cover" />
             : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-slate-400" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-900 truncate">{v.name || '—'}</p>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            {v.status || 'active'}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{v.category || '—'}</p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
          {v.seller_name && (
            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {v.seller_name}</span>
          )}
          {v.locality && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {v.locality}{v.city && v.city !== v.locality ? `, ${v.city}` : ''}</span>
          )}
          {v.price != null && (
            <span className="font-bold text-slate-700">{formatCurrency(v.price)}</span>
          )}
        </div>
      </div>
      {v.phone && (
        <a href={`tel:${v.phone}`}
          data-testid={`inquiry-call-${v.id}`}
          className="flex items-center gap-2 bg-[#0F4C3A] hover:bg-[#0a3829] text-white text-sm font-bold px-4 py-2.5 rounded-xl flex-shrink-0 active:scale-95 transition-all">
          <Phone className="w-4 h-4" /> {v.phone}
        </a>
      )}
    </div>
  );
}
