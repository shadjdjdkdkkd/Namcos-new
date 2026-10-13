import React from 'react';

export default function LoadingSpinner({ size = 'md', text = '', className = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`${sizes[size]} border-3 border-slate-200 border-t-[#0F4C3A] rounded-full animate-spin`}
           style={{ borderTopColor: '#0F4C3A', borderWidth: '3px' }} />
      {text && <p className="text-sm text-slate-500">{text}</p>}
    </div>
  );
}

export function PageLoader({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
