import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { PramaanLogo } from '../components/PramaanLogo';
import { useAuth } from '../context/AuthContext';

export function ForgotPasswordPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const flow = searchParams.get('flow');
  const requestId = searchParams.get('request_id');

  const [email, setEmail] = useState(user?.email || '');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isOAuthFlow = flow === 'oauth' && Boolean(requestId);
      const payload: Record<string, string> = {
        email: email.trim(),
        flow: isOAuthFlow ? 'oauth' : 'default',
      };
      if (isOAuthFlow && requestId) {
        payload.request_id = requestId;
        payload.requestId = requestId;
      }

      await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Fallback
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-white dark:bg-black transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-xl">
        
        <div className="text-center mb-8 flex flex-col items-center">
          <Link to="/" className="mb-4 inline-block hover:opacity-90 transition-opacity">
            <PramaanLogo size="xl" withText={false} />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Reset password
          </h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
            Enter your email to receive a password reset link.
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
              If an account with that email exists, we've sent password reset instructions to your inbox.
            </div>
            <Link
              to="/signin"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FA812F] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Sign in</span>
            </Link>
          </div>
        ) : (
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

            <button
              type="submit"
              disabled={loading}
              className="btn-orange w-full py-3 text-sm font-semibold mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
                  <span>Sending link…</span>
                </>
              ) : (
                <>
                  <span>Send reset link</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>

            <div className="text-center pt-4">
              <Link
                to={flow && requestId ? `/signin?flow=${flow}&request_id=${requestId}` : '/signin'}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign in</span>
              </Link>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
