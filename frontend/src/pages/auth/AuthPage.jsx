import { appName, appLogo } from '@/lib/brand';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, ChevronLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { AUTH } from '@/constants/testIds';


// SVG scene: gentle rolling tea-plantation hills for the bottom half
function TeaFieldScene() {
  return (
    <svg
      className="absolute bottom-0 left-0 right-0 w-full h-64 pointer-events-none"
      viewBox="0 0 400 200"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hill1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0F4C3A" stopOpacity="0.9" />
          <stop offset="1" stopColor="#082e21" />
        </linearGradient>
        <linearGradient id="hill2" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#166a4f" stopOpacity="0.85" />
          <stop offset="1" stopColor="#0F4C3A" />
        </linearGradient>
        <linearGradient id="field" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1e8a63" />
          <stop offset="1" stopColor="#0d5a3f" />
        </linearGradient>
        <pattern id="rows" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <path d="M0 7 L14 7" stroke="#0a3a29" strokeWidth="1.2" opacity="0.35" />
        </pattern>
      </defs>
      <path d="M0 80 Q 90 40 200 65 T 400 60 L400 200 L0 200 Z" fill="url(#hill2)" />
      <path d="M0 110 Q 100 80 220 95 T 400 90 L400 200 L0 200 Z" fill="url(#hill1)" />
      <path d="M0 140 Q 120 115 260 125 T 400 130 L400 200 L0 200 Z" fill="url(#field)" />
      <path d="M0 140 Q 120 115 260 125 T 400 130 L400 200 L0 200 Z" fill="url(#rows)" />
      <path d="M40 168 l4 -6 l4 6 l-2 0 l0 6 l-4 0 l0 -6 z" fill="#0a2f22" opacity="0.6" />
      <path d="M340 174 l3 -5 l3 5 l-1.5 0 l0 5 l-3 0 l0 -5 z" fill="#0a2f22" opacity="0.6" />
    </svg>
  );
}

