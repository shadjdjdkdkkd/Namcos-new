import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, ChevronRight, Star, MapPin, Clock, Store, Leaf, Wrench, Tag,
  ShoppingBag, Heart, Home as HomeIcon, Grid3X3, Phone,
  Building, Plus
} from 'lucide-react';
import CustomerHeader from '@/components/customer/CustomerHeader';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import DiscountBadge from '@/components/shared/DiscountBadge';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/format';
import { CUSTOMER } from '@/constants/testIds';

// Icon map for dynamic categories from API
const ICON_MAP = {
  Store, Leaf, Wrench, Tag, ShoppingBag, Heart, HomeIcon, Grid3X3,
  Building, Phone, Plus, MapPin, Clock, Star,
  UtensilsCrossed: ShoppingBag, Home: HomeIcon,
};

const LIST_ITEMS = [
  { icon: Store, title: 'Register Your Business', desc: 'Shops, restaurants, any store', color: '#0F4C3A', type: 'store' },
  { icon: Leaf, title: 'Sell Agriculture', desc: 'Fresh produce, crops, dairy', color: '#16A34A', type: 'agriculture' },
  { icon: Wrench, title: 'Offer a Service', desc: 'Electrician, plumber, cleaning', color: '#2563EB', type: 'service' },
  { icon: Tag, title: 'Post a Classified', desc: 'Vehicles, jobs, real estate', color: '#7C3AED', type: 'classified' },
];

