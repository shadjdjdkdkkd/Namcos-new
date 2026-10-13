// Currency formatting
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(amount);
};

// Date formatting
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
};

// Phone formatting
export const formatPhone = (phone) => {
  if (!phone) return '';
  const p = phone.replace(/\D/g, '');
  if (p.length === 12 && p.startsWith('91')) {
    return `+91 ${p.slice(2, 7)} ${p.slice(7)}`;
  }
  if (p.length === 10) return `${p.slice(0, 5)} ${p.slice(5)}`;
  return phone;
};

// Status badge color
export const getStatusColor = (status) => {
  const map = {
    published: 'bg-green-50 text-green-700 border-green-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    active: 'bg-green-50 text-green-700 border-green-200',
    confirmed: 'bg-green-50 text-green-700 border-green-200',
    paid: 'bg-green-50 text-green-700 border-green-200',
    captured: 'bg-green-50 text-green-700 border-green-200',
    delivered: 'bg-green-50 text-green-700 border-green-200',
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    under_review: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    processing: 'bg-blue-50 text-blue-700 border-blue-200',
    preparing: 'bg-orange-50 text-orange-700 border-orange-200',
    requested: 'bg-blue-50 text-blue-700 border-blue-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    suspended: 'bg-orange-50 text-orange-700 border-orange-200',
    on_hold: 'bg-orange-50 text-orange-700 border-orange-200',
    draft: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return map[status] || 'bg-slate-50 text-slate-600 border-slate-200';
};

export const getStatusLabel = (status) => {
  return status?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || status || '—';
};

// Truncate text
export const truncate = (text, maxLen = 100) => {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen) + '...';
};

// Star rating
export const getRatingStars = (rating) => {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return { full, half, empty: 5 - full - (half ? 1 : 0) };
};
