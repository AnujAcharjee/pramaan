import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { OAuthHandshakeLoader } from '../components/OAuthHandshakeLoader';
import { PramaanLogo } from '../components/PramaanLogo';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';

export function SignInPage() {
  const { user, isAuthenticated, loading: authLoading, checkAuth, setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const flow = searchParams.get('flow');
  const requestId = searchParams.get('request_id');
  const errorParam = searchParams.get('error');
  const redirectParam = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    errorParam === 'Session_expired' ? 'Your session expired. Please sign in to authorize.' : ''
  );

  const isOAuthFlow = flow === 'oauth' && Boolean(requestId);

  // If user is already authenticated, skip sign-in form
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (isOAuthFlow && requestId) {
        window.location.replace(`/oauth/consent?request_id=${encodeURIComponent(requestId)}`);
      } else {
        window.location.replace(redirectParam || '/account');
      }
    }
  }, [authLoading, isAuthenticated, user, isOAuthFlow, requestId, redirectParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      // In production, posts credentials to backend /api/v1/auth/signin
      const payload: Record<string, string> = {
        email: email.trim(),
        password,
        flow: isOAuthFlow ? 'oauth' : 'default',
      };
      if (isOAuthFlow && requestId) {
        payload.request_id = requestId;
        payload.requestId = requestId;
      }

      const res = await fetch('/api/v1/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
        await checkAuth();

        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }

        if (redirectParam) {
          window.location.href = redirectParam;
          return;
        }

        window.location.href = isOAuthFlow && requestId ? `/oauth/consent?request_id=${encodeURIComponent(requestId)}` : '/account';
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.message || 'Invalid email or password.');
      }
    } catch {
      // Fallback for SSR endpoint during deprecation transition
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/signin';
      const emailInput = document.createElement('input');
      emailInput.name = 'email';
      emailInput.value = email;
      form.appendChild(emailInput);
      const pwInput = document.createElement('input');
      pwInput.name = 'password';
      pwInput.value = password;
      form.appendChild(pwInput);
      if (flow) {
        const flowInput = document.createElement('input');
        flowInput.name = 'flow';
        flowInput.value = flow;
        form.appendChild(flowInput);
      }
      if (requestId) {
        const reqInput = document.createElement('input');
        reqInput.name = 'request_id';
        reqInput.value = requestId;
        form.appendChild(reqInput);
      }
      document.body.appendChild(form);
      form.submit();
    } finally {
      setLoading(false);
    }
  };

  if (isOAuthFlow && (loading || authLoading || (isAuthenticated && user))) {
    return (
      <OAuthHandshakeLoader
        clientName="Pramaan"
        stepMessage={
          isAuthenticated && user
            ? 'Active session verified. Connecting to authorization consent...'
            : 'Authenticating credentials & preparing authorization...'
        }
      />
    );
  }

  return (
    <div className="min-h-[85vh] relative flex items-center justify-center px-4 py-12 bg-white dark:bg-black transition-colors">
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        
        {/* Main Card */}
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-xl">
          
          {/* Header */}
          <div className="text-center mb-8 flex flex-col items-center">
            <Link to="/" className="mb-4 inline-block hover:opacity-90 transition-opacity">
              <PramaanLogo size="xl" withText={false} />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isOAuthFlow ? 'Authorize Sign In' : 'Welcome back'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
              {isOAuthFlow
                ? 'Sign in to authorize your identity for the requesting app.'
                : 'Sign in to access your secure Pramaan account.'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300">
                  Password
                </label>
                <Link
                  to={isOAuthFlow ? `/forgot-password?flow=oauth&request_id=${encodeURIComponent(requestId!)}` : '/forgot-password'}
                  className="text-xs font-semibold text-[#FA812F] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
              className="btn-orange w-full py-3 text-sm font-semibold mt-2"
            >
              <span>{loading ? 'Signing in…' : 'Sign in'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-neutral-900 text-center text-xs text-slate-500 dark:text-neutral-400">
            Don't have an account?{' '}
            <Link
              to={isOAuthFlow ? `/signup?flow=oauth&request_id=${encodeURIComponent(requestId!)}` : '/signup'}
              className="font-bold text-[#FA812F] hover:underline ml-1"
            >
              Create one now
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