function BannerCarousel({ banners }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef();

  useEffect(() => {
    if (banners.length < 2) return;
    timerRef.current = setInterval(() => setActive(a => (a + 1) % banners.length), 4000);
    return () => clearInterval(timerRef.current);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[active];

  return (
    <div data-testid="home-banner" className="mx-4 mt-4 relative overflow-hidden rounded-2xl aspect-video bg-gradient-to-br from-[#0F4C3A] to-[#1a6b55] shadow-md">
      {b.image_url ? (
        <img src={b.image_url} alt={b.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : null}
      {banners.length > 1 && (
        <div className="absolute bottom-2 right-3 flex gap-1">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`rounded-full transition-all ${i === active ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function StoreCard({ store }) {
  return (
    <Link to={`/customer/store/${store.id}`} data-testid={CUSTOMER.storeCard}
      className="flex-shrink-0 w-44 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
      <div className="relative h-24 bg-gradient-to-br from-[#0F4C3A]/8 to-[#0F4C3A]/4 flex items-center justify-center">
        <DiscountBadge percent={store.discount_percent} />
        {store.logo
          ? <img src={store.logo} alt={store.business_name} className="h-full w-full object-cover" />
          : <Store className="w-10 h-10 text-[#0F4C3A]/25" />
        }
      </div>
      <div className="p-3">
        <p className="text-sm font-bold text-slate-800 truncate">{store.business_name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500 truncate">{store.locality}</span>
        </div>
        {store.service_radius > 0 && (
          <span className="text-[10px] text-slate-400">Within {store.service_radius}km</span>
        )}
        {store.rating > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-xs font-semibold text-slate-600">{store.rating}</span>
            <span className="text-xs text-slate-400">({store.review_count})</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function AgricultureCard({ item }) {
  return (
    <Link to={`/customer/agriculture/${item.id}`}
      className="flex-shrink-0 w-36 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all active:scale-95">
      <div className="h-20 bg-gradient-to-br from-green-50 to-lime-50 flex items-center justify-center">
        <Leaf className="w-8 h-8 text-green-500/40" />
      </div>
      <div className="p-2.5">
        <p className="text-xs font-bold text-slate-800 truncate">{item.product_name}</p>
        <p className="text-xs text-slate-500 truncate">{item.locality}</p>
        <p className="text-sm font-bold text-[#0F4C3A] mt-1">{formatCurrency(item.price)}<span className="text-xs font-normal text-slate-400">/{item.unit}</span></p>
        {item.is_organic && <span className="mt-1 inline-block text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Organic</span>}
      </div>
    </Link>
  );
}

function ServiceCard({ item }) {
  const navigate = useNavigate();
  const phone = item.phone || item.support_phone;
  return (
    <div
      onClick={() => navigate(`/customer/service/${item.id}`)}
      className="flex-shrink-0 w-44 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all active:scale-95 cursor-pointer">
      <div className="h-20 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <Wrench className="w-8 h-8 text-blue-400/40" />
      </div>
      <div className="p-3">
        <p className="text-xs font-bold text-slate-800 truncate">{item.service_name}</p>
        <p className="text-xs text-slate-500 truncate">{item.category}</p>
        <p className="text-sm font-bold text-[#0F4C3A] mt-1">From {formatCurrency(item.starting_price)}</p>
        {phone && (
          <button
            onClick={e => { e.stopPropagation(); window.location.href = `tel:${phone}`; }}
            className="mt-2 flex items-center gap-1 text-[10px] text-blue-600 font-medium hover:underline">
            <Phone className="w-3 h-3" /> Call to Book
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, viewAllLink }) {
  return (
    <div className="flex items-center justify-between px-4 mb-3">
      <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
      <Link to={viewAllLink} className="text-xs text-[#0F4C3A] font-semibold flex items-center gap-0.5 hover:underline">
        View All <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

export default function CustomerHome() {
  const navigate = useNavigate();
  const [locality, setLocality] = useState(() => localStorage.getItem('namcos_locality') || '');
  const [km, setKm] = useState(() => parseInt(localStorage.getItem('namcos_km') || '20'));
  const [search, setSearch] = useState('');
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [agriculture, setAgriculture] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, [locality]);

  const fetchAll = async () => {
    setLoading(true);
    const params = locality ? { locality, limit: 8 } : { limit: 8 };
    try {
      const [bannerRes, catRes, storeRes, agriRes, svcRes] = await Promise.allSettled([
        api.get('/banners'),
        api.get('/categories'),
        api.get('/stores', { params }),
        api.get('/agriculture', { params: { ...params, limit: 6 } }),
        api.get('/services', { params: { ...params, limit: 6 } }),
      ]);
      if (bannerRes.status === 'fulfilled') setBanners(bannerRes.value.data || []);
      if (catRes.status === 'fulfilled') setCategories((catRes.value.data || []).filter(c => c.is_active));
      if (storeRes.status === 'fulfilled') setStores(storeRes.value.data || []);
      if (agriRes.status === 'fulfilled') setAgriculture(agriRes.value.data || []);
      if (svcRes.status === 'fulfilled') setServices(svcRes.value.data || []);
    } catch {}
    setLoading(false);
  };

  const handleLocationChange = (loc) => {
    setLocality(loc);
    localStorage.setItem('namcos_locality', loc);
  };

  const handleKmChange = (k) => {
    setKm(k);
    localStorage.setItem('namcos_km', String(k));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/customer/explore?q=${encodeURIComponent(search)}`);
  };

  const getCategoryIcon = (iconName) => ICON_MAP[iconName] || Store;

  return (
    <div data-testid={CUSTOMER.homeContainer} className="pb-24 animate-fade-in bg-slate-50 min-h-screen">
      <CustomerHeader locality={locality} onLocationChange={handleLocationChange} km={km} onKmChange={handleKmChange} />

      {/* Banner */}
      <BannerCarousel banners={banners} />

      {/* Search Bar */}
      <div className="px-4 mt-4">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input data-testid={CUSTOMER.searchBar} type="text"
              placeholder="Search shops, services, products..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-[#0F4C3A] shadow-sm transition-all" />
          </div>
        </form>
      </div>

      {/* Category Icons (from API + dynamic) */}
      <section className="px-4 pt-4">
        <div data-testid={CUSTOMER.categoryGrid}
          className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
          {(categories.length > 0 ? categories : [
            { slug: 'shops', name: 'Shops', icon: 'Store', color: '#0F4C3A' },
            { slug: 'services', name: 'Services', icon: 'Wrench', color: '#2563EB' },
            { slug: 'agriculture', name: 'Agriculture', icon: 'Leaf', color: '#16A34A' },
            { slug: 'classifieds', name: 'Classifieds', icon: 'Tag', color: '#7C3AED' },
            { slug: 'food', name: 'Food', icon: 'ShoppingBag', color: '#EA580C' },
            { slug: 'health', name: 'Health', icon: 'Heart', color: '#DB2777' },
            { slug: 'home', name: 'Home', icon: 'HomeIcon', color: '#0891B2' },
          ]).map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            return (
              <button key={cat.slug}
                onClick={() => navigate(`/customer/category/${cat.slug}`)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 py-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all active:scale-95">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: `${cat.color}14` }}>
                  {cat.image_url
                    ? <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                    : <Icon className="w-5 h-5" style={{ color: cat.color }} />}
                </div>
                <span className="text-[10px] font-bold text-slate-600 text-center leading-tight px-1">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Location Context Banner */}
      {locality && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-[#0F4C3A]/6 rounded-xl px-3 py-2">
          <MapPin className="w-3.5 h-3.5 text-[#0F4C3A] flex-shrink-0" />
          <p className="text-xs text-[#0F4C3A] font-semibold">
            Showing results in <strong>{locality}</strong> within {km}km
          </p>
        </div>
      )}

      {/* Nearby Shops */}
      <section className="pt-5">
        <SectionHeader title={locality ? `Shops in ${locality}` : 'Nearby Shops'} viewAllLink="/customer/category/shops" />
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex-shrink-0 w-44 h-44 bg-white rounded-2xl border border-slate-100 animate-pulse" />)
            : stores.length === 0
              ? <p className="text-sm text-slate-400 py-4 px-1">No shops found{locality ? ` in ${locality}` : ''}. Try a different location.</p>
              : stores.map(s => <StoreCard key={s.id} store={s} />)
          }
        </div>
      </section>

      {/* Services */}
      <section className="pt-5">
        <SectionHeader title={locality ? `Services in ${locality}` : 'Available Services'} viewAllLink="/customer/category/services" />
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex-shrink-0 w-44 h-40 bg-white rounded-2xl border border-slate-100 animate-pulse" />)
            : services.length === 0
              ? <p className="text-sm text-slate-400 py-4 px-1">No services found{locality ? ` in ${locality}` : ''}.</p>
              : services.map(s => <ServiceCard key={s.id} item={s} />)
          }
        </div>
      </section>

      {/* Fresh from Farms */}
      {(loading || agriculture.length > 0) && (
        <section className="pt-5">
          <SectionHeader title="Fresh from Farms" viewAllLink="/customer/category/agriculture" />
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex-shrink-0 w-36 h-36 bg-white rounded-2xl border border-slate-100 animate-pulse" />)
              : agriculture.map(item => <AgricultureCard key={item.id} item={item} />)
            }
          </div>
        </section>
      )}

      {/* List My Store / Sell */}
      <section className="mx-4 mt-6 mb-2">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
          <div className="mb-4">
            <h2 className="text-base font-extrabold text-slate-900">Grow Your Business</h2>
            <p className="text-xs text-slate-500 mt-0.5">Join thousands of local sellers on NAMCOS</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {LIST_ITEMS.map(({ icon: Icon, title, desc, color, type }) => (
              <button key={type}
                onClick={() => navigate(`/customer/register-merchant?type=${type}`)}
                data-testid={`list-${type}-btn`}
                className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-white hover:shadow-sm transition-all text-left">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${color}15` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
