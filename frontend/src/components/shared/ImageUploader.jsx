import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, ImagePlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/utils/api';

/**
 * Multi-image uploader for listings.
 * - Enforces a min count (default 4).
 * - Uploads to /api/uploads and stores absolute URLs.
 * - Shows preview grid with remove button.
 * Value: string[] (absolute URLs).
 */
export default function ImageUploader({
  value = [],
  onChange,
  min = 4,
  max = 8,
  disabled = false,
  testIdPrefix = 'image-uploader',
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const backend = process.env.REACT_APP_BACKEND_URL || '';

  const abs = (url) => {
    if (!url) return url;
    return url.startsWith('http') ? url : `${backend}${url}`;
  };

  const handleFiles = async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (value.length + list.length > max) {
      toast.error(`Max ${max} images allowed`);
      return;
    }
    setUploading(true);
    const uploaded = [];
    for (const file of list) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 8MB`);
        continue;
      }
      try {
        const form = new FormData();
        form.append('file', file);
        const { data } = await api.post('/uploads', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push(abs(data.url));
      } catch (e) {
        toast.error(`Upload failed: ${file.name}`);
      }
    }
    if (uploaded.length) onChange([...value, ...uploaded]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (idx) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  const shortage = Math.max(min - value.length, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Photos <span className="text-red-500">*</span>
        </label>
        <span className="text-[10px] text-slate-400 font-medium">
          {value.length}/{max} · min {min}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden group border border-slate-200">
            <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              data-testid={`${testIdPrefix}-remove-${i}`}
              onClick={() => handleRemove(i)}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-90 shadow-sm"
              aria-label="Remove photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {i === 0 && (
              <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-full">MAIN</span>
            )}
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            data-testid={`${testIdPrefix}-add-btn`}
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0F4C3A] hover:bg-emerald-50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-[#0F4C3A] transition-all disabled:opacity-50"
          >
            {uploading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><ImagePlus className="w-5 h-5" /><span className="text-[10px] font-semibold">Add</span></>}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
        data-testid={`${testIdPrefix}-file-input`}
      />

      {shortage > 0 ? (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Add {shortage} more photo{shortage > 1 ? 's' : ''} (min {min} required)</span>
        </div>
      ) : (
        <p className="text-[10px] text-emerald-600 mt-2 font-medium flex items-center gap-1">
          <Upload className="w-3 h-3" /> Photos ready
        </p>
      )}
    </div>
  );
}
