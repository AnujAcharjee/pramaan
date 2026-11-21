import { useSearchParams, Link } from 'react-router-dom';
import { Mail, RefreshCw, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { PramaanLogo } from '../components/PramaanLogo';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || 'your email';
  const flow = searchParams.get('flow');
  const requestId = searchParams.get('request_id');

  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');

  const handleResend = async () => {
    setResending(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ email });
      if (flow === 'oauth' && requestId) {
        params.set('flow', 'oauth');
        params.set('request_id', requestId);
      }
      const res = await fetch(`/api/v1/auth/resend-verification?${params.toString()}`);
      if (res.ok) {
        setMessage('Verification link resent! Please check your inbox.');
      } else {
        setMessage('If an account exists, a link has been sent.');
      }
    } catch {
      window.location.href = `/verify/resend?email=${encodeURIComponent(email)}${
        flow ? `&flow=${flow}` : ''
      }${requestId ? `&request_id=${requestId}` : ''}`;
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12 bg-white dark:bg-black transition-colors">
      <div className="mb-6">
        <PramaanLogo size="lg" />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-xl text-center">
        
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-[#FA812F] flex items-center justify-center mx-auto mb-6">
          <Mail className="w-7 h-7" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
          Verify your email
        </h1>

        <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6 leading-relaxed">
          We sent a verification link to <strong className="text-slate-900 dark:text-white">{email}</strong>. Please click the link inside to activate your account.
        </p>

        {message && (
          <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
            {message}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
            <span>{resending ? 'Resending…' : 'Resend verification email'}</span>
          </button>

          <Link
            to={flow === 'oauth' && requestId ? `/signin?flow=oauth&request_id=${encodeURIComponent(requestId)}` : "/signin"}
            className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-[#FA812F] hover:underline pt-2 block"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign in</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
