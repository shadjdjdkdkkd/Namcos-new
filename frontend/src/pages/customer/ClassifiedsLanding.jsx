import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Search, MapPin, Plus, Car, Smartphone, Home, Sofa, Briefcase,
  Shirt, Dumbbell, BookOpen, Leaf, PawPrint, Grid3X3, Package, Eye, Tag,
} from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import api from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/format';

const CATEGORY_LIST = [
  { slug: 'Vehicles & Bikes',        label: 'Vehicles',   icon: Car,        color: '#DC2626' },
  { slug: 'Mobile Phones & Tablets', label: 'Mobiles',    icon: Smartphone, color: '#0EA5E9' },
  { slug: 'Electronics & Gadgets',   label: 'Electronics',icon: Package,    color: '#0891B2' },
  { slug: 'Real Estate',             label: 'Property',   icon: Home,       color: '#0F4C3A' },
  { slug: 'Furniture & Home Decor',  label: 'Furniture',  icon: Sofa,       color: '#B45309' },
  { slug: 'Jobs & Careers',          label: 'Jobs',       icon: Briefcase,  color: '#7C3AED' },
  { slug: 'Clothes & Fashion',       label: 'Fashion',    icon: Shirt,      color: '#DB2777' },
  { slug: 'Sports & Fitness',        label: 'Sports',     icon: Dumbbell,   color: '#EA580C' },
  { slug: 'Books & Education',       label: 'Books',      icon: BookOpen,   color: '#0D9488' },
  { slug: 'Agriculture & Farm',      label: 'Agri',       icon: Leaf,       color: '#16A34A' },
  { slug: 'Pets & Animals',          label: 'Pets',       icon: PawPrint,   color: '#D97706' },
  { slug: 'Others',                  label: 'Others',     icon: Grid3X3,    color: '#64748B' },
];

const CONDITION_LABELS = { new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Repair' };

export default function ClassifiedsLanding() {
  const navigate = useNavigate();
  const [locality] = useState(() => localStorage.getItem('namcos_locality') || '');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = { limit: 40 };
    if (locality) params.locality = locality;
    if (category) params.category = category;
    if (search) params.search = search;
    try {
      const { data } = await api.get('/classifieds', { params });
      setItems(data || []);
    } catch { setItems([]); }
    setLoading(false);
  }, [category, search, locality]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Group by category when no specific category is selected
  const grouped = category
    ? { [category]: items }
    : items.reduce((acc, it) => {
        const k = it.category || 'Others';
        (acc[k] = acc[k] || []).push(it);
        return acc;
      }, {});

  const activeCatLabel = CATEGORY_LIST.find(c => c.slug === category)?.label || '';

  return (
    <div className="pb-28 animate-fade-in bg-slate-50 min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            data-testid="classifieds-back-btn"
            onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/customer')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#7C3AED20' }}>
            <Tag className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <h1 className="text-base font-extrabold text-slate-900 flex-1">
            {category ? activeCatLabel : 'Classifieds'}
          </h1>
          <button
            data-testid="classifieds-post-btn"
            onClick={() => navigate('/customer/register-merchant?type=classified')}
            className="flex items-center gap-1 bg-[#7C3AED] hover:bg-purple-700 text-white text-xs font-bold px-3 py-2 rounded-full shadow-md active:scale-95 transition-all">
            <Plus className="w-3.5 h-3.5" /> Post
          </button>
        </div>
        <div className="px-4 pb-3 relative">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            data-testid="classifieds-search"
            type="text" placeholder={`Search ${activeCatLabel.toLowerCase() || 'classifieds'}...`}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#7C3AED] transition-all" />
        </div>

        {/* Category tabs (scrollable pills) */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
          <button
            data-testid="classifieds-cat-all"
            onClick={() => setCategory('')}
            className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !category ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#7C3AED]/40'
            }`}>
            All
          </button>
          {CATEGORY_LIST.map(c => (
            <button key={c.slug}
              data-testid={`classifieds-cat-${c.slug.split(' ')[0].toLowerCase()}`}
              onClick={() => setCategory(c.slug)}
              className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                category === c.slug ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-current'
              }`}
              style={category === c.slug ? { background: c.color } : { color: c.color }}>
              <c.icon className="w-3.5 h-3.5" />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Location context */}
      {locality && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-[#7C3AED]/6 rounded-xl px-3 py-2">
          <MapPin className="w-3.5 h-3.5 text-[#7C3AED] flex-shrink-0" />
          <p className="text-xs text-[#7C3AED] font-semibold">Showing near <strong>{locality}</strong></p>
        </div>
      )}

      {loading ? (
        <div className="p-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 bg-white rounded-2xl animate-pulse" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="pt-12">
          <EmptyState title={search ? 'No results' : `No classifieds${locality ? ` near ${locality}` : ''}`}
            description="Try a different category or post your own listing."
            action={() => navigate('/customer/register-merchant?type=classified')}
            actionLabel="Post a Classified" />
        </div>
      ) : (
        <div className="pt-2">
          {Object.entries(grouped)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([cat, list]) => {
              const catObj = CATEGORY_LIST.find(c => c.slug === cat) || CATEGORY_LIST[CATEGORY_LIST.length - 1];
              const Icon = catObj.icon;
              return (
                <section key={cat} className="pt-5">
                  <div className="flex items-center justify-between px-4 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${catObj.color}18` }}>
                        <Icon className="w-4 h-4" style={{ color: catObj.color }} />
                      </div>
                      <h2 className="text-base font-extrabold text-slate-900">{cat}</h2>
                      <span className="text-[10px] text-slate-400 font-semibold">({list.length})</span>
                    </div>
                    {!category && list.length > 4 && (
                      <button
                        onClick={() => setCategory(cat)}
                        className="text-xs font-semibold hover:underline" style={{ color: catObj.color }}>
                        View All
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-4">
                    {(category ? list : list.slice(0, 4)).map(item => (
                      <ClassifiedCard key={item.id} item={item} accent={catObj.color} />
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}

function ClassifiedCard({ item, accent }) {
  const image = item.images?.[0];
  return (
    <Link to={`/customer/classified/${item.id}`}
      data-testid={`classified-card-${item.id}`}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98]">
      <div className="aspect-square bg-slate-50 overflow-hidden relative">
        {image
          ? <img src={image} alt={item.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Tag className="w-10 h-10" style={{ color: `${accent}40` }} /></div>}
        {item.condition && (
          <span className="absolute top-2 left-2 text-[9px] font-bold bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ color: accent }}>
            {CONDITION_LABELS[item.condition] || item.condition}
          </span>
        )}
      </div>
      <div className="p-2.5">
        {item.price ? (
          <p className="text-base font-black text-slate-900 truncate">{formatCurrency(item.price)}</p>
        ) : (
          <p className="text-sm font-bold text-slate-500">Free</p>
        )}
        <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">{item.title}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400 truncate">
            <MapPin className="w-2.5 h-2.5" /> {item.locality}
          </span>
          <span className="text-[10px] text-slate-400">{item.created_at ? formatDate(item.created_at) : ''}</span>
        </div>
      </div>
    </Link>
  );
}
