import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Phone, MapPin, Star, Search,
  Store, Leaf, Wrench, Tag, ShoppingBag, Heart, Home as HomeIcon, Grid3X3,
  ShoppingCart, Gem, Cpu, Shirt, Pill, Cake, Hammer, BookOpen, Smartphone, Footprints, Sofa, Gift
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/shared/Pagination';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import DiscountBadge from '@/components/shared/DiscountBadge';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/format';

const ICON_MAP = { Store, Leaf, Wrench, Tag, ShoppingBag, Heart, Home: HomeIcon, HomeIcon, Grid3X3 };

const SUBCAT_ICONS = [
  { kw: ['grocery', 'supermarket', 'provision', 'mart', 'kirana'], icon: ShoppingCart },
  { kw: ['jewel', 'gold', 'silver', 'gem', 'watch'], icon: Gem },
  { kw: ['electronic', 'appliance', 'computer', 'laptop', 'camera'], icon: Cpu },
  { kw: ['fashion', 'cloth', 'wear', 'boutique', 'saree', 'tailor', 'ethnic'], icon: Shirt },
  { kw: ['pharmac', 'medical', 'chemist', 'medicine', 'health'], icon: Pill },
  { kw: ['bakery', 'sweet', 'cake', 'confection', 'chocolate'], icon: Cake },
  { kw: ['hardware', 'tool', 'paint', 'sanitary', 'building'], icon: Hammer },
  { kw: ['station', 'book', 'print'], icon: BookOpen },
  { kw: ['mobile', 'phone', 'accessor', 'sim'], icon: Smartphone },
  { kw: ['footwear', 'shoe', 'sandal'], icon: Footprints },
  { kw: ['furniture', 'decor', 'mattress', 'sofa'], icon: Sofa },
  { kw: ['gift', 'toy'], icon: Gift },
];
function subcatIcon(name = '') {
  const n = name.toLowerCase();
  for (const m of SUBCAT_ICONS) if (m.kw.some(k => n.includes(k))) return m.icon;
  return Tag;
}

const CATEGORY_DEFAULTS = {
  shops: { title: 'Shops', icon: Store, color: '#0F4C3A', type: 'store' },
  services: { title: 'Services', icon: Wrench, color: '#2563EB', type: 'service' },
  agriculture: { title: 'Agriculture', icon: Leaf, color: '#16A34A', type: 'agriculture' },
  classifieds: { title: 'Classifieds', icon: Tag, color: '#7C3AED', type: 'classified' },
  food: { title: 'Food', icon: ShoppingBag, color: '#EA580C', type: 'store' },
  health: { title: 'Health', icon: Heart, color: '#DB2777', type: 'store' },
  home: { title: 'Home', icon: HomeIcon, color: '#0891B2', type: 'store' },
};

const LIMIT = 12;

