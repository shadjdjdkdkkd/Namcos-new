import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Send, Loader2, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/utils/api';
import { formatDateTime } from '@/utils/format';

const TARGETS = [
  { value: 'all', label: 'All Users', icon: UsersIcon },
  { value: 'customers', label: 'Customers Only', icon: UsersIcon },
  { value: 'merchants', label: 'Merchants Only', icon: UsersIcon },
];

export default function AdminNotifications() {
  const [form, setForm] = useState({ title: '', message: '', target: 'all' });
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);

  const load = useCallback(() => {
    api.get('/admin/announcements').then(({ data }) => setHistory(data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error('Title and message are required'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/admin/notifications/send', form);
      toast.success(`Notification sent to ${data.sent} user(s)`);
      setForm({ title: '', message: '', target: 'all' });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not send'); }
    finally { setSending(false); }
  };

  return (
    <div className="p-6 animate-fade-in max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Megaphone className="w-6 h-6 text-[#0F4C3A]" /> Notifications</h1>
        <p className="text-sm text-slate-500 mt-0.5">Send announcements to users — they appear in each user's notification tab.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Send To</label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {TARGETS.map(t => (
            <button key={t.value} data-testid={`notif-target-${t.value}`} onClick={() => setForm(f => ({ ...f, target: t.value }))}
              className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${form.target === t.value ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white text-slate-600 border-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Title</label>
        <input value={form.title} data-testid="notif-title-input" onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Diwali Offer is Live!" className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm mb-3 focus:outline-none focus:border-[#0F4C3A]" />
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Message</label>
        <textarea value={form.message} data-testid="notif-message-input" onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          rows={3} placeholder="Write your announcement..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm mb-4 focus:outline-none focus:border-[#0F4C3A]" />
        <button onClick={send} disabled={sending} data-testid="notif-send-btn"
          className="flex items-center gap-2 bg-[#0F4C3A] hover:bg-[#0a3829] disabled:opacity-60 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Notification
        </button>
      </div>

      <h2 className="text-sm font-bold text-slate-700 mb-3">Recent Announcements</h2>
      {history.length === 0 ? (
        <p className="text-sm text-slate-400">No announcements sent yet.</p>
      ) : (
        <div className="space-y-2" data-testid="notif-history">
          {history.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">{a.target} · {a.sent} sent</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{a.message}</p>
              <p className="text-[10px] text-slate-400 mt-1.5">{formatDateTime(a.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
