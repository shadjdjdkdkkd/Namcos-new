import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { formatApiError } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

const LOGO_URL = "https://customer-assets-gfyr7b9c.emergentagent.net/job_8644c173-92fb-4985-b9f0-9ff438711506/artifacts/73hc9mup_ChatGPT%20Image%20Sep%2028%2C%202026%2C%2010_40_54%20PM.webp";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user?.roles?.some(r => ['admin','super_admin'].includes(r))) {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter email and password'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/admin-login', { email, password });
      login(data.user, data.access_token);
      toast.success('Welcome back, Admin!');
      navigate('/admin');
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0B192C] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-[#0F4C3A]/40 rounded-2xl blur-xl scale-125" />
            <img src={LOGO_URL} alt="NAMCOS" className="relative h-20 w-20 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">NAMCOS</h1>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-medium">Admin Panel</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#0F4C3A] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Admin Login</h2>
              <p className="text-xs text-white/40">Restricted access</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5 block">
                Email Address
              </label>
              <Input
                data-testid="admin-email-input"
                type="email"
                placeholder="admin@namcos.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-[#0F4C3A] focus:ring-0"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <Input
                  data-testid="admin-password-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-[#0F4C3A] pr-10"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              data-testid="admin-login-btn"
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-[#0F4C3A] hover:bg-[#0d3d2f] text-white font-semibold mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sign In to Admin Panel
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          Not an admin? <a href="/auth" className="text-white/40 hover:text-white underline">Go to Customer App</a>
        </p>
      </div>
    </div>
  );
}
