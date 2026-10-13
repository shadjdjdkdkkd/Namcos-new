import React, { useEffect, useState } from 'react';
import { Loader2, Copy, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/format';

const ROWS = [['account_holder', 'Account Holder'], ['bank_account', 'Account Number'], ['ifsc', 'IFSC Code'],
  ['bank_name', 'Bank Name'], ['upi_id', 'UPI ID']];

function DetailRows({ data, prefix }) {
  const rows = ROWS.filter(([k]) => data?.[k]);
  if (!rows.length) return <p className="text-xs text-slate-400" data-testid={`${prefix}-empty`}>No details added yet</p>;
  return rows.map(([k, label]) => (
    <div key={k} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800" data-testid={`${prefix}-${k}`}>
        {data[k]}
        <button onClick={() => { navigator.clipboard?.writeText(data[k]); toast.success(`${label} copied`); }}
          className="p-1 hover:bg-slate-100 rounded"><Copy className="w-3 h-3 text-slate-400" /></button>
      </span>
    </div>
  ));
}

export default function PayoutDetailsModal({ url, title, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get(url).then(r => setData(r.data)).catch(e => { toast.error(formatApiError(e)); onClose(); }); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}
        data-testid="payout-details-modal">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Landmark className="w-4 h-4 text-[#0F4C3A]" /> Account Details · {title}</h3>
          <button onClick={onClose} data-testid="payout-details-close" className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
        </div>
        {!data ? <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0F4C3A]" /></div> : (
          <div className="space-y-4">
            <div className="text-xs text-slate-500">
              {data.owner_name || data.name} · {data.owner_phone || data.phone}
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saved payout details</p>
              <DetailRows data={data.payout} prefix="payout-saved" />
            </div>
            {data.store_bank && Object.keys(data.store_bank).length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Given at store registration</p>
                <DetailRows data={data.store_bank} prefix="payout-store" />
              </div>
            )}
            {data.last_withdrawal && (
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">
                  Last withdrawal · {formatCurrency(data.last_withdrawal.amount)} · {data.last_withdrawal.status} · {formatDate(data.last_withdrawal.created_at)}
                </p>
                <DetailRows data={data.last_withdrawal} prefix="payout-last" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
