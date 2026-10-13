import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Star, Clock, Wrench, Award, CheckCircle2 } from 'lucide-react';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { toast } from 'sonner';
import api from '@/utils/api';
import { formatCurrency } from '@/utils/format';
import DetailImageGallery from '@/components/shared/DetailImageGallery';

const DAYS_SHORT = { Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'Th', Fri: 'F', Sat: 'S', Sun: 'Su' };

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/services/${id}`)
      .then(r => setItem(r.data))
      .catch(() => { toast.error('Service not found'); navigate('/customer'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!item) return null;

  const phone = item.support_phone || item.category_support_phone || item.phone;
  const accent = '#2563EB';

  return (
    <div className="pb-28 animate-fade-in bg-slate-50 min-h-screen">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            data-testid="service-back-btn"
            onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/customer')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-base font-extrabold text-slate-900 flex-1 truncate">{item.service_name}</h1>
          {item.emergency_available && (
            <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-semibold">24/7</span>
          )}
        </div>
      </div>

      <DetailImageGallery images={item.images} title={item.service_name} accent={accent} FallbackIcon={Wrench} />

      <div className="mx-4 -mt-6 bg-white rounded-2xl shadow-md border border-slate-100 p-4 mb-4 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{item.service_name}</h2>
            <p className="text-xs font-semibold mt-0.5" style={{ color: accent }}>{item.category}</p>
            <p className="text-xs text-slate-500 mt-0.5">{item.provider_name || item.business_name}</p>
          </div>
          {item.rating > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-100 flex-shrink-0">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-sm font-bold text-slate-700">{item.rating}</span>
              {item.completed_jobs > 0 && <span className="text-xs text-slate-400">({item.completed_jobs})</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500">
            {item.locality}, {item.city}
            {item.service_radius ? ` · Serves up to ${item.service_radius}km` : ''}
          </span>
        </div>

        {item.experience_years > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <Award className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-xs text-slate-500">{item.experience_years} years of experience</span>
          </div>
        )}
      </div>

      {(item.starting_price || item.hourly_price || item.visit_charge) && (
        <div className="mx-4 bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Pricing</h3>
          <div className="grid grid-cols-2 gap-3">
            {item.starting_price && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Starting from</p>
                <p className="text-xl font-bold" style={{ color: accent }}>{formatCurrency(item.starting_price)}</p>
              </div>
            )}
            {item.hourly_price && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Per hour</p>
                <p className="text-xl font-bold text-slate-700">{formatCurrency(item.hourly_price)}</p>
              </div>
            )}
            {item.visit_charge && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Visit charge</p>
                <p className="text-xl font-bold text-slate-700">{formatCurrency(item.visit_charge)}</p>
              </div>
            )}
            {item.emergency_charge && (
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Emergency</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(item.emergency_charge)}</p>
              </div>
            )}
          </div>
          {item.price_negotiable && (
            <div className="flex items-center gap-1.5 mt-2">
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              <p className="text-xs text-green-600 font-medium">Price is negotiable</p>
            </div>
          )}
        </div>
      )}

      {item.description && (
        <div className="mx-4 bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          <h3 className="text-sm font-bold text-slate-800 mb-2">About this Service</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
          {item.languages?.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {item.languages.map(lang => (
                <span key={lang} className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">{lang}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {(item.opening_time || item.working_days?.length > 0) && (
        <div className="mx-4 bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Availability</h3>
          {item.opening_time && (
            <div className="flex items-center gap-2 text-xs text-slate-600 mb-3">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{item.opening_time} – {item.closing_time}</span>
            </div>
          )}
          {item.working_days?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
                <span key={day}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-bold transition-all ${
                    item.working_days.includes(day) ? 'text-white' : 'bg-slate-100 text-slate-300'
                  }`}
                  style={item.working_days.includes(day) ? { background: accent } : undefined}>
                  {DAYS_SHORT[day]}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mx-4 bg-white rounded-2xl border border-slate-100 p-4 mb-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Provider</h3>
        <div>
          <p className="text-sm font-semibold text-slate-800">{item.provider_name || item.business_name || 'Verified Provider'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{item.locality}, {item.city}</p>
        </div>
        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed border-t border-slate-50 pt-3">
          Tap "Call to Book" — our support team will connect you with the verified service provider.
        </p>
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
        <div className="pointer-events-auto max-w-[480px] mx-auto">
          <a href={phone ? `tel:${phone}` : undefined}
            data-testid="service-cta-btn"
            onClick={e => { if (!phone) { e.preventDefault(); toast.info('Support number will be shown here'); } }}
            className="flex items-center justify-center gap-2 w-full h-14 text-white font-bold text-base rounded-2xl shadow-lg transition-colors"
            style={{ background: accent }}>
            <Phone className="w-5 h-5" /> Call to Book
          </a>
        </div>
      </div>
    </div>
  );
}
