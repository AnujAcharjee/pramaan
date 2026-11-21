import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  environment: 'DEVELOPMENT' | 'PRODUCTION';
  enforcePKCE: boolean;
  redirectURIs: string[];
  isActive: boolean;
  createdAt?: string;
}

export function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('pramaan_sec_****************************');
  const [secretRevealed, setSecretRevealed] = useState(false);
  const [newUri, setNewUri] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [rotating, setRotating] = useState(false);

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
            <Link
              to="/signup"
              className="block text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:text-[#FA812F] transition-colors py-1"
            >
              Don't have an account? Create one
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ----------------- CLIENT LOADING SKELETON -----------------
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

  // ----------------- NOT FOUND ERROR -----------------
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
  const environment = client?.environment || 'DEVELOPMENT';
  const domain = client?.domain || 'localhost';
  const domainStatus = client?.domainStatus || 'PENDING';
  const redirectUris = client?.redirectURIs || [];
  const verificationToken = client?.domainVerificationToken || 'pending-token-generation';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {clientName}
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400">
              {environment}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 mt-1">
            <Globe className="w-4 h-4 text-slate-400" />
            <span>{domain}</span>
            {domainStatus === 'VERIFIED' ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs ml-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Domain Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-500 font-semibold text-xs ml-2">
                <Clock className="w-3.5 h-3.5" />
                Pending DNS Verification
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openEditModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:border-[#FA812F] hover:text-[#FA812F] transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Details</span>
          </button>
          <button
            onClick={handleRotateSecret}
            disabled={rotating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} />
            <span>Rotate Secret</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Credentials & Domain Verification */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-[#FA812F]" />
              <span>OAuth Credentials</span>
            </h2>

            {/* ACTUAL Client ID */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                Client ID (Production & Dev)
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
              </div>
              <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1">
                Client secret is encrypted at rest. Click Rotate Secret to generate a new key if compromised.
              </p>
            </div>
          </div>

          {/* Domain Verification */}
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

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 font-mono text-xs text-slate-700 dark:text-neutral-300 mb-4 space-y-1.5">
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
                  className="text-slate-400 hover:text-[#FA812F] p-0.5"
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
                  className="text-slate-400 hover:text-[#FA812F] p-0.5"
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

        {/* Right Column: Redirect URIs */}
        <div className="lg:col-span-6">
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
