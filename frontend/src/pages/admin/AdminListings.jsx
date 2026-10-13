import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Leaf, Wrench, Tag, Search, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { formatDate, getStatusColor, getStatusLabel, formatCurrency } from '@/utils/format';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import Pagination from '@/components/shared/Pagination';
import { ADMIN } from '@/constants/testIds';

const LISTING_TYPES = [
  { value: 'agriculture', label: 'Agriculture', icon: Leaf, color: '#16A34A' },
  { value: 'services', label: 'Services', icon: Wrench, color: '#2563EB' },
  { value: 'classifieds', label: 'Classifieds', icon: Tag, color: '#7C3AED' },
];
const STATUS_TABS = [
  { value: 'submitted', label: 'Pending Review' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];
const KIND_MAP = { agriculture: 'agriculture', services: 'service', classifieds: 'classified' };
const LIMIT = 15;

export default function AdminListings() {
  const [type, setType] = useState('agriculture');
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { skip: (page - 1) * LIMIT, limit: LIMIT };
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;
    try {
      const [listRes, countRes] = await Promise.all([
        api.get(`/admin/listings/${type}`, { params }),
        api.get(`/admin/listings-count/${type}`, { params: { status: statusFilter || undefined, search: search || undefined } }),
      ]);
      setItems(listRes.data);
      setTotal(countRes.data.total ?? listRes.data.length);
    } catch { setItems([]); }
    setLoading(false);
  }, [type, statusFilter, search, page]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const handleAction = async (id, status) => {
    setActionLoading(id);
    try {
      await api.put(`/admin/listings/${type}/${id}/status`, { status });
      toast.success(`Listing ${status}`);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setActionLoading(''); }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const payload = {
        description: edit.description,
        price: edit.price !== '' && edit.price != null ? parseFloat(edit.price) : undefined,
        status: edit.status,
      };
      if (edit.product_name != null) payload.product_name = edit.product_name;
      if (edit.service_name != null) payload.service_name = edit.service_name;
      if (edit.title != null) payload.title = edit.title;
      await api.put(`/admin/edit/${KIND_MAP[type]}/${edit.id}`, payload);
      toast.success('Listing updated');
      setEdit(null);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setSaving(false);
  };

  const getTitle = (item) => item.product_name || item.service_name || item.title || '—';
  const getSub = (item) => item.seller_name || item.provider_name || item.category || '';
  const nameField = type === 'agriculture' ? 'product_name' : type === 'services' ? 'service_name' : 'title';

  return (
    <div data-testid={ADMIN.listingsTable} className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Listings Moderation</h1>
        <p className="text-sm text-slate-500 mt-0.5">Review, edit & approve agriculture, services & classifieds</p>
      </div>

      <div className="flex gap-2 mb-4">
        {LISTING_TYPES.map(t => (
          <button key={t.value} onClick={() => { setType(t.value); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              type === t.value ? 'border-[#0F4C3A] bg-[#0F4C3A] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {STATUS_TABS.map(t => (
            <button key={t.value} onClick={() => { setStatusFilter(t.value); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                statusFilter === t.value ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search listings..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 rounded-xl border-slate-200 bg-white" />
        </div>
      </div>

      {loading ? <SkeletonList count={4} /> :
        items.length === 0 ? (
          <EmptyState type={type} title="No listings found" description={`No ${statusFilter || ''} ${type} listings`} />
        ) : (
          <>
            <div className="grid gap-3">
              {items.map(item => (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: `${LISTING_TYPES.find(t => t.value === type)?.color}15` }}>
                    {item.images?.[0]
                      ? <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                      : React.createElement(LISTING_TYPES.find(t => t.value === type)?.icon || Leaf,
                        { className: 'w-5 h-5', style: { color: LISTING_TYPES.find(t => t.value === type)?.color } })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{getTitle(item)}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                      <span>{getSub(item)}</span>
                      <span>{item.locality || item.city || ''}</span>
                      {item.price && <span className="font-semibold text-[#0F4C3A]">{formatCurrency(item.price)}/{item.unit || 'unit'}</span>}
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                    {item.description && <p className="text-xs text-slate-400 mt-1 truncate">{item.description}</p>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${getStatusColor(item.status)}`}>
                    {getStatusLabel(item.status)}
                  </span>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setEdit({ ...item, price: item.price ?? '' })} data-testid={`listing-edit-${item.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                      <Pencil className="w-3.5 h-3.5" /> View / Edit
                    </button>
                    {item.status === 'submitted' && (
                      <>
                        <button onClick={() => handleAction(item.id, 'published')} disabled={actionLoading === item.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => handleAction(item.id, 'rejected')} disabled={actionLoading === item.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} onPageChange={setPage} loading={loading} />
          </>
        )}

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Edit Listing</h3>
              <button onClick={() => setEdit(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {edit.images?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {edit.images.map((img, i) => <img key={i} src={img} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-slate-200" />)}
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Title</label>
                <Input value={edit[nameField] || ''} onChange={e => setEdit({ ...edit, [nameField]: e.target.value })} className="rounded-xl border-slate-200" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Price</label>
                <Input type="number" value={edit.price} onChange={e => setEdit({ ...edit, price: e.target.value })} className="rounded-xl border-slate-200" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Description</label>
                <textarea value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0F4C3A] resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                <select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm bg-white">
                  {['submitted', 'published', 'rejected', 'suspended'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEdit(null)}>Cancel</Button>
                <Button onClick={saveEdit} disabled={saving} data-testid="listing-save-edit"
                  className="flex-1 bg-[#0F4C3A] hover:bg-[#0a3829] text-white">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
