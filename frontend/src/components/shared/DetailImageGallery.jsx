import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Detail-page image gallery matching the AgricultureDetail hero style.
 * Falls back to a solid-colored panel + <FallbackIcon /> when no images.
 */
export default function DetailImageGallery({ images = [], title = '', bgColor = '#F1F5F9', accent = '#0F4C3A', FallbackIcon }) {
  const [active, setActive] = useState(0);
  const pics = images.filter(Boolean);
  const has = pics.length > 0;

  return (
    <div
      className="relative h-56 overflow-hidden"
      style={{ background: has ? '#000' : `linear-gradient(135deg, ${bgColor}, ${accent}12)` }}
      data-testid="detail-gallery"
    >
      {has ? (
        <>
          <img
            src={pics[active]}
            alt={`${title} ${active + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {pics.length > 1 && (
            <>
              <button
                onClick={() => setActive(a => (a - 1 + pics.length) % pics.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-90"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActive(a => (a + 1) % pics.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-90"
                aria-label="Next image"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {pics.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`rounded-full transition-all ${i === active ? 'w-6 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
              <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                {active + 1} / {pics.length}
              </div>
            </>
          )}
        </>
      ) : FallbackIcon ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <FallbackIcon className="w-24 h-24" style={{ color: `${accent}40` }} />
        </div>
      ) : null}
    </div>
  );
}
