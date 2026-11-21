import { ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface OAuthHandshakeLoaderProps {
  clientName?: string;
  stepMessage?: string;
  onRetry?: () => void;
  isError?: boolean;
  errorMessage?: string;
}

export function OAuthHandshakeLoader({
  clientName = 'Application',
  stepMessage = 'Verifying identity & authorization request...',
  onRetry,
  isError = false,
  errorMessage,
}: OAuthHandshakeLoaderProps) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-xl text-center">
        
        {/* Animated Brand Pulse with Pramaan 'P' Logo */}
        <div className="relative mx-auto w-16 h-16 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-[#FA812F]/20 dark:bg-[#FA812F]/15 animate-ping" />
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-orange-500/30 shadow-lg shadow-orange-500/25">
            <img
              src="/android-chrome-192x192.png"
              alt="Pramaan"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {isError ? 'Authorization Issue' : `Connecting to ${clientName}`}
        </h2>

        <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6 leading-relaxed">
          {isError
            ? errorMessage || 'The authorization request expired or was invalid. Please try initiating sign in from your application again.'
            : stepMessage}
        </p>

        {!isError ? (
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#FA812F] mb-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Establishing secure protocol handshake…</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="btn-orange w-full py-2.5 text-sm font-semibold cursor-pointer"
              >
                Retry Sign In
              </button>
            )}
            <Link
              to="/signin"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-sm font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Pramaan Sign In</span>
            </Link>
          </div>
        )}

        {/* Security Stamp */}
        <div className="pt-6 border-t border-slate-100 dark:border-neutral-900 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-neutral-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>PKCE & OIDC Standard Compliant</span>
        </div>

      </div>
    </div>
  );
}
