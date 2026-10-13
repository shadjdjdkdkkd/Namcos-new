import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, MapPin, Phone, CheckCircle2, Truck, Package, Star } from 'lucide-react';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { toast } from 'sonner';
import api from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/format';
import DetailImageGallery from '@/components/shared/DetailImageGallery';

export default function AgricultureDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/agriculture/${id}`)
      .then(r => setItem(r.data))
      .catch(() => { toast.error('Listing not found'); navigate('/customer'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!item) return null;

  const phone = item.support_phone || item.category_support_phone || item.seller_phone || item.phone;
  const accent = '#16A34A';

  return (
    <div className="pb-28 animate-fade-in bg-slate-50 min-h-screen">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            data-testid="agriculture-back-btn"
            onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/customer')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-base font-extrabold text-slate-900 flex-1 truncate">{item.product_name}</h1>
          {item.is_organic && (
            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">Organic</span>
          )}
        </div>
      </div>

      <DetailImageGallery images={item.images} title={item.product_name} accent={accent} FallbackIcon={Leaf} />

      <div className="mx-4 -mt-6 bg-white rounded-2xl shadow-md border border-slate-100 p-4 mb-4 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{item.product_name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold" style={{ color: accent }}>{formatCurrency(item.price)}</p>
            <p className="text-xs text-slate-400">per {item.unit}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {item.is_organic && (
            <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200">
              <CheckCircle2 className="w-3 h-3" /> Organic
            </span>
          )}
          {item.pickup_available && (
            <span className="flex items-center gap-1 text-xs bg-slate-50 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
              <Package className="w-3 h-3" /> Pickup
            </span>
          )}
          {item.delivery_available && (
            <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
              <Truck className="w-3 h-3" /> Delivery
            </span>
          )}
          {item.bulk_available && (
            <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200">Bulk Orders</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500">{item.locality}, {item.city}</span>
        </div>

        {item.rating > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-sm font-bold text-slate-700">{item.rating}</span>
          </div>
        )}
      </div>

      <div className="mx-4 bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Product Details</h3>
        {item.description && <p className="text-sm text-slate-600 leading-relaxed mb-4">{item.description}</p>}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-slate-400 mb-0.5">Available Qty</p>
            <p className="font-semibold text-slate-800">{item.available_quantity} {item.unit}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-slate-400 mb-0.5">Min Order</p>
            <p className="font-semibold text-slate-800">{item.min_quantity} {item.unit}</p>
          </div>
          {item.availability && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 mb-0.5">Status</p>
              <p className="font-semibold text-slate-800 capitalize">{item.availability}</p>
            </div>
          )}
          {item.harvest_date && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 mb-0.5">Harvest Date</p>
              <p className="font-semibold text-slate-800">{item.harvest_date}</p>
            </div>
          )}
          {item.quality_info && (
            <div className="bg-slate-50 rounded-xl p-3 col-span-2">
              <p className="text-slate-400 mb-0.5">Quality Info</p>
              <p className="font-semibold text-slate-800">{item.quality_info}</p>
            </div>
          )}
          {item.storage_info && (
            <div className="bg-slate-50 rounded-xl p-3 col-span-2">
              <p className="text-slate-400 mb-0.5">Storage</p>
              <p className="font-semibold text-slate-800">{item.storage_info}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mx-4 bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Seller</h3>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{item.seller_name || 'Verified Seller'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{item.locality}, {item.city}</p>
            {item.created_at && <p className="text-xs text-slate-400 mt-0.5">Listed {formatDate(item.created_at)}</p>}
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed border-t border-slate-50 pt-3">
          Tap "Call to Order" — our support team will connect you with the verified seller.
        </p>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
        <div className="pointer-events-auto max-w-[480px] mx-auto">
          <a href={phone ? `tel:${phone}` : undefined}
            data-testid="agriculture-cta-btn"
            onClick={e => { if (!phone) { e.preventDefault(); toast.info('Support number will be shown here'); } }}
            className="flex items-center justify-center gap-2 w-full h-14 text-white font-bold text-base rounded-2xl shadow-lg transition-colors"
            style={{ background: accent }}>
            <Phone className="w-5 h-5" /> Call to Order
          </a>
        </div>
      </div>
    </div>
  );
}
