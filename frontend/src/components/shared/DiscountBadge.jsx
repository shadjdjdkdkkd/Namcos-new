import React from 'react';
import { BadgePercent } from 'lucide-react';

/** Golden "X% OFF" badge shown over a store/listing image. */
export default function DiscountBadge({ percent, className = '' }) {
  const pct = Number(percent) || 0;
  if (pct <= 0) return null;
  return (
    <div
      data-testid="discount-badge"
      className={`absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black text-amber-950 shadow-md ring-1 ring-amber-300/70 ${className}`}
      style={{ background: 'linear-gradient(135deg,#FFE083 0%,#F6B400 48%,#C98A00 100%)' }}
    >
      <BadgePercent className="w-3 h-3" strokeWidth={2.5} />
      {Math.round(pct)}% OFF
    </div>
  );
}
