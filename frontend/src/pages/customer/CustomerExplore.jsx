import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Star, MapPin, X, Store, Leaf, Wrench, Tag, Phone } from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/format';

const CATEGORY_TABS = [
  { value: '', label: 'All' },
  { value: 'shops', label: 'Shops', icon: Store, color: '#0F4C3A' },
  { value: 'services', label: 'Services', icon: Wrench, color: '#2563EB' },
  { value: 'agriculture', label: 'Agriculture', icon: Leaf, color: '#16A34A' },
  { value: 'classifieds', label: 'Classifieds', icon: Tag, color: '#7C3AED' },
];

const SECTIONS = [
  { key: 'stores', title: 'Shops', endpoint: '/stores', route: 'shops', color: '#0F4C3A', icon: Store, viewAllSlug: 'shops' },
  { key: 'services', title: 'Services', endpoint: '/services', route: 'services', color: '#2563EB', icon: Wrench, viewAllSlug: 'services' },
  { key: 'agriculture', title: 'Agriculture', endpoint: '/agriculture', route: 'agriculture', color: '#16A34A', icon: Leaf, viewAllSlug: 'agriculture' },
  { key: 'classifieds', title: 'Classifieds', endpoint: '/classifieds', route: 'classifieds', color: '#7C3AED', icon: Tag, viewAllSlug: 'classifieds' },
];

const TAB_TO_KEY = { shops: 'stores', services: 'services', agriculture: 'agriculture', classifieds: 'classifieds' };

export default function CustomerExplore() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState(searchParams.get('type') || '');
  const [data, setData] = useState({ stores: [], services: [], agriculture: [], classifieds: [] });
  const [loading, setLoading] = useState(true);
  const [locality] = useState(() => localStorage.getItem('namcos_locality') || '');

  const fetchAll = useCallback(async (q, tab) => {
    setLoading(true);
    const params = { limit: 10 };
    if (locality) params.locality = locality;
    if (q) params.search = q;

    const targets = tab
      ? SECTIONS.filter(s => s.key === TAB_TO_KEY[tab])
      : SECTIONS;

    const results = await Promise.allSettled(
      targets.map(s => api.get(s.endpoint, { params }))
    );

    const next = { stores: [], services: [], agriculture: [], classifieds: [] };
    targets.forEach((s, i) => {
      if (results[i].status === 'fulfilled') {
        next[s.key] = results[i].value.data || [];
      }
    });
    setData(next);
    setLoading(false);
  }, [locality]);

  useEffect(() => { fetchAll(query, activeTab); /* eslint-disable-next-line */ }, [activeTab, locality]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams({ ...(query ? { q: query } : {}), ...(activeTab ? { type: activeTab } : {}) });
    fetchAll(query, activeTab);
  };

  const totalCount = Object.values(data).reduce((n, arr) => n + arr.length, 0);
  const visibleSections = activeTab
    ? SECTIONS.filter(s => s.key === TAB_TO_KEY[activeTab])
    : SECTIONS.filter(s => data[s.key]?.length > 0);

  return (
    <div className="pb-24 animate-fade-in bg-slate-50 min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 pt-4 pb-3 shadow-sm">
        <form onSubmit={handleSearch} className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            data-testid="explore-search-input"
            type="text" placeholder="Search shops, services, produce..."
            value={query} onChange={e => setQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-[#0F4C3A] focus:bg-white transition-all"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); fetchAll('', activeTab); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </form>
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.value || 'all'}
              data-testid={`explore-tab-${tab.value || 'all'}`}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeTab === tab.value
                  ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#0F4C3A]/40'
              }`}
            >
              {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Location context */}
      {locality && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-[#0F4C3A]/6 rounded-xl px-3 py-2">
          <MapPin className="w-3.5 h-3.5 text-[#0F4C3A] flex-shrink-0" />
          <p className="text-xs text-[#0F4C3A] font-semibold">Showing near <strong>{locality}</strong></p>
        </div>
      )}

      {loading ? (
        <div className="p-4 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-3" />
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 3 }).map((__, j) => <div key={j} className="flex-shrink-0 w-44 h-44 bg-white rounded-2xl animate-pulse" />)}
              </div>
            </div>
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className="pt-12">
          <EmptyState type="search"
            title={query ? 'No results found' : (locality ? `Nothing near ${locality} yet` : 'Nothing to show yet')}
            description={query ? 'Try different keywords or clear filters.' : 'Check again soon — new listings are added every day.'}
            action={query ? () => { setQuery(''); setActiveTab(''); fetchAll('', ''); } : undefined}
            actionLabel={query ? 'Clear Search' : undefined}
          />
        </div>
      ) : (
        <div className="pt-2">
          {visibleSections.map(section => {
            const items = data[section.key] || [];
            if (!items.length) return null;
            return (
              <section key={section.key} className="pt-5">
                <div className="flex items-center justify-between px-4 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${section.color}14` }}>
                      <section.icon className="w-4 h-4" style={{ color: section.color }} />
                    </div>
                    <h2 className="text-base font-extrabold text-slate-900">{section.title}</h2>
                  </div>
                  <button
                    data-testid={`explore-viewall-${section.key}`}
                    onClick={() => navigate(`/customer/category/${section.viewAllSlug}`)}
                    className="text-xs font-semibold flex items-center gap-0.5 hover:underline"
                    style={{ color: section.color }}
                  >
                    View All <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
                  {items.map(item => <SectionCard key={item.id} item={item} section={section} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionCard({ item, section }) {
  const detailRoutes = {
    stores: `/customer/store/${item.id}`,
    services: `/customer/service/${item.id}`,
    agriculture: `/customer/agriculture/${item.id}`,
    classifieds: `/customer/classified/${item.id}`,
  };
  const title = item.business_name || item.product_name || item.service_name || item.title || '—';
  const subtitle = item.category || item.locality || '';
  const price = item.price ? formatCurrency(item.price)
    : item.starting_price ? `From ${formatCurrency(item.starting_price)}`
    : null;
  const image = item.images?.[0] || item.logo;
  const Icon = section.icon;

  return (
    <Link to={detailRoutes[section.key]}
      data-testid={`explore-item-${item.id}`}
      className="flex-shrink-0 w-44 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
      <div className="h-24 flex items-center justify-center overflow-hidden" style={{ backgroundColor: `${section.color}08` }}>
        {image
          ? <img src={image} alt={title} className="h-full w-full object-cover" />
          : <Icon className="w-9 h-9" style={{ color: `${section.color}40` }} />
        }
      </div>
      <div className="p-3">
        <p className="text-sm font-bold text-slate-800 truncate">{title}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="text-[11px] text-slate-500 truncate">{subtitle}</span>
        </div>
        {price && <p className="text-sm font-bold mt-1 truncate" style={{ color: section.color }}>{price}</p>}
        {item.rating > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[11px] font-semibold text-slate-600">{item.rating}</span>
          </div>
        )}
        {section.key === 'services' && (item.phone || item.support_phone) && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 font-medium">
            <Phone className="w-3 h-3" /> Call to Book
          </div>
        )}
      </div>
    </Link>
  );
}
