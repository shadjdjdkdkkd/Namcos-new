import React, { useEffect, useState } from 'react';
import { Settings, Percent, Shield, Save, Phone, Mail, Key, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { ADMIN } from '@/constants/testIds';

export default function AdminSettings() {
  const [platform, setPlatform] = useState({ platform_fee_percent: 2, namcos_earning_percent: 2, referral_percent: 5, min_withdrawal_amount: 100, maintenance_mode: false });
  const [contact, setContact] = useState({ support_email: '', support_phone: '', whatsapp: '', business_hours: '', company_address: '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingPlat, setSavingPlat] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api.get('/admin/settings').then(r => setPlatform(p => ({ ...p, ...r.data }))).catch(() => {});
    api.get('/admin/contact-settings').then(r => setContact(c => ({ ...c, ...r.data }))).catch(() => {});
  }, []);

  const savePlatform = async () => {
    setSavingPlat(true);
    try {
      await api.put('/admin/settings', platform);
      toast.success('Platform settings saved');
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingPlat(false);
  };
  const saveContact = async () => {
    setSavingContact(true);
    try {
      await api.put('/admin/contact-settings', contact);
      toast.success('Contact info updated');
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingContact(false);
  };
  const changePw = async () => {
    if (pw.new_password !== pw.confirm_password) { toast.error("Passwords don't match"); return; }
    if (pw.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSavingPw(true);
    try {
      await api.post('/admin/change-password', { current_password: pw.current_password, new_password: pw.new_password });
      toast.success('Password changed');
      setPw({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) { toast.error(formatApiError(e)); }
    setSavingPw(false);
  };

  return (
    <div data-testid={ADMIN.settings} className="p-6 max-w-3xl mx-auto animate-fade-in space-y-4">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform, contact info, and account security</p>
      </div>

      {/* Fees */}
      <Section title="Fees & Withdrawal" icon={Percent}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="NAMCOS Earning (%)" type="number" step="0.1"
            value={platform.namcos_earning_percent}
            onChange={v => setPlatform(p => ({ ...p, namcos_earning_percent: parseFloat(v) || 0 }))} />
          <Field label="Referral Reward (%)" type="number" step="0.1"
            value={platform.referral_percent}
            onChange={v => setPlatform(p => ({ ...p, referral_percent: parseFloat(v) || 0 }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform Fee (%)" type="number" step="0.1"
            value={platform.platform_fee_percent}
            onChange={v => setPlatform(p => ({ ...p, platform_fee_percent: parseFloat(v) || 0 }))} />
          <Field label="Min Withdrawal (₹)" type="number"
            value={platform.min_withdrawal_amount}
            onChange={v => setPlatform(p => ({ ...p, min_withdrawal_amount: parseFloat(v) || 0 }))} />
        </div>
        <div className="flex items-center justify-between mt-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Maintenance mode</p>
            <p className="text-xs text-slate-400">Disables customer access</p>
          </div>
          <button onClick={() => setPlatform(p => ({ ...p, maintenance_mode: !p.maintenance_mode }))}
            className={`w-11 h-6 rounded-full transition-colors relative ${platform.maintenance_mode ? 'bg-red-500' : 'bg-slate-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${platform.maintenance_mode ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="pt-2">
          <Button onClick={savePlatform} disabled={savingPlat} className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl">
            {savingPlat ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save platform
          </Button>
        </div>
      </Section>

      {/* Contact settings */}
      <Section title="Contact info shown to customers" icon={Phone}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Support email" value={contact.support_email}
            onChange={v => setContact(c => ({ ...c, support_email: v }))} placeholder="help@namcos.in" />
          <Field label="Support phone" value={contact.support_phone}
            onChange={v => setContact(c => ({ ...c, support_phone: v }))} placeholder="+91 900 000 0000" />
          <Field label="WhatsApp" value={contact.whatsapp}
            onChange={v => setContact(c => ({ ...c, whatsapp: v }))} placeholder="+91 …" />
          <Field label="Business hours" value={contact.business_hours}
            onChange={v => setContact(c => ({ ...c, business_hours: v }))} placeholder="9 AM – 8 PM (Mon–Sat)" />
        </div>
        <Field label="Company address" value={contact.company_address}
          onChange={v => setContact(c => ({ ...c, company_address: v }))} />
        <div className="pt-2">
          <Button data-testid="admin-save-contact" onClick={saveContact} disabled={savingContact}
            className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl">
            {savingContact ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save contact
          </Button>
        </div>
      </Section>

      {/* Password */}
      <Section title="Change admin password" icon={Key}>
        <Field label="Current password" type="password" value={pw.current_password}
          onChange={v => setPw(p => ({ ...p, current_password: v }))} testId="admin-current-password" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="New password" type="password" value={pw.new_password}
            onChange={v => setPw(p => ({ ...p, new_password: v }))} testId="admin-new-password" />
          <Field label="Confirm new password" type="password" value={pw.confirm_password}
            onChange={v => setPw(p => ({ ...p, confirm_password: v }))} testId="admin-confirm-password" />
        </div>
        <div className="pt-2">
          <Button data-testid="admin-change-password-btn" onClick={changePw} disabled={savingPw}
            className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl">
            {savingPw ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
            Update password
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#0F4C3A]/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#0F4C3A]" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', step, testId }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
      <Input type={type} step={step} value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} data-testid={testId}
        className="h-11 rounded-xl border-slate-200 focus:border-[#0F4C3A]" />
    </div>
  );
}
