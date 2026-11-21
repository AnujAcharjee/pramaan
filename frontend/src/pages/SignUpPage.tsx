import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { PramaanLogo } from '../components/PramaanLogo';
import { ThemeToggle } from '../components/ThemeToggle';

export function SignUpPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const flow = searchParams.get('flow');
  const requestId = searchParams.get('request_id');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('MALE');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isOAuthFlow = flow === 'oauth' && Boolean(requestId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        email: email.trim(),
        gender,
        password,
        confirmPassword: password,
        flow: isOAuthFlow ? 'oauth' : 'default',
      };
      if (isOAuthFlow && requestId) {
        payload.request_id = requestId;
        payload.requestId = requestId;
      }

      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const verifyParams = new URLSearchParams({ email, success: 'Account created successfully 🎉' });
        if (isOAuthFlow && requestId) {
          verifyParams.set('flow', 'oauth');
          verifyParams.set('request_id', requestId);
        }
        navigate(`/verify?${verifyParams.toString()}`);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.message || 'Unable to create account. Please check your details.');
      }
    } catch {
      // Fallback submission to backend SSR endpoint
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/signup';
      const inputs = { name, email, gender, password, flow, request_id: requestId };
      Object.entries(inputs).forEach(([k, v]) => {
        if (v) {
          const el = document.createElement('input');
          el.name = k;
          el.value = v;
          form.appendChild(el);
        }
      });
      document.body.appendChild(form);
      form.submit();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] relative flex items-center justify-center px-4 py-12 bg-white dark:bg-black transition-colors">
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-xl">
          
          <div className="text-center mb-8 flex flex-col items-center">
            <Link to="/" className="mb-4 inline-block hover:opacity-90 transition-opacity">
              <PramaanLogo size="xl" withText={false} />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create an account
            </h1>
            <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
              Join Pramaan for modern, standards-compliant authentication.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#FA812F] focus:ring-1 focus:ring-[#FA812F] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#FA812F] focus:ring-1 focus:ring-[#FA812F] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#FA812F] focus:ring-1 focus:ring-[#FA812F] transition-all"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#FA812F] focus:ring-1 focus:ring-[#FA812F] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-orange w-full py-3 text-sm font-semibold mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
                  <span>Creating account…</span>
                </>
              ) : (
                <>
                  <span>Sign up</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-neutral-900 text-center text-xs text-slate-500 dark:text-neutral-400">
            Already have an account?{' '}
            <Link
              to={isOAuthFlow ? `/signin?flow=oauth&request_id=${encodeURIComponent(requestId!)}` : '/signin'}
              className="font-bold text-[#FA812F] hover:underline ml-1"
            >
              Sign in
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