export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState(CATEGORY_DEFAULTS[slug]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [subcats, setSubcats] = useState([]);
  const [activeSub, setActiveSub] = useState('');
  const [locality] = useState(() => localStorage.getItem('namcos_locality') || '');

  useEffect(() => {
    api.get('/subcategories', { params: { category: slug } })
      .then(r => setSubcats(r.data)).catch(() => setSubcats([]));
    setActiveSub('');
  }, [slug]);

  useEffect(() => {
    // Load category info from API
    api.get('/categories').then(r => {
      const cat = r.data.find(c => c.slug === slug);
      if (cat) setCategory({ title: cat.name, icon: ICON_MAP[cat.icon] || Store, color: cat.color, support_phone: cat.support_phone, type: cat.service_type });
    }).catch(() => {});
  }, [slug]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const type = CATEGORY_DEFAULTS[slug]?.type || 'store';
    const params = { skip: (page - 1) * LIMIT, limit: LIMIT };
    if (locality) params.locality = locality;
    if (search) params.search = search;
    if (activeSub) params.subcategory = activeSub;
    params.status = 'published';
    try {
      let endpoint = '/stores';
      if (type === 'agriculture') endpoint = '/agriculture';
      else if (type === 'service') endpoint = '/services';
      else if (type === 'classified') endpoint = '/classifieds';
      // For store types, filter by category slug only if not a generic type
      else if (!['shops','food','health','home'].includes(slug)) params.category = slug;

      const { data } = await api.get(endpoint, { params });
      const list = Array.isArray(data) ? data : data.items || [];
      setItems(list);
      setTotal(data.total || list.length);
    } catch { setItems([]); }
    setLoading(false);
  }, [slug, page, search, locality, activeSub]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const cat = category || CATEGORY_DEFAULTS[slug] || { title: slug, icon: Store, color: '#0F4C3A' };
  const Icon = cat.icon || Store;

  return (
    <div className="pb-24 animate-fade-in bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}15` }}>
            <Icon className="w-4.5 h-4.5" style={{ color: cat.color }} />
          </div>
          <h1 className="text-base font-extrabold text-slate-900 flex-1">{cat.title}</h1>
          {cat.support_phone && (
            <a href={`tel:${cat.support_phone}`}
              className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-green-100 transition-colors">
              <Phone className="w-3.5 h-3.5" /> Call Support
            </a>
          )}
        </div>
        {/* Search */}
        <div className="px-4 pb-3 relative">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder={`Search ${cat.title.toLowerCase()}...`}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4C3A] transition-all" />
        </div>
        {subcats.length > 0 && (
          <div className="px-4 pb-3">
            <div data-testid="subcategory-box" className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
              <button onClick={() => { setActiveSub(''); setPage(1); }} data-testid="subcat-all"
                className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 group">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${activeSub === '' ? 'bg-[#0F4C3A] border-[#0F4C3A] text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 group-hover:border-[#0F4C3A]'}`}>
                  <Grid3X3 className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-bold text-center leading-tight ${activeSub === '' ? 'text-[#0F4C3A]' : 'text-slate-500'}`}>All</span>
              </button>
              {subcats.map(s => {
                const SIcon = subcatIcon(s.name);
                const isActive = activeSub === s.name;
                return (
                  <button key={s.id} data-testid={`subcat-${s.slug}`} onClick={() => { setActiveSub(s.name); setPage(1); }}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 group">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${isActive ? 'bg-[#0F4C3A] border-[#0F4C3A] text-white shadow-md' : 'bg-white border-slate-200 text-[#0F4C3A] group-hover:border-[#0F4C3A] group-hover:shadow-sm'}`}>
                      <SIcon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold text-center leading-tight line-clamp-2 ${isActive ? 'text-[#0F4C3A]' : 'text-slate-500'}`}>{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-3">
        {locality && (
          <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Showing in <strong>{locality}</strong>
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Nothing found" description={`No ${cat.title.toLowerCase()} found${locality ? ` in ${locality}` : ''}. Try a different location.`} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {items.map(item => (
                <ItemCard key={item.id} item={item} slug={slug} catColor={cat.color} />
              ))}
            </div>
            <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} onPageChange={setPage} loading={loading} />
          </>
        )}
      </div>
    </div>
  );
}

const DETAIL_ROUTES = {
  store: (id) => `/customer/store/${id}`,
  agriculture: (id) => `/customer/agriculture/${id}`,
  service: (id) => `/customer/service/${id}`,
  classified: (id) => `/customer/classified/${id}`,
};

function ItemCard({ item, slug, catColor }) {
  const type = CATEGORY_DEFAULTS[slug]?.type || 'store';
  const title = item.business_name || item.product_name || item.service_name || item.title || '—';
  const sub = item.locality || item.category || item.seller_name || '';
  const price = item.price ? formatCurrency(item.price) : item.starting_price ? `From ${formatCurrency(item.starting_price)}` : null;
  const link = (DETAIL_ROUTES[type] || DETAIL_ROUTES.store)(item.id);
  const phone = item.phone || item.support_phone;

  return (
    <Link to={link} data-testid={`item-card-${item.id}`}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
      <div className="relative h-24 flex items-center justify-center" style={{ backgroundColor: `${catColor}08` }}>
        {type === 'store' && <DiscountBadge percent={item.discount_percent} />}
        {item.logo || item.image || item.images?.[0]
          ? <img src={item.logo || item.image || item.images[0]} alt={title} className="h-full w-full object-cover" />
          : <Store className="w-8 h-8" style={{ color: `${catColor}40` }} />
        }
      </div>
      <div className="p-3">
        <p className="text-xs font-bold text-slate-800 truncate">{title}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>}
        {price && <p className="text-sm font-bold mt-1 truncate" style={{ color: catColor }}>{price}</p>}
        {item.rating > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-xs text-slate-600">{item.rating}</span>
          </div>
        )}
        {phone && type === 'service' && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${phone}`; }}
            className="mt-2 flex items-center gap-1 text-[10px] text-blue-600 font-medium hover:underline">
            <Phone className="w-3 h-3" /> Call to Book
          </button>
        )}
      </div>
    </Link>
  );
}