// Decorative leaves in the corners like the reference image
function DecorLeaves() {
  return (
    <>
      <svg className="absolute -top-4 -left-6 w-40 h-40 opacity-70 pointer-events-none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="lg1" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#5fd39d" />
            <stop offset="100%" stopColor="#0d5a3f" />
          </radialGradient>
        </defs>
        <path d="M10 20 C 20 10, 60 5, 80 25 C 70 60, 30 65, 10 45 Z" fill="url(#lg1)" />
        <path d="M15 25 C 35 30, 55 40, 70 40" stroke="#0a3a29" strokeWidth="1.5" fill="none" opacity="0.7" />
      </svg>
      <svg className="absolute -top-2 -right-6 w-36 h-36 opacity-70 pointer-events-none rotate-45" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="lg2" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#7ce4b0" />
            <stop offset="100%" stopColor="#166a4f" />
          </radialGradient>
        </defs>
        <path d="M10 20 C 20 10, 60 5, 80 25 C 70 60, 30 65, 10 45 Z" fill="url(#lg2)" />
      </svg>
      <svg className="absolute top-1/3 -right-8 w-28 h-28 opacity-60 pointer-events-none rotate-12" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 20 C 20 10, 60 5, 80 25 C 70 60, 30 65, 10 45 Z" fill="#3fbf85" />
      </svg>
    </>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) { toast.error('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/send-otp', { phone });
      setDevOtp(data.otp || '');
      setMode('otp');
      toast.success('OTP sent!', { description: 'Check your SMS for the 6-digit code' });
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, otp, referral_code: referralCode || undefined });
      login(data.user, data.access_token);
      const roles = data.roles || [];
      if (data.is_new_user) {
        setIsNewUser(true);
        setMode('name');
        setLoading(false);
        return;
      }
      toast.success('Welcome back!');
      if (roles.includes('merchant')) navigate('/merchant');
      else navigate('/customer');
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const handleCompleteSignup = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) { toast.error('Please enter your name'); return; }
    setLoading(true);
    try {
      const { data } = await api.put('/auth/profile', { name: name.trim() });
      login(data);
      toast.success(`Welcome to ${appName()}!`);
      navigate('/customer');
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  return (
    <div
      data-testid="auth-page"
      className="min-h-screen w-full relative overflow-hidden flex flex-col items-center px-5"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 10%, #1a6b4d 0%, #0F4C3A 40%, #0a3a29 100%)',
      }}
    >
      <DecorLeaves />
      <TeaFieldScene />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center pt-14 pb-8 flex-1">
        {/* Logo with glow */}
        <div className="relative mb-6">
          <div className="absolute inset-0 -m-6 rounded-full bg-emerald-300/25 blur-3xl" />
          <img
            src={appLogo()}
            alt={`${appName()}`}
            className="relative h-28 w-28 object-cover rounded-full drop-shadow-2xl bg-white ring-2 ring-white/40"
          />
        </div>

        {/* Brand title */}
        <h1 className="text-white text-5xl font-black tracking-tight text-center leading-none drop-shadow-md">
          {appName()}
        </h1>
        <p className="text-emerald-100/90 text-sm font-medium mt-2 tracking-wide">
          Local Commerce Ecosystem
        </p>

        {/* Divider with leaf */}
        <div className="flex items-center gap-3 mt-4 mb-8 w-56">
          <span className="flex-1 h-px bg-emerald-200/40" />
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#7ce4b0">
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8Z" />
          </svg>
          <span className="flex-1 h-px bg-emerald-200/40" />
        </div>

        {/* Auth Card */}
        <div className="w-full bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/40">
          {mode === 'phone' ? (
            <div className="p-6">
              <div className="flex items-baseline gap-2 mb-1">
                <h2 className="text-2xl font-black text-[#0F4C3A]">Welcome!</h2>
                <span className="text-2xl" role="img" aria-label="wave">👋</span>
              </div>
              <p className="text-sm text-slate-500 mb-6">Enter your mobile number to continue</p>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                    Mobile Number
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center h-14 px-4 border border-emerald-100 rounded-2xl bg-emerald-50/60 text-sm font-bold text-[#0F4C3A]">
                      +91
                    </div>
                    <Input
                      data-testid={AUTH.phoneInput}
                      type="tel"
                      inputMode="numeric"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="h-14 rounded-2xl border-slate-200 focus:border-[#0F4C3A] text-base flex-1 font-semibold px-4"
                    />
                  </div>
                </div>
                <Button
                  data-testid={AUTH.sendOtpBtn}
                  type="submit"
                  disabled={loading || phone.length < 10}
                  className="w-full h-14 rounded-2xl bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-bold text-base shadow-lg shadow-emerald-900/30"
                >
                  {loading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <><span>Get OTP</span> <ArrowRight className="w-5 h-5 ml-2" /></>
                  }
                </Button>
              </form>
            </div>
          ) : mode === 'otp' ? (
            <div className="p-6">
              <button
                data-testid="auth-back-btn"
                onClick={() => { setMode('phone'); setOtp(''); setDevOtp(''); }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#0F4C3A] mb-4 transition-colors font-medium"
              >
                <ChevronLeft className="w-4 h-4" /> Change number
              </button>
              <h2 className="text-2xl font-black text-[#0F4C3A] mb-0.5">Verify OTP</h2>
              <p className="text-sm text-slate-500 mb-4">Code sent to +91 {phone}</p>

              {devOtp && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-4 text-center">
                  <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest mb-0.5">Dev Mode — Your OTP</p>
                  <p className="text-3xl font-black tracking-[0.35em] text-[#0F4C3A]">{devOtp}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Referral Code <span className="text-slate-300">(optional, new users)</span></label>
                  <Input type="text" placeholder="e.g. NAM1A2B3C" value={referralCode}
                    data-testid="auth-referral-input"
                    onChange={e => setReferralCode(e.target.value.toUpperCase().trim())}
                    className="h-14 rounded-2xl border-slate-200 focus:border-[#0F4C3A] font-semibold px-4 tracking-wider" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">6-Digit OTP</label>
                  <Input
                    data-testid={AUTH.otpInput}
                    type="text"
                    inputMode="numeric"
                    placeholder="· · · · · ·"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-14 rounded-2xl border-slate-200 focus:border-[#0F4C3A] text-center text-2xl tracking-[0.5em] font-black"
                  />
                </div>
                <Button
                  data-testid={AUTH.verifyOtpBtn}
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full h-14 rounded-2xl bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-bold text-base shadow-lg shadow-emerald-900/30"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="p-6">
              <h2 className="text-2xl font-black text-[#0F4C3A] mb-0.5">One last step</h2>
              <p className="text-sm text-slate-500 mb-5">Tell us your name to finish creating your account</p>
              <form onSubmit={handleCompleteSignup} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Your Name</label>
                  <Input
                    data-testid="auth-name-input"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    autoFocus
                    onChange={e => setName(e.target.value)}
                    className="h-14 rounded-2xl border-slate-200 focus:border-[#0F4C3A] font-semibold px-4"
                  />
                </div>
                <Button
                  data-testid="auth-complete-signup-btn"
                  type="submit"
                  disabled={loading || name.trim().length < 2}
                  className="w-full h-14 rounded-2xl bg-[#0F4C3A] hover:bg-[#0a3829] text-white font-bold text-base shadow-lg shadow-emerald-900/30"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Complete Sign Up</span> <ArrowRight className="w-5 h-5 ml-2" /></>}
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
            <Shield className="w-3 h-3 text-white/80" />
          </div>
          <p className="text-center text-[11px] text-white/70 font-medium max-w-[280px]">
            By continuing, you agree to {appName()}{' '}
            <span className="underline underline-offset-2">Terms &amp; Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
