import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Check, X, Globe, UserCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { PramaanLogo } from '../components/PramaanLogo';

interface ClientInfo {
  id: string;
  name: string;
  domain: string;
  avatar?: string | null;
  environment: string;
  domainStatus: string;
}

export function ConsentPage() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request_id');

  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [scopes, setScopes] = useState<string[]>(['openid', 'profile', 'email']);
  const [userName, setUserName] = useState<string>('Current User');
  const [userEmail, setUserEmail] = useState<string>('user@example.com');

  useEffect(() => {
    // In production, fetches client metadata from /api/v1/oauth/consent-details?request_id=...
    if (requestId) {
      fetch(`/api/v1/oauth/consent-details?request_id=${encodeURIComponent(requestId)}`, {
        credentials: 'include',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.alreadyConsented && data?.redirectUrl) {
            window.location.replace(data.redirectUrl);
            return;
          }
          if (data?.client) setClient(data.client);
          if (data?.scopes) setScopes(data.scopes);
          if (data?.user) {
            setUserName(data.user.name);
            setUserEmail(data.user.email);
          }
        })
        .catch(() => {
          // Provide sensible defaults if API endpoint is still spinning up
          setClient({
            id: 'client_id',
            name: 'OpenSpace',
            domain: 'openspace.anujacharjee.com',
            environment: 'DEVELOPMENT',
            domainStatus: 'VERIFIED',
          });
        });
    } else {
      setClient({
        id: 'client_id',
        name: 'Application',
        domain: 'localhost',
        environment: 'DEVELOPMENT',
        domainStatus: 'UNVERIFIED',
      });
    }
  }, [requestId]);

  const handleDecision = async (decision: 'approve' | 'deny') => {
    if (!requestId) return;
    setLoading(true);

    try {
      const res = await fetch('/api/v1/oauth/consent/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ request_id: requestId, decision }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Authorization decision could not be processed.');
      }
    } catch {
      // Fallback submit to backend SSR /oauth/consent
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/oauth/consent';
      const rId = document.createElement('input');
      rId.name = 'request_id';
      rId.value = requestId;
      form.appendChild(rId);
      const dec = document.createElement('input');
      dec.name = 'decision';
      dec.value = decision;
      form.appendChild(dec);
      document.body.appendChild(form);
      form.submit();
      return;
    }

    setLoading(false);
  };

  if (!requestId) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 text-center shadow-lg">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Invalid Consent Request</h2>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6">
            Missing required request_id parameter. Please start authentication from your application.
          </p>
          <a href="/signin" className="btn-orange text-sm px-6 py-2.5">
            Return to Pramaan
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] relative flex flex-col items-center justify-center px-4 py-12 bg-white dark:bg-black transition-colors">
      <div className="mb-6">
        <PramaanLogo size="lg" />
      </div>

      <div className="w-full max-w-lg bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-2xl">
        
        {/* Client Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100 dark:border-neutral-800">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-[#FA812F] flex items-center justify-center font-bold text-xl shrink-0">
            {client?.avatar ? (
              <img src={client.avatar} alt={client.name} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              client?.name?.slice(0, 1).toUpperCase() || 'A'
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                {client?.name || 'Application'}
              </h2>
              {client?.domainStatus === 'VERIFIED' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5 truncate">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{client?.domain || 'localhost'}</span>
              <span className="text-slate-300 dark:text-neutral-700">•</span>
              <span className="uppercase text-[10px] font-mono font-semibold text-slate-500 dark:text-neutral-400">
                {client?.environment || 'DEVELOPMENT'}
              </span>
            </p>
          </div>
        </div>

        {/* User Identity Chip */}
        <div className="my-6 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 text-[#FA812F]" />
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">{userName}</p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 leading-tight">{userEmail}</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-neutral-500">
            Signed in
          </span>
        </div>

        {/* Scopes breakdown */}
        <div className="space-y-3 mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
            Requested Permissions
          </h3>

          <div className="space-y-2">
            {scopes.map((s) => (
              <div
                key={s}
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 text-xs text-slate-700 dark:text-neutral-300"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <div>
                  <span className="font-semibold capitalize text-slate-900 dark:text-white">{s} info</span>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {s === 'openid'
                      ? 'Verify your unique account identity.'
                      : s === 'email'
                      ? 'Access your primary verified email address.'
                      : s === 'profile'
                      ? 'Access your name, username, and profile image.'
                      : `Access ${s} resource.`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleDecision('deny')}
            disabled={loading}
            className="w-1/2 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          <button
            onClick={() => handleDecision('approve')}
            disabled={loading}
            className="btn-orange w-1/2 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
                <span>Authorizing…</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span>Authorize</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
