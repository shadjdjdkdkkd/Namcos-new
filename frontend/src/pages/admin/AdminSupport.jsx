import React, { useState, useEffect, useCallback } from 'react';
import { LifeBuoy, Loader2, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/utils/api';
import { formatDateTime, getStatusColor, getStatusLabel } from '@/utils/format';

const STATUS_FILTERS = ['all', 'open', 'in_progress', 'resolved', 'closed'];
const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];

export default function AdminSupport() {
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = filter === 'all' ? {} : { status: filter };
    api.get('/support/tickets', { params }).then(({ data }) => setTickets(data || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const sendReply = async () => {
    if (!reply.trim()) { toast.error('Write a reply first'); return; }
    setSaving(true);
    try {
      await api.put(`/support/tickets/${active.id}`, { message: reply.trim() });
      toast.success('Reply sent');
      const updated = { ...active, messages: [...(active.messages || []), { from: 'admin', text: reply.trim(), at: new Date().toISOString() }] };
      setActive(updated); setReply(''); load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const changeStatus = async (status) => {
    try {
      await api.put(`/support/tickets/${active.id}`, { status });
      toast.success(`Marked ${status.replace('_', ' ')}`);
      setActive({ ...active, status }); load();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="p-6 animate-fade-in max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><LifeBuoy className="w-6 h-6 text-[#0F4C3A]" /> Support Tickets</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage and reply to customer support requests.</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s} data-testid={`ticket-filter-${s}`} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${filter === s ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white text-slate-600 border-slate-200'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        : tickets.length === 0 ? <p className="text-sm text-slate-400">No tickets found.</p> : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="admin-ticket-list">
          {tickets.map(t => (
            <button key={t.id} onClick={() => { setActive(t); setReply(''); }} data-testid={`admin-ticket-${t.ticket_id}`}
              className="w-full text-left flex items-center gap-4 px-4 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 truncate">{t.subject}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(t.status)}`}>{getStatusLabel(t.status)}</span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{t.user_name} · #{t.ticket_id} · {t.category}</p>
              </div>
              {t.messages?.length > 0 && <span className="text-[10px] text-emerald-600 flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.messages.length}</span>}
              <span className="text-[10px] text-slate-400">{formatDateTime(t.created_at)}</span>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <div className="bg-white w-full max-w-lg rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-slate-800 flex-1 pr-2">{active.subject}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(active.status)}`}>{getStatusLabel(active.status)}</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">{active.user_name} · #{active.ticket_id} · {active.category}</p>
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 mb-3">{active.description}</div>

            <div className="space-y-2 mb-4">
              {(active.messages || []).map((m, i) => (
                <div key={i} className={`p-3 rounded-xl text-xs ${m.from === 'admin' ? 'bg-emerald-50 text-emerald-900 ml-6' : 'bg-slate-100 text-slate-700 mr-6'}`}>
                  <p className="font-semibold mb-0.5">{m.from === 'admin' ? (m.author || 'Support') : active.user_name}</p>
                  {m.text}
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-3 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button key={s} data-testid={`ticket-set-${s}`} onClick={() => changeStatus(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border capitalize ${active.status === s ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input value={reply} data-testid="admin-ticket-reply-input" onChange={e => setReply(e.target.value)}
                placeholder="Type a reply..." className="flex-1 h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4C3A]" />
              <button onClick={sendReply} disabled={saving} data-testid="admin-ticket-reply-btn"
                className="h-11 px-4 bg-[#0F4C3A] text-white rounded-xl flex items-center gap-1.5 text-sm font-semibold disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
              </button>
            </div>
            <button onClick={() => setActive(null)} className="mt-3 w-full h-10 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
