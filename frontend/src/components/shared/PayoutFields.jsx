import React, { useEffect, useState } from 'react';
import { Landmark, Smartphone } from 'lucide-react';
import api from '@/utils/api';

export const EMPTY_PAYOUT = { account_holder: '', bank_account: '', ifsc: '', bank_name: '', upi_id: '' };

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function validatePayout(p, method) {
  if (method === 'bank') {
    if (!p.account_holder?.trim()) return 'Account holder name is required';
    if (!/^\d{9,18}$/.test((p.bank_account || '').replace(/\s/g, ''))) return 'Enter a valid account number (9-18 digits)';
    if (!IFSC_RE.test((p.ifsc || '').toUpperCase())) return 'Enter a valid IFSC code (e.g. SBIN0001234)';
    return null;
  }
  if (!p.upi_id?.includes('@')) return 'Enter a valid UPI ID (e.g. name@upi)';
  return null;
}

export function payoutPayload(p, method) {
  return method === 'bank'
    ? { account_holder: p.account_holder.trim(), bank_account: p.bank_account.replace(/\s/g, ''), ifsc: p.ifsc.toUpperCase().trim(), bank_name: p.bank_name?.trim() || undefined }
    : { upi_id: p.upi_id.trim() };
}

export function useSavedPayout() {
  const [payout, setPayout] = useState(EMPTY_PAYOUT);
  const [method, setMethod] = useState('bank');
  useEffect(() => {
    api.get('/my/payout-details').then(({ data }) => {
      if (!data) return;
      setPayout(p => ({ ...p, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v)) }));
      if (!data.bank_account && data.upi_id) setMethod('upi');
    }).catch(() => {});
  }, []);
  return { payout, setPayout, method, setMethod };
}

function Inp({ label, value, onChange, placeholder, testId, upper }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
      <input value={value || ''} placeholder={placeholder} data-testid={testId}
        onChange={e => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
        className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0F4C3A]" />
    </div>
  );
}

export default function PayoutFields({ payout, setPayout, method, setMethod }) {
  const set = (k) => (v) => setPayout(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-3" data-testid="payout-fields">
      <div className="grid grid-cols-2 gap-2">
        {[['bank', 'Bank Account', Landmark], ['upi', 'UPI', Smartphone]].map(([m, label, Icon]) => (
          <button key={m} type="button" data-testid={`payout-method-${m}`} onClick={() => setMethod(m)}
            className={`flex items-center justify-center gap-1.5 h-10 rounded-xl border text-xs font-bold transition-colors ${
              method === m ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'bg-white text-slate-600 border-slate-200'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>
      {method === 'bank' ? (
        <>
          <Inp label="Account Holder Name *" value={payout.account_holder} onChange={set('account_holder')} placeholder="As per bank records" testId="payout-account-holder" />
          <Inp label="Account Number *" value={payout.bank_account} onChange={v => set('bank_account')(v.replace(/[^\d]/g, ''))} placeholder="000123456789" testId="payout-account-number" />
          <div className="grid grid-cols-2 gap-2">
            <Inp label="IFSC Code *" value={payout.ifsc} onChange={set('ifsc')} placeholder="SBIN0001234" testId="payout-ifsc" upper />
            <Inp label="Bank Name" value={payout.bank_name} onChange={set('bank_name')} placeholder="State Bank of India" testId="payout-bank-name" />
          </div>
        </>
      ) : (
        <Inp label="UPI ID *" value={payout.upi_id} onChange={set('upi_id')} placeholder="yourname@upi" testId="payout-upi" />
      )}
      <p className="text-[10px] text-slate-400">Saved securely for future withdrawals. Admin uses these details to send your payout.</p>
    </div>
  );
}
