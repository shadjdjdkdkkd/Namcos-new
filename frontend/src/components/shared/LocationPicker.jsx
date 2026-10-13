import React, { useState, useEffect, useRef } from 'react';
import { MapPin, X, Loader2, LocateFixed, Sliders, Search } from 'lucide-react';
import { toast } from 'sonner';
import { attachAutocomplete, getCurrentPosition, reverseGeocode } from '@/utils/maps';

const QUICK_LOCATIONS = ['Kozhikode', 'Thrissur', 'Kochi', 'Wayanad', 'Kannur', 'Malappuram', 'Palakkad'];
const KM_OPTIONS = [2, 5, 10, 20, 50];

/**
 * Bottom-sheet Location picker.
 * - Type/autocomplete via Google Places
 * - "Use My Location" GPS button (bottom-right inside input)
 * - Quick chips
 * - Radius selector
 * - Confirm button lifted above safe area
 */
export default function LocationPicker({
  open,
  onClose,
  locality,
  km,
  onSelect, // ({ locality, city, lat, lng, km })
  showKm = true,
}) {
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState(null); // { locality, city, lat, lng }
  const [selectedKm, setSelectedKm] = useState(km || 20);
  const [gpsLoading, setGpsLoading] = useState(false);
  const inputRef = useRef(null);
  const acRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setInput(locality || '');
    setSelectedKm(km || 20);
    setSelected(null);
    // attach autocomplete
    const t = setTimeout(() => {
      if (inputRef.current && !acRef.current) {
        attachAutocomplete(inputRef.current, (place) => {
          if (place) {
            setSelected(place);
            setInput(place.locality || place.formatted || '');
          }
        }).then(ac => (acRef.current = ac)).catch(() => {});
      }
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  const handleGps = async () => {
    setGpsLoading(true);
    try {
      const coords = await getCurrentPosition();
      const place = await reverseGeocode(coords);
      setSelected(place);
      setInput(place.locality || place.formatted || '');
      toast.success('Location detected');
    } catch (e) {
      const msg = e?.code === 1
        ? 'Location permission denied. Please enable it in your browser settings.'
        : 'Could not detect your location.';
      toast.error(msg);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleQuick = (city) => {
    setSelected({ locality: city, city, lat: null, lng: null });
    setInput(city);
  };

  const handleConfirm = () => {
    const value = selected
      ? { ...selected, km: selectedKm }
      : input.trim()
        ? { locality: input.trim(), city: input.trim(), lat: null, lng: null, km: selectedKm }
        : null;
    if (!value) { toast.error('Enter or pick a location'); return; }
    onSelect(value);
    onClose();
  };

  const handleClear = () => {
    onSelect({ locality: '', city: '', lat: null, lng: null, km: selectedKm });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      data-testid="location-picker-modal"
      className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-[480px] rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-lg">Set your location</h3>
            <p className="text-xs text-slate-500 mt-0.5">Listings shown nearby will match this</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg" aria-label="Close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* Search input with inline GPS button */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              data-testid="location-search-input"
              type="text"
              autoFocus
              placeholder="Search area, city or landmark"
              value={input}
              onChange={e => { setInput(e.target.value); setSelected(null); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              className="w-full h-14 pl-10 pr-14 border border-slate-200 rounded-2xl bg-slate-50 text-sm font-medium focus:outline-none focus:border-[#0F4C3A] focus:bg-white transition-all"
            />
            <button
              type="button"
              data-testid="location-gps-btn"
              onClick={handleGps}
              disabled={gpsLoading}
              aria-label="Use my current location"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[#0F4C3A] hover:bg-[#0a3829] text-white flex items-center justify-center disabled:opacity-60 shadow-md shadow-emerald-900/20 transition-all active:scale-95"
            >
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick locations */}
          <div className="mt-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> Popular cities
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_LOCATIONS.map(city => (
                <button
                  key={city}
                  onClick={() => handleQuick(city)}
                  data-testid={`location-quick-${city.toLowerCase()}`}
                  className={`px-3 py-2 text-xs rounded-full border font-semibold transition-all ${
                    (selected?.city || locality) === city
                      ? 'border-[#0F4C3A] bg-[#0F4C3A] text-white'
                      : 'border-slate-200 text-slate-700 hover:border-[#0F4C3A]/50'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          {/* Radius */}
          {showKm && (
            <div className="mt-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Sliders className="w-3 h-3" /> Show results within
              </p>
              <div className="flex gap-2">
                {KM_OPTIONS.map(k => (
                  <button
                    key={k}
                    onClick={() => setSelectedKm(k)}
                    data-testid={`location-km-${k}`}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                      selectedKm === k
                        ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                        : 'border-slate-200 text-slate-600 hover:border-[#0F4C3A]'
                    }`}
                  >
                    {k}km
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer (lifted above safe area) */}
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-100 flex gap-2">
          {locality && (
            <button
              onClick={handleClear}
              data-testid="location-clear-btn"
              className="flex-1 h-12 border border-slate-200 text-slate-600 rounded-2xl text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleConfirm}
            data-testid="location-confirm-btn"
            className="flex-[2] h-12 bg-[#0F4C3A] text-white rounded-2xl font-bold text-sm hover:bg-[#0a3829] transition-colors shadow-lg shadow-emerald-900/20"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
