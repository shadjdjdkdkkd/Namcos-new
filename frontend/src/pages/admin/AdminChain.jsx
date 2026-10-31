import React, { useEffect, useState } from 'react';
import { Network, Save, Loader2, X, Info, Users, Coins, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { formatCurrency, formatDate } from '@/utils/format';

const MAX_LEVELS = 10;
const total = (tiers) => +tiers.reduce((s, t) => s + (parseInt(t.people) || 0) * (parseFloat(t.percent) || 0), 0).toFixed(4);
const levels = (tiers) => tiers.reduce((s, t) => s + (parseInt(t.people) || 0), 0);

export function tierError(tiers, target) {
  let prev = null;
  for (let i = 0; i < tiers.length; i++) {
    const p = parseInt(tiers[i].people) || 0, pct = parseFloat(tiers[i].percent) || 0;
    if (p < 0 || pct < 0) return `Tier ${i + 1}: no negative values`;
    if (p === 0 && pct > 0) return `Tier ${i + 1}: percent must be 0 when people is 0`;
    if (p > 0 && pct <= 0) return `Tier ${i + 1}: percent must be above 0`;
    if (p > 0) { if (prev !== null && pct > prev) return `Tier ${i + 1}: cannot pay more per person than the tier above`; prev = pct; }
  }
  const lv = levels(tiers);
  if (lv < 1 || lv > MAX_LEVELS) return `Total people must be 1–${MAX_LEVELS} (now ${lv})`;
  if (target != null && Math.abs(total(tiers) - target) > 0.001) return `Tiers add up to ${total(tiers)}% — must equal ${target}%`;
  return null;
}

function TierEditor({ tiers, setTiers, target, prefix }) {
  const set = (i, k, v) => setTiers(tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  let lvl = 1;
  const err = tierError(tiers, target);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">
        <span className="col-span-2">Tier</span><span className="col-span-3">People (levels)</span>
        <span className="col-span-3">% each</span><span className="col-span-4 text-right">Tier total · levels</span>
      </div>
      {tiers.map((t, i) => {
        const p = parseInt(t.people) || 0;
        const from = lvl; lvl += p;
        return (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <span className="col-span-2 text-sm font-bold text-[#0F4C3A]">Tier {i + 1}</span>
            <Input data-testid={`${prefix}-people-${i}`} type="number" min="0" className="col-span-3 h-9" value={t.people}
              onChange={e => set(i, 'people', e.target.value)} />
            <Input data-testid={`${prefix}-percent-${i}`} type="number" step="0.01" min="0" className="col-span-3 h-9" value={t.percent}
              onChange={e => set(i, 'percent', e.target.value)} />
            <span className="col-span-4 text-right text-xs text-slate-600">
              {+(p * (parseFloat(t.percent) || 0)).toFixed(4)}% · {p ? (p === 1 ? `L${from}` : `L${from}–L${from + p - 1}`) : '—'}
            </span>
          </div>
        );
      })}
      <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${err ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
        data-testid={`${prefix}-status`}>
        <span className="flex items-center gap-1.5">{err ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}{err || 'Plan is valid'}</span>
        <span>{levels(tiers)}/{MAX_LEVELS} levels · {total(tiers)}%{target != null ? ` of ${target}%` : ''}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, testId }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <Icon className="w-4 h-4 text-[#0F4C3A] mb-2" />
      <p className="text-xs text-slate-500">{label}</p>
      <p data-testid={testId} className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StoreChainModal({ store, template, onClose, onSaved }) {
  const [pct, setPct] = useState(store.chain_percent);
  const [custom, setCustom] = useState(store.custom);
  const [tiers, setTiers] = useState(store.tiers.map(t => ({ ...t })));
  const [busy, setBusy] = useState(false);
  const target = parseFloat(pct) || 0;
  const tt = template.reduce((s, t) => s + t.people * t.percent, 0) || 1;
  const auto = template.map(t => ({ people: t.people, percent: +(t.percent * target / tt).toFixed(6) }));
  const save = async () => {
    if (custom) { const e = tierError(tiers, target); if (e) { toast.error(e); return; } }
    setBusy(true);
    try {
      await api.put(`/admin/stores/${store.id}/chain`, { chain_percent: target, tiers: custom ? tiers.map(t => ({ people: parseInt(t.people) || 0, percent: parseFloat(t.percent) || 0 })) : null });
      toast.success('Chain plan saved'); onSaved();
    } catch (e) { toast.error(formatApiError(e)); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div data-testid="store-chain-modal" className="bg-white rounded-2xl w-full max-w-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">{store.name} — chain plan</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Shop chain allocation (% of bill)</label>
          <Input data-testid="store-chain-percent" type="number" step="0.1" value={pct} onChange={e => setPct(e.target.value)} className="h-10" />
        </div>
        <div className="flex gap-2">
          <button data-testid="store-chain-mode-auto" onClick={() => setCustom(false)}
            className={`flex-1 h-9 rounded-xl text-xs font-semibold border ${!custom ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'border-slate-200'}`}>Use default plan (auto-scaled)</button>
          <button data-testid="store-chain-mode-custom" onClick={() => { setCustom(true); if (!store.custom) setTiers(auto); }}
            className={`flex-1 h-9 rounded-xl text-xs font-semibold border ${custom ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]' : 'border-slate-200'}`}>Custom tiers</button>
        </div>
        {custom ? <TierEditor tiers={tiers} setTiers={setTiers} target={target} prefix="store-tier" />
          : <TierEditor tiers={auto} setTiers={() => {}} target={target} prefix="store-auto" />}
        <Button data-testid="store-chain-save" onClick={save} disabled={busy} className="w-full bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save</>}
        </Button>
      </div>
    </div>
  );
}

export default function AdminChain() {
  const [data, setData] = useState(null);
  const [tpl, setTpl] = useState([]);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(null);
  const load = () => api.get('/admin/chain/overview').then(r => { setData(r.data); setTpl(r.data.template.map(t => ({ ...t }))); }).catch(e => toast.error(formatApiError(e)));
  useEffect(() => { load(); }, []);

  const saveTpl = async () => {
    const e = tierError(tpl); if (e) { toast.error(e); return; }
    setSaving(true);
    try { await api.put('/admin/chain/template', { tiers: tpl.map(t => ({ people: parseInt(t.people) || 0, percent: parseFloat(t.percent) || 0 })) }); toast.success('Default plan saved'); load(); }
    catch (er) { toast.error(formatApiError(er)); }
    setSaving(false);
  };

  if (!data) return <div className="p-6"><Loader2 className="w-6 h-6 animate-spin text-[#0F4C3A]" /></div>;
  const maxLv = Math.max(1, ...data.by_level.map(l => l.amount));
  return (
    <div data-testid="admin-chain-page" className="p-6 max-w-6xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Network className="w-6 h-6 text-[#0F4C3A]" /> Chain Earnings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Reward the people who bring users in — up to {data.max_levels} invite levels, 5 tiers</p>
      </div>

      <div className="bg-[#0F4C3A]/5 border border-[#0F4C3A]/15 rounded-2xl p-4 text-sm text-slate-700 flex gap-3">
        <Info className="w-5 h-5 text-[#0F4C3A] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p><b>How it works:</b> every shop gives a <b>chain %</b> of each bill. When a user pays, we walk up their invite chain — Level 1 is the person who invited them, Level 2 invited Level 1, and so on up to {data.max_levels} levels.</p>
          <p>The 5 tiers decide <b>how many levels</b> (people) each tier covers and the <b>% of the bill each person gets</b>. Tier percentages × people must add up exactly to the shop's chain %, and closer levels always earn the same or more.</p>
          <p>Credits land in wallets as soon as payment succeeds. If a chain is shorter than the plan, the unused share stays with the platform.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total chain paid" value={formatCurrency(data.total_distributed)} icon={Coins} testId="chain-total-paid" />
        <Stat label="Chain credits" value={data.total_credits} icon={Network} testId="chain-total-credits" />
        <Stat label="Unclaimed (kept)" value={formatCurrency(data.unclaimed)} icon={AlertTriangle} testId="chain-unclaimed" />
        <Stat label="Shops with chain %" value={data.stores.filter(s => s.chain_percent > 0).length} icon={Users} testId="chain-shops-count" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Default plan (template, {total(tpl)}%)</h2>
          <p className="text-xs text-slate-500">Shops without custom tiers use this shape, scaled to their own chain %.</p>
          <TierEditor tiers={tpl} setTiers={setTpl} prefix="tpl" />
          <Button data-testid="chain-template-save" onClick={saveTpl} disabled={saving || !!tierError(tpl)} className="bg-[#0F4C3A] hover:bg-[#0a3829] text-white rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save default plan
          </Button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Paid by level</h2>
          {data.by_level.length === 0 ? <p className="text-xs text-slate-400">No chain credits yet</p> : data.by_level.map(l => (
            <div key={l.level} className="flex items-center gap-2 mb-2" data-testid={`chain-level-${l.level}`}>
              <span className="w-8 text-xs font-bold text-slate-600">L{l.level}</span>
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#0F4C3A]" style={{ width: `${(l.amount / maxLv) * 100}%` }} /></div>
              <span className="w-28 text-right text-xs text-slate-700">{formatCurrency(l.amount)} · {l.count}</span>
            </div>
          ))}
          <h2 className="text-sm font-semibold text-slate-800 mt-5 mb-2">Top chain earners</h2>
          {data.top_earners.map(t => (
            <div key={t.user_id} className="flex justify-between text-xs py-1 border-b border-slate-50"><span>{t.name} <span className="text-slate-400">{t.phone}</span></span><b>{formatCurrency(t.amount)}</b></div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <h2 className="text-sm font-semibold text-slate-800 p-4 pb-2">Shops — chain allocation</h2>
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-slate-400"><tr>
            <th className="text-left p-3">Shop</th><th className="text-left p-3">Chain %</th><th className="text-left p-3">Plan</th><th className="text-left p-3">Tiers (people × %)</th><th className="p-3" />
          </tr></thead>
          <tbody>{data.stores.map(s => (
            <tr key={s.id} className="border-t border-slate-100" data-testid={`chain-store-${s.id}`}>
              <td className="p-3 font-medium">{s.name}<p className="text-[11px] text-slate-400">{s.locality}</p></td>
              <td className="p-3 font-bold">{s.chain_percent}%</td>
              <td className="p-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${s.custom ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{s.custom ? 'Custom' : 'Default'}</span>
                {!s.valid && <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700">Mismatch</span>}</td>
              <td className="p-3 text-xs text-slate-600">{s.tiers.filter(t => t.people > 0).map(t => `${t.people}×${+(+t.percent).toFixed(3)}%`).join(' · ')}</td>
              <td className="p-3 text-right"><Button data-testid={`chain-edit-${s.id}`} size="sm" variant="outline" onClick={() => setEdit(s)}>Edit</Button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Recent chain credits</h2>
        {data.recent.length === 0 ? <p className="text-xs text-slate-400">No credits yet</p> : data.recent.map(r => (
          <div key={r.id} className="flex justify-between text-xs py-1.5 border-b border-slate-50">
            <span>L{r.level}{r.tier ? ` · Tier ${r.tier}` : ''} — {r.buyer_name} paid at {r.store_name || 'a shop'} <span className="text-slate-400">{formatDate(r.created_at)}</span></span>
            <b className="text-emerald-700">+{formatCurrency(r.amount)}</b>
          </div>
        ))}
      </div>

      {edit && <StoreChainModal store={edit} template={data.template} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}
