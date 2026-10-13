import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, getStatusColor, getStatusLabel } from '@/utils/format';
import { SkeletonList } from '@/components/shared/SkeletonCard';
import EmptyState from '@/components/shared/EmptyState';
import { MERCHANT } from '@/constants/testIds';

export default function MerchantProducts() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', category: '', price: '', sale_price: '', unit: 'piece',
    stock: '', description: '', store_id: '', availability: 'in_stock',
  });

  useEffect(() => {
    fetchProducts();
    api.get('/merchant/stores').then(r => setStores(r.data)).catch(() => {});
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/merchant/products', { params: search ? { search } : {} });
      setProducts(data);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.store_id) { toast.error('Fill required fields'); return; }
    setFormLoading(true);
    try {
      const payload = {
        ...form, price: parseFloat(form.price),
        sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
        stock: parseInt(form.stock) || 0,
      };
      if (editing) {
        await api.put(`/merchant/products/${editing}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/merchant/products', payload);
        toast.success('Product created');
      }
      setShowForm(false); setEditing(null);
      setForm({ name: '', category: '', price: '', sale_price: '', unit: 'piece', stock: '', description: '', store_id: stores[0]?.id || '', availability: 'in_stock' });
      fetchProducts();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try { await api.delete(`/merchant/products/${id}`); toast.success('Product deleted'); fetchProducts(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const openEdit = (product) => {
    setEditing(product.id);
    setForm({ name: product.name, category: product.category || '', price: product.price?.toString() || '',
      sale_price: product.sale_price?.toString() || '', unit: product.unit || 'piece',
      stock: product.stock?.toString() || '', description: product.description || '',
      store_id: product.store_id || stores[0]?.id || '', availability: product.availability || 'in_stock' });
    setShowForm(true);
  };

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">{products.length} products</p>
        </div>
        <Button data-testid={MERCHANT.addProductBtn} onClick={() => { setEditing(null); setForm({ name: '', category: '', price: '', sale_price: '', unit: 'piece', stock: '', description: '', store_id: stores[0]?.id || '', availability: 'in_stock' }); setShowForm(true); }}
          className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search products..." value={search}
          onChange={e => { setSearch(e.target.value); setTimeout(fetchProducts, 300); }}
          className="pl-9 rounded-xl border-slate-200" />
      </div>

      {loading ? <SkeletonList count={4} /> :
        products.length === 0 ? (
          <EmptyState type="search" title="No products yet" description="Add your first product to start selling"
            action={() => setShowForm(true)} actionLabel="Add Product" icon={Package} />
        ) : (
          <div data-testid={MERCHANT.productsTable} className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Product', 'Category', 'Price', 'Stock', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((product, i) => (
                  <tr key={product.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 max-w-[160px] truncate">{product.name}</p>
                          <p className="text-xs text-slate-400">{product.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">{product.category || '—'}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-slate-800">{formatCurrency(product.sale_price || product.price)}</p>
                      {product.sale_price && <p className="text-xs text-slate-400 line-through">{formatCurrency(product.price)}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-sm font-medium ${product.stock <= (product.low_stock_threshold || 5) ? 'text-red-600' : 'text-slate-700'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${getStatusColor(product.availability)}`}>
                        {getStatusLabel(product.availability)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(product)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{editing ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Store *</label>
                <select value={form.store_id} onChange={e => set('store_id', e.target.value)}
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm bg-white focus:outline-none focus:border-[#0F4C3A]">
                  <option value="">Select store</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.business_name}</option>)}
                </select>
              </div>
              <Input placeholder="Product Name *" value={form.name} onChange={e => set('name', e.target.value)} className="rounded-xl border-slate-200 focus:border-[#0F4C3A]" />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Category" value={form.category} onChange={e => set('category', e.target.value)} className="rounded-xl border-slate-200" />
                <Input placeholder="Unit (kg/piece/etc.)" value={form.unit} onChange={e => set('unit', e.target.value)} className="rounded-xl border-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Price (₹) *" type="number" value={form.price} onChange={e => set('price', e.target.value)} className="rounded-xl border-slate-200" />
                <Input placeholder="Sale Price (₹)" type="number" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} className="rounded-xl border-slate-200" />
              </div>
              <Input placeholder="Stock Quantity" type="number" value={form.stock} onChange={e => set('stock', e.target.value)} className="rounded-xl border-slate-200" />
              <textarea placeholder="Description" value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0F4C3A] resize-none" />
              <div className="flex gap-3 pt-2">
                <Button type="button" onClick={() => setShowForm(false)} variant="outline" className="flex-1 rounded-xl">Cancel</Button>
                <Button type="submit" disabled={formLoading} className="flex-1 rounded-xl bg-[#0F4C3A] hover:bg-[#0a3829] text-white">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
