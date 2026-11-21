import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Key,
  Globe,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  Lock,
  ArrowRight,
  AlertCircle,
  Clock,
  Edit3,
  X,
  Rocket,
  Server,
  Terminal,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface ClientDetail {
  id: string;
  name: string;
  domain: string;
  avatar?: string | null;
  domainStatus: 'PENDING' | 'VERIFIED';
  domainVerificationToken?: string | null;
  domainVerificationMethod?: string;
  domainVerifiedAt?: string | null;
  clientType: 'CONFIDENTIAL' | 'PUBLIC';
  environment: 'development' | 'production' | 'DEVELOPMENT' | 'PRODUCTION';
  enforcePKCE: boolean;
  redirectURIs: string[];
  isActive: boolean;
  createdAt?: string;
}

export function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('pramaan_sec_****************************');
  const [secretRevealed, setSecretRevealed] = useState(false);
  const [newUri, setNewUri] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Action loaders
  const [verifying, setVerifying] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [switchingEnv, setSwitchingEnv] = useState(false);
  const [switchingType, setSwitchingType] = useState(false);
  const [togglingPkce, setTogglingPkce] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit client name and domain modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [updatingDetails, setUpdatingDetails] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'Unable to load client application details.');
      }
    } catch {
      setError('Network connection error while fetching client details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && id) {
      fetchClient();
    }
  }, [isAuthenticated, id, fetchClient]);

  // ----------------- ENVIRONMENT SWITCHER -----------------
  const handleSwitchEnvironment = async () => {
    if (!id || !client) return;
    const isCurrentProd = String(client.environment).toLowerCase() === 'production';
    const nextEnv = isCurrentProd ? 'development' : 'production';

    if (nextEnv === 'production') {
      if (client.domainStatus !== 'VERIFIED') {
        showToast(
          'error',
          `Cannot switch to Production: domain "${client.domain}" must be verified via DNS TXT record first.`
        );
        return;
      }
      if (
        !confirm(
          `Switching to Production mode enforces HTTPS-only callbacks matching your verified domain "${client.domain}". Any development redirect URIs will be cleared. Continue?`
        )
      ) {
        return;
      }
    }

    setSwitchingEnv(true);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}/environment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ environment: nextEnv }),
      });

      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        showToast('success', data.message || `Switched to ${nextEnv} mode.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to switch environment mode.');
      }
    } catch {
      showToast('error', 'Error connecting to developer service.');
    } finally {
      setSwitchingEnv(false);
    }
  };

  // ----------------- CLIENT TYPE SWITCHER -----------------
  const handleSwitchClientType = async () => {
    if (!id || !client) return;
    const nextType = client.clientType === 'CONFIDENTIAL' ? 'PUBLIC' : 'CONFIDENTIAL';

    if (
      !confirm(
        `Switch this application from ${client.clientType} to ${nextType}? ${
          nextType === 'CONFIDENTIAL'
            ? 'A new Client Secret will be generated for server-side token exchange.'
            : 'Client Secret will be disabled in favor of PKCE (RFC 7636).'
        }`
      )
    ) {
      return;
    }

    setSwitchingType(true);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}/type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ client_type: nextType }),
      });

      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setSecretRevealed(true);
          showToast('success', 'Switched to Confidential client. New secret generated!');
        } else {
          showToast('success', 'Switched to Public client with PKCE.');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to switch client type.');
      }
    } catch {
      showToast('error', 'Error connecting to developer service.');
    } finally {
      setSwitchingType(false);
    }
  };

  // ----------------- TOGGLE PKCE -----------------
  const handleTogglePkce = async () => {
    if (!id || !client) return;
    const nextVal = !client.enforcePKCE;

    setTogglingPkce(true);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}/pkce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enforcePKCE: nextVal }),
      });

      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        showToast('success', `PKCE enforcement ${nextVal ? 'enabled' : 'disabled'}.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to update PKCE setting.');
      }
    } catch {
      showToast('error', 'Error connecting to developer service.');
    } finally {
      setTogglingPkce(false);
    }
  };

  // ----------------- TOGGLE ACTIVE STATUS -----------------
  const handleToggleStatus = async () => {
    if (!id || !client) return;
    const nextVal = !client.isActive;

    setTogglingStatus(true);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: nextVal }),
      });

      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        showToast('success', `Application ${nextVal ? 'activated' : 'suspended'}.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to update application status.');
      }
    } catch {
      showToast('error', 'Error connecting to developer service.');
    } finally {
      setTogglingStatus(false);
    }
  };

  // ----------------- REDIRECT URIs -----------------
  const handleAddUri = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUri || !id) return;
    if (client?.redirectURIs?.includes(newUri.trim())) {
      showToast('info', 'This redirect URI is already registered.');
      return;
    }

    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}/redirect-uris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uri: newUri.trim() }),
      });

      if (res.ok) {
        setClient((prev) =>
          prev
            ? { ...prev, redirectURIs: [...(prev.redirectURIs || []), newUri.trim()] }
            : null
        );
        setNewUri('');
        showToast('success', 'Redirect URI added successfully.');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to add redirect URI.');
      }
    } catch {
      showToast('error', 'Error connecting to backend.');
    }
  };

  const handleRemoveUri = async (uri: string) => {
    if (!id) return;

    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}/redirect-uris`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uri }),
      });

      if (res.ok) {
        setClient((prev) =>
          prev
            ? { ...prev, redirectURIs: prev.redirectURIs.filter((u) => u !== uri) }
            : null
        );
        showToast('info', 'Redirect URI removed.');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to remove redirect URI.');
      }
    } catch {
      showToast('error', 'Error connecting to backend.');
    }
  };

  // ----------------- ROTATE SECRET -----------------
  const handleRotateSecret = async () => {
    if (!id) return;
    if (
      !confirm(
        'Are you sure you want to rotate the Client Secret? Existing integrations using the old secret will stop authenticating immediately.'
      )
    ) {
      return;
    }

    setRotating(true);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}/rotate-secret`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        const rotatedSecret = data.clientSecret || data.secret;
        setClientSecret(rotatedSecret);
        setSecretRevealed(true);
        showToast('success', 'New client secret generated! Please store it securely.');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to rotate client secret.');
      }
    } catch {
      showToast('error', 'Error connecting to backend.');
    } finally {
      setRotating(false);
    }
  };

  // ----------------- DOMAIN VERIFICATION -----------------
  const handleVerifyDomain = async () => {
    if (!id) return;
    setVerifying(true);

    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}/verify-domain`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.client) {
          setClient(data.client);
        }
        showToast('success', 'Domain ownership verified! Your application is now production ready.');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'DNS verification record not found yet. Please allow DNS propagation time.');
      }
    } catch {
      showToast('error', 'Error connecting to DNS verification service.');
    } finally {
      setVerifying(false);
    }
  };

  // ----------------- DELETE APPLICATION -----------------
  const handleDeleteClient = async () => {
    if (!id || !client) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete "${client.name}"? All issued tokens and credentials will be invalidated immediately.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        showToast('success', 'Application deleted permanently.');
        navigate('/developer');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to delete application.');
      }
    } catch {
      showToast('error', 'Error connecting to developer service.');
    } finally {
      setDeleting(false);
    }
  };

  // ----------------- EDIT DETAILS MODAL -----------------
  const openEditModal = () => {
    setEditName(client?.name || '');
    setEditDomain(client?.domain || '');
    setShowEditModal(true);
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editName.trim()) return;

    setUpdatingDetails(true);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          domain: editDomain.trim() || 'localhost',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.client) {
          setClient(data.client);
        }
        setShowEditModal(false);
        showToast('success', 'Application details updated successfully!');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to update application details.');
      }
    } catch {
      showToast('error', 'Network error connecting to backend.');
    } finally {
      setUpdatingDetails(false);
    }
  };

  // ----------------- AUTHENTICATION GATE -----------------
  if (authLoading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-[#FA812F] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 bg-white dark:bg-black transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-[#FA812F] flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            Sign In Required
          </h2>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6 leading-relaxed">
            Developer client configuration is restricted to authenticated developers. Please sign in to view this application.
          </p>
          <div className="space-y-3">
            <Link
              to={`/signin?redirect=${encodeURIComponent(`/client/${id}`)}`}
              className="btn-orange w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>Sign In to Continue</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !client) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
        <div className="h-10 w-72 bg-slate-200 dark:bg-neutral-800 rounded mb-8 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 h-64 bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
          <div className="lg:col-span-6 h-64 bg-slate-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Application Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-neutral-400 mb-6">{error}</p>
        <Link to="/developer" className="btn-orange px-5 py-2 text-sm font-semibold inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Developer Hub</span>
        </Link>
      </div>
    );
  }

  const clientId = client?.id || id || '';
  const clientName = client?.name || 'OAuth Application';
  const environment = String(client?.environment || 'development').toUpperCase();
  const isProd = String(client?.environment || '').toLowerCase() === 'production';
  const domain = client?.domain || 'localhost';
  const domainStatus = client?.domainStatus || 'PENDING';
  const redirectUris = client?.redirectURIs || [];
  const verificationToken = client?.domainVerificationToken || 'pending-token-generation';
  const clientType = client?.clientType || 'CONFIDENTIAL';
  const enforcePKCE = client?.enforcePKCE ?? true;
  const isActive = client?.isActive ?? true;

  const authEndpoint = `${window.location.origin}/api/oauth/authorize`;
  const tokenEndpoint = `${window.location.origin}/api/oauth/token`;
  const userinfoEndpoint = `${window.location.origin}/userinfo`;
  const discoveryDoc = `${window.location.origin}/.well-known/openid-configuration`;
  const jwksUri = `${window.location.origin}/.well-known/jwks.json`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      
      {/* Top Breadcrumb & Actions Bar */}
      <div className="mb-6">
        <Link
          to="/developer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-neutral-400 hover:text-[#FA812F] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Developer Hub</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {clientName}
            </h1>

            {/* Environment Badge */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                isProd
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              }`}
            >
              {environment}
            </span>

            {/* Type Badge */}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-800">
              {clientType}
            </span>

            {/* Active / Suspended Badge */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isActive
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              }`}
            >
              {isActive ? 'Active' : 'Suspended'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <strong className="text-slate-700 dark:text-neutral-300">{domain}</strong>
            </span>
            <span>•</span>
            {domainStatus === 'VERIFIED' ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                Domain Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-500 font-semibold text-xs">
                <Clock className="w-3.5 h-3.5" />
                DNS TXT Verification Required for Production
              </span>
            )}
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Switch Environment Button */}
          <button
            onClick={handleSwitchEnvironment}
            disabled={switchingEnv}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors ${
              isProd
                ? 'border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                : 'btn-orange'
            }`}
          >
            <Rocket className={`w-3.5 h-3.5 ${switchingEnv ? 'animate-spin' : ''}`} />
            <span>
              {switchingEnv
                ? 'Switching…'
                : isProd
                ? 'Switch to Development'
                : 'Switch to Production'}
            </span>
          </button>

          <button
            onClick={openEditModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:border-[#FA812F] hover:text-[#FA812F] transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit App</span>
          </button>

          <button
            onClick={handleRotateSecret}
            disabled={rotating || clientType === 'PUBLIC'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer disabled:opacity-40"
            title={clientType === 'PUBLIC' ? 'Public clients do not use client secrets' : 'Rotate Client Secret'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} />
            <span>Rotate Secret</span>
          </button>
        </div>
      </div>

      {/* Main Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Developer Architecture, Options & Credentials */}
        <div className="lg:col-span-6 space-y-6">

          {/* 1. DEVELOPER CONTROLS & ENVIRONMENT OPTIONS */}
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#FA812F]" />
              <span>Developer Options & Architecture</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-6">
              Configure OAuth 2.0 operational behavior, runtime environment, and security policies.
            </p>

            <div className="space-y-4">
              
              {/* Option A: Environment Mode (Dev vs Prod) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Environment Mode
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isProd
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {environment}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {isProd
                      ? 'Production mode enforces strict HTTPS callbacks matching your verified domain.'
                      : 'Development mode allows localhost, http callbacks, and unverified domains for testing.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSwitchEnvironment}
                  disabled={switchingEnv}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-black text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:text-[#FA812F] hover:border-[#FA812F] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isProd ? 'Switch to Dev' : 'Switch to Prod'}
                </button>
              </div>

              {/* Option B: Client Authentication Type (Confidential vs Public) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Client Type
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                      {clientType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {clientType === 'CONFIDENTIAL'
                      ? 'Confidential clients (backend servers) authenticate with client_secret.'
                      : 'Public clients (SPAs/Mobile apps) authenticate via PKCE without secrets.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSwitchClientType}
                  disabled={switchingType}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-black text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:text-[#FA812F] hover:border-[#FA812F] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {clientType === 'CONFIDENTIAL' ? 'Make Public' : 'Make Confidential'}
                </button>
              </div>

              {/* Option C: PKCE Enforcement (RFC 7636) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Enforce PKCE (RFC 7636)
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        enforcePKCE
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-200 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400'
                      }`}
                    >
                      {enforcePKCE ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    Mandates S256 code_challenge parameter on /authorize requests to block interception attacks.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTogglePkce}
                  disabled={togglingPkce}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-black text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:text-[#FA812F] hover:border-[#FA812F] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {enforcePKCE ? 'Disable' : 'Enable'}
                </button>
              </div>

              {/* Option D: Application Lifecycle Status */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Application Status
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isActive
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isActive ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {isActive
                      ? 'Application is accepting OAuth consent and token exchange requests.'
                      : 'Application is paused; all OAuth handshakes are blocked.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={togglingStatus}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-black text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:text-[#FA812F] hover:border-[#FA812F] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isActive ? 'Suspend' : 'Activate'}
                </button>
              </div>

            </div>
          </div>

          {/* 2. OAUTH CREDENTIALS CARD */}
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-[#FA812F]" />
              <span>OAuth Client Credentials</span>
            </h2>

            {/* Client ID */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                Client ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={clientId}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 font-mono text-xs text-slate-900 dark:text-white font-semibold select-all"
                />
                <button
                  onClick={() => copyToClipboard(clientId, 'clientId')}
                  className="p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:text-[#FA812F] transition-colors cursor-pointer shrink-0"
                  title="Copy Client ID"
                >
                  {copiedKey === 'clientId' ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Client Secret */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                Client Secret
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={secretRevealed ? 'text' : 'password'}
                  readOnly
                  value={clientSecret}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 font-mono text-xs text-slate-700 dark:text-neutral-300"
                />
                {secretRevealed && (
                  <button
                    onClick={() => copyToClipboard(clientSecret, 'clientSecret')}
                    className="p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:text-[#FA812F] transition-colors cursor-pointer shrink-0"
                    title="Copy Secret"
                  >
                    {copiedKey === 'clientSecret' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
                <button
                  onClick={handleRotateSecret}
                  disabled={rotating || clientType === 'PUBLIC'}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:text-[#FA812F] text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-40"
                  title="Rotate Secret"
                >
                  Rotate
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1">
                Client secret is encrypted at rest using envelope encryption. Click Rotate to generate a new key if compromised.
              </p>
            </div>
          </div>

          {/* 3. DOMAIN VERIFICATION CARD */}
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#FA812F]" />
                <span>Domain Ownership Verification</span>
              </h2>
              {domainStatus === 'VERIFIED' && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Verified
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-4 leading-relaxed">
              To promote this client to Production mode, add a DNS TXT record to verify you own this domain:
            </p>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 font-mono text-xs text-slate-700 dark:text-neutral-300 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span>
                  <strong className="text-slate-400">Type:</strong> TXT
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="truncate mr-2">
                  <strong className="text-slate-400">Host:</strong> _pramaan-verification.{domain}
                </span>
                <button
                  onClick={() => copyToClipboard(`_pramaan-verification.${domain}`, 'host')}
                  className="text-slate-400 hover:text-[#FA812F] p-0.5 cursor-pointer"
                >
                  {copiedKey === 'host' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="truncate mr-2">
                  <strong className="text-slate-400">Value:</strong> pramaan-verification={verificationToken}
                </span>
                <button
                  onClick={() => copyToClipboard(`pramaan-verification=${verificationToken}`, 'val')}
                  className="text-slate-400 hover:text-[#FA812F] p-0.5 cursor-pointer"
                >
                  {copiedKey === 'val' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {domainStatus !== 'VERIFIED' && domain !== 'localhost' && (
              <button
                onClick={handleVerifyDomain}
                disabled={verifying}
                className="btn-orange px-4 py-2 text-xs font-semibold w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                <span>Verify DNS TXT Record</span>
              </button>
            )}
          </div>

        </div>

        {/* Right Column: Redirect URIs, OIDC Endpoints & SDK Integration */}
        <div className="lg:col-span-6 space-y-6">

          {/* 4. REDIRECT URIs CARD */}
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Allowed Callback Redirect URIs
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-6">
              Authorized endpoints that Pramaan may redirect users to after authentication.
            </p>

            {/* List */}
            <div className="space-y-2 mb-6">
              {redirectUris.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-slate-200 dark:border-neutral-800 text-center text-xs text-slate-400 dark:text-neutral-500">
                  No redirect URIs added yet. Add your OAuth callback endpoint below.
                </div>
              ) : (
                redirectUris.map((uri) => (
                  <div
                    key={uri}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 text-xs font-mono text-slate-700 dark:text-neutral-300"
                  >
                    <span className="truncate mr-2">{uri}</span>
                    <button
                      onClick={() => handleRemoveUri(uri)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer shrink-0"
                      title="Remove URI"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add New URI */}
            <form onSubmit={handleAddUri} className="flex gap-2">
              <input
                type="url"
                required
                value={newUri}
                onChange={(e) => setNewUri(e.target.value)}
                placeholder="https://app.example.com/api/auth/callback"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="btn-orange px-4 py-2 text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add URI</span>
              </button>
            </form>
          </div>

          {/* 5. PROTOCOL ENDPOINTS CONSOLE */}
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Server className="w-5 h-5 text-[#FA812F]" />
              <span>OAuth 2.0 & OIDC Endpoints</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-4">
              Standard protocol URLs for client integrations, token exchanges, and user claims.
            </p>

            <div className="space-y-3 font-mono text-xs">
              
              {/* Authorization Endpoint */}
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                    Authorization Endpoint (GET)
                  </span>
                  <span className="text-slate-800 dark:text-neutral-200 truncate">{authEndpoint}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(authEndpoint, 'auth_ep')}
                  className="p-1 text-slate-400 hover:text-[#FA812F] cursor-pointer shrink-0"
                >
                  {copiedKey === 'auth_ep' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Token Endpoint */}
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                    Token Endpoint (POST)
                  </span>
                  <span className="text-slate-800 dark:text-neutral-200 truncate">{tokenEndpoint}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(tokenEndpoint, 'tok_ep')}
                  className="p-1 text-slate-400 hover:text-[#FA812F] cursor-pointer shrink-0"
                >
                  {copiedKey === 'tok_ep' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* UserInfo Endpoint */}
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                    Userinfo Endpoint (GET)
                  </span>
                  <span className="text-slate-800 dark:text-neutral-200 truncate">{userinfoEndpoint}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(userinfoEndpoint, 'userinfo_ep')}
                  className="p-1 text-slate-400 hover:text-[#FA812F] cursor-pointer shrink-0"
                >
                  {copiedKey === 'userinfo_ep' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Discovery Document */}
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                    Discovery Document (.well-known)
                  </span>
                  <span className="text-slate-800 dark:text-neutral-200 truncate">{discoveryDoc}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(discoveryDoc, 'disc_ep')}
                  className="p-1 text-slate-400 hover:text-[#FA812F] cursor-pointer shrink-0"
                >
                  {copiedKey === 'disc_ep' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* JWKS URI */}
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">
                    JWKS URI (Public Signing Keys)
                  </span>
                  <span className="text-slate-800 dark:text-neutral-200 truncate">{jwksUri}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(jwksUri, 'jwks_ep')}
                  className="p-1 text-slate-400 hover:text-[#FA812F] cursor-pointer shrink-0"
                >
                  {copiedKey === 'jwks_ep' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

            </div>
          </div>

          {/* 6. SDK INTEGRATION CODE */}
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#FA812F]" />
              <span>Integration Example (@anuj304/pramaan)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-4">
              Install the official Pramaan SDK and initialize with your client credentials.
            </p>

            <pre className="p-3.5 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-800 text-[11px] font-mono text-slate-800 dark:text-neutral-200 overflow-x-auto leading-relaxed">
{`import { PramaanClient } from '@anuj304/pramaan';

const client = new PramaanClient({
  clientId: '${clientId}',
  clientSecret: process.env.PRAMAAN_CLIENT_SECRET, // Never expose in frontend
  redirectUri: '${redirectUris[0] || 'https://' + domain + '/callback'}',
  issuer: '${window.location.origin}',
});`}
            </pre>
          </div>

          {/* 7. DANGER ZONE */}
          <div className="bg-white dark:bg-black border border-rose-200 dark:border-rose-950/40 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>Danger Zone</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-4">
              Permanently delete this application and invalidate all user tokens.
            </p>

            <button
              type="button"
              onClick={handleDeleteClient}
              disabled={deleting}
              className="px-4 py-2.5 rounded-lg border border-rose-300 dark:border-rose-900/60 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>{deleting ? 'Deleting Application…' : 'Delete Application'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Edit Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#FA812F] flex items-center justify-center">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Edit Application Details
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  Update application name and domain
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateDetails} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Application Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Acme Dashboard"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FA812F] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Application Domain
                </label>
                <input
                  type="text"
                  required
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  placeholder="e.g. acme.com or localhost:3000"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FA812F] transition-colors"
                />
                <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1">
                  Note: Changing the domain will reset DNS TXT verification to Pending.
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingDetails}
                  className="btn-orange px-5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {updatingDetails ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
