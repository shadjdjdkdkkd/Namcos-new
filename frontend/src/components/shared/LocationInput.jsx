import React, { useState } from 'react';
import { MapPin, Loader2, LocateFixed, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import LocationPicker from './LocationPicker';

/**
 * Compact single-field location input for forms.
 * Value: { locality, city, state, lat, lng }
 */
export default function LocationInput({ value, onChange, required = true, testId = 'location-input' }) {
  const [open, setOpen] = useState(false);

  const label = value?.locality
    ? `${value.locality}${value.city && value.city !== value.locality ? `, ${value.city}` : ''}`
    : '';

  const handleSelect = (place) => {
    onChange({
      locality: place.locality || '',
      city: place.city || place.locality || '',
      state: place.state || 'Kerala',
      lat: place.lat ?? null,
      lng: place.lng ?? null,
    });
    setOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Location {required && <span className="text-red-500">*</span>}
        </label>
        {value?.lat && (
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <LocateFixed className="w-3 h-3" /> Coords saved
          </span>
        )}
      </div>
      <button
        type="button"
        data-testid={testId}
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between gap-2 px-3 h-11 rounded-xl border text-left text-sm transition-all ${
          label
            ? 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
            : 'border-red-200 bg-red-50 hover:bg-white text-red-600'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate font-medium">
            {label || 'Tap to select or detect location'}
          </span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Change</span>
      </button>
      {!label && required && (
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-red-500 font-medium">
          <AlertCircle className="w-3 h-3" /> Location is mandatory for all listings
        </div>
      )}
      <LocationPicker open={open} onClose={() => setOpen(false)}
        locality={value?.locality || ''} km={20} onSelect={handleSelect} showKm={false} />
    </div>
  );
}
