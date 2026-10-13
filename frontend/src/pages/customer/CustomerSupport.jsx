import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, LifeBuoy, Plus, Loader2, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/utils/api';
import { formatRelativeTime, getStatusColor, getStatusLabel } from '@/utils/format';

const SUPPORT_PHONE = '+918047183333';
const CATEGORIES = [
  { value: 'order', label: 'Order Issue' },
  { value: 'payment', label: 'Payment / Refund' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'listing', label: 'My Listing' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

export default function CustomerSupport() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', category: 'other' });
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState(null);

  const load = useCallback(() => {
    api.get('/support/tickets/my').then(({ data }) => setTickets(data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.subject.trim() || !form.description.trim()) { toast.error('Please fill subject and description'); return; }
    setSubmitting(true);
    try {
      await api.post('/support/tickets', form);
      toast.success('Ticket raised — our team will get back to you');
      setShowForm(false); setForm({ subject: '', description: '', category: 'other' });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not raise ticket');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 animate-fade-in">
      <header className="sticky top-0 z-20 bg-[#0F4C3A] px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/customer/profile')} data-testid="support-back-btn" className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white flex-1">Help &amp; Support</h1>
      </header>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <a href={`tel:${SUPPORT_PHONE}`} data-testid="support-call-btn"
            className="flex flex-col items-center justify-center gap-2 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center"><Phone className="w-5 h-5 text-emerald-600" /></div>
            <p className="text-sm font-semibold text-slate-800">Call Support</p>
            <p className="text-[10px] text-slate-400">9am – 9pm</p>
          </a>
          <button onClick={() => setShowForm(true)} data-testid="support-raise-ticket-btn"
            className="flex flex-col items-center justify-center gap-2 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition">
            <div className="w-11 h-11 rounded-2xl bg-[#0F4C3A]/10 flex items-center justify-center"><Plus className="w-5 h-5 text-[#0F4C3A]" /></div>
            <p className="text-sm font-semibold text-slate-800">Raise a Ticket</p>
            <p className="text-[10px] text-slate-400">Get help by chat</p>
          </button>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-2">My Tickets</h2>
          {tickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
              <LifeBuoy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No tickets yet</p>
            </div>
          ) : (
            <div className="space-y-2.5" data-testid="support-ticket-list">
              {tickets.map(t => (
                <button key={t.id} onClick={() => setActive(t)} data-testid={`support-ticket-${t.ticket_id}`}
                  className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800 truncate flex-1">{t.subject}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(t.status)}`}>{getStatusLabel(t.status)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-400 font-mono">#{t.ticket_id}</span>
                    {t.messages?.length > 0 && <span className="text-[10px] text-emerald-600 flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.messages.length} reply</span>}
                    <span className="text-[10px] text-slate-400">{formatRelativeTime(t.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Raise ticket modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end" onClick={() => !submitting && setShowForm(false)}>
          <div className="bg-white w-full max-w-[480px] mx-auto rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Raise a Ticket</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Category</label>
            <select value={form.category} data-testid="support-category-select" onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm mb-3 focus:outline-none focus:border-[#0F4C3A]">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Subject</label>
            <input value={form.subject} data-testid="support-subject-input" onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Brief summary" className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm mb-3 focus:outline-none focus:border-[#0F4C3A]" />
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Describe your issue</label>
            <textarea value={form.description} data-testid="support-description-input" onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4} placeholder="Tell us what went wrong..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm mb-4 focus:outline-none focus:border-[#0F4C3A]" />
            <Button onClick={submit} disabled={submitting} data-testid="support-submit-btn"
              className="w-full h-12 bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-bold rounded-2xl">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</> : 'Submit Ticket'}
            </Button>
          </div>
        </div>
      )}

      {/* Ticket detail modal */}
      {active && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end" onClick={() => setActive(null)}>
          <div className="bg-white w-full max-w-[480px] mx-auto rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-800 flex-1 pr-2">{active.subject}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(active.status)}`}>{getStatusLabel(active.status)}</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">{active.description}</p>
            <div className="space-y-2">
              {(active.messages || []).map((m, i) => (
                <div key={i} className={`p-3 rounded-xl text-xs ${m.from === 'admin' ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-700'}`}>
                  <p className="font-semibold mb-0.5">{m.from === 'admin' ? 'Support' : 'You'}</p>
                  {m.text}
                </div>
              ))}
              {(!active.messages || active.messages.length === 0) && <p className="text-xs text-slate-400 text-center py-2">Awaiting a reply from support</p>}
            </div>
            <button onClick={() => setActive(null)} className="mt-4 w-full h-11 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
