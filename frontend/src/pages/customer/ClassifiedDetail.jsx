import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag, MapPin, Phone, Eye, Calendar, CheckCircle2 } from 'lucide-react';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { toast } from 'sonner';
import api from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/format';
import DetailImageGallery from '@/components/shared/DetailImageGallery';

const CONDITION_LABELS = { new: 'Brand New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Needs Repair' };
const CONDITION_COLORS = {
  new: 'bg-green-50 text-green-700 border-green-200',
  like_new: 'bg-blue-50 text-blue-700 border-blue-200',
  good: 'bg-teal-50 text-teal-700 border-teal-200',
  fair: 'bg-amber-50 text-amber-700 border-amber-200',
  poor: 'bg-red-50 text-red-700 border-red-200',
};

export default function ClassifiedDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/classifieds/${id}`)
      .then(r => setItem(r.data))
      .catch(() => { toast.error('Classified not found'); navigate('/customer'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!item) return null;

  const phone = item.support_phone || item.category_support_phone || item.seller_phone || item.contact_phone || item.phone;
  const conditionClass = CONDITION_COLORS[item.condition] || 'bg-slate-50 text-slate-600 border-slate-200';
  const accent = '#7C3AED';

  return (
    <div className="pb-28 animate-fade-in bg-slate-50 min-h-screen">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            data-testid="classified-back-btn"
            onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/customer')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-base font-extrabold text-slate-900 flex-1 truncate">{item.title}</h1>
        </div>
      </div>

      <DetailImageGallery images={item.images} title={item.title} accent={accent} FallbackIcon={Tag} />

      <div className="mx-4 -mt-6 bg-white rounded-2xl shadow-md border border-slate-100 p-4 mb-4 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{item.title}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full font-medium">
                {item.category}
              </span>
              {item.subcategory && (
                <span className="text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  {item.subcategory}
                </span>
              )}
              {item.condition && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${conditionClass}`}>
                  {CONDITION_LABELS[item.condition] || item.condition}
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {item.price
              ? <p className="text-2xl font-bold" style={{ color: accent }}>{formatCurrency(item.price)}</p>
              : <p className="text-sm font-semibold text-slate-400 mt-2">Free</p>
            }
            {item.is_negotiable && (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <p className="text-xs text-green-600 font-medium">Negotiable</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-slate-400 flex-wrap">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>{item.locality}, {item.city}</span>
          </div>
          {item.view_count > 0 && (
            <div className="flex items-center gap-1"><Eye className="w-3 h-3" /> {item.view_count} views</div>
          )}
          {item.created_at && (
            <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(item.created_at)}</div>
          )}
        </div>
      </div>

      {item.description && (
        <div className="mx-4 bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Description</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
        </div>
      )}

      <div className="mx-4 bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Seller</h3>
        <div>
          <p className="text-sm font-semibold text-slate-800">{item.seller_name || 'Verified Seller'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{item.locality}, {item.city}</p>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed border-t border-slate-50 pt-3">
          Tap "Call Seller" — our support team will connect you with the verified seller.
        </p>
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
        <div className="pointer-events-auto max-w-[480px] mx-auto">
          <a href={phone ? `tel:${phone}` : undefined}
            data-testid="classified-cta-btn"
            onClick={e => { if (!phone) { e.preventDefault(); toast.info('Support number will be shown here'); } }}
            className="flex items-center justify-center gap-2 w-full h-14 text-white font-bold text-base rounded-2xl shadow-lg transition-colors"
            style={{ background: accent }}>
            <Phone className="w-5 h-5" /> Call Seller
          </a>
        </div>
      </div>
    </div>
  );
}
