import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Lock,
  ArrowRight,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
  Edit3,
  X,
  Rocket,
  Terminal,
  Code2,
  Search,
  Power,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface OAuthClient {
  id: string;
  userId?: string;
  name: string;
  domain: string;
  avatar?: string | null;
  environment: 'development' | 'production' | 'DEVELOPMENT' | 'PRODUCTION';
  domainStatus: 'PENDING' | 'VERIFIED' | 'UNVERIFIED';
  clientType: 'CONFIDENTIAL' | 'PUBLIC';
  enforcePKCE?: boolean;
  redirectURIs?: string[];
  isActive?: boolean;
  createdAt?: string;
}

interface DeveloperPageProps {
  openCreateModal?: boolean;
}

export function DeveloperPage({ openCreateModal = false }: DeveloperPageProps) {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [envFilter, setEnvFilter] = useState<'ALL' | 'PRODUCTION' | 'DEVELOPMENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Per-client action loading states
  const [switchingEnvId, setSwitchingEnvId] = useState<string | null>(null);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);

  // Verification modal when attempting to promote unverified client
  const [verificationWarningClient, setVerificationWarningClient] = useState<OAuthClient | null>(null);

  // Create client modal state
  const [showModal, setShowModal] = useState(openCreateModal);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [clientType, setClientType] = useState<'CONFIDENTIAL' | 'PUBLIC'>('CONFIDENTIAL');
  const [creating, setCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Edit client modal state
  const [editingClient, setEditingClient] = useState<OAuthClient | null>(null);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [updating, setUpdating] = useState(false);

  // Newly created credentials modal
  const [newCredentials, setNewCredentials] = useState<{ id: string; name: string; secret: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const discoveryDoc = `${window.location.origin}/.well-known/openid-configuration`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/developer/clients', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Unable to load registered applications.');
      }
    } catch {
      showToast('error', 'Network connection error while fetching developer clients.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchClients();
    }
  }, [isAuthenticated, fetchClients]);

  // ----------------- SWITCH ENVIRONMENT (DEV <-> PROD) -----------------
  const handleSwitchEnvironment = async (client: OAuthClient) => {
    const isCurrentProd = String(client.environment).toLowerCase() === 'production';
    const nextEnv = isCurrentProd ? 'development' : 'production';

    if (nextEnv === 'production') {
      if (client.domainStatus !== 'VERIFIED') {
        setVerificationWarningClient(client);
        return;
      }
      if (
        !confirm(
          `Promoting "${client.name}" to Production mode will enforce HTTPS-only callbacks matching verified domain "${client.domain}". Any development redirect URIs will be cleared. Continue?`
        )
      ) {
        return;
      }
    }

    setSwitchingEnvId(client.id);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(client.id)}/environment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ environment: nextEnv }),
      });

      if (res.ok) {
        const data = await res.json();
        setClients((prev) =>
          prev.map((c) =>
            c.id === client.id
              ? {
                  ...c,
                  environment: data.client.environment,
                  redirectURIs: data.client.redirectURIs ?? (nextEnv === 'production' ? [] : c.redirectURIs),
                }
              : c
          )
        );
        showToast('success', data.message || `Switched "${client.name}" to ${nextEnv} mode.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to switch environment mode.');
      }
    } catch {
      showToast('error', 'Error connecting to developer service.');
    } finally {
      setSwitchingEnvId(null);
    }
  };

  // ----------------- TOGGLE ACTIVE / SUSPENDED STATUS -----------------
  const handleToggleStatus = async (client: OAuthClient) => {
    const nextVal = client.isActive === false; // Toggle to true if false, else false
    const actionLabel = nextVal ? 'activate' : 'suspend';

    if (
      !confirm(
        `Are you sure you want to ${actionLabel} "${client.name}"? ${
          !nextVal
            ? 'Tokens will be revoked and users will not be able to authenticate until re-activated.'
            : 'The application will resume authenticating users immediately.'
        }`
      )
    ) {
      return;
    }

    setTogglingStatusId(client.id);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(client.id)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: nextVal }),
      });

      if (res.ok) {
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? { ...c, isActive: nextVal } : c))
        );
        showToast('success', `Application "${client.name}" ${nextVal ? 'activated' : 'suspended'}.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to update application status.');
      }
    } catch {
      showToast('error', 'Error connecting to developer service.');
    } finally {
      setTogglingStatusId(null);
    }
  };

  // ----------------- CREATE CLIENT -----------------
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/v1/developer/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          domain: domain.trim() || 'localhost',
          client_type: clientType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowModal(false);
        setName('');
        setDomain('');
        showToast('success', 'Application registered successfully!');

        if (data.client) {
          setNewCredentials({
            id: data.client.id,
            name: data.client.name,
            secret: data.clientSecret || data.client.clientSecret || '',
          });
          setClients((prev) => [data.client, ...prev]);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to create application.');
      }
    } catch {
      showToast('error', 'Failed to create application. Please check backend connection.');
    } finally {
      setCreating(false);
    }
  };

  // ----------------- EDIT CLIENT DETAILS -----------------
  const openEditModal = (client: OAuthClient) => {
    setEditingClient(client);
    setEditName(client.name);
    setEditDomain(client.domain);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editName.trim()) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/developer/clients/${encodeURIComponent(editingClient.id)}`, {
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
        setClients((prev) =>
          prev.map((c) =>
            c.id === editingClient.id
              ? {
                  ...c,
                  name: data.client.name,
                  domain: data.client.domain,
                  domainStatus: data.client.domainStatus,
                  environment: data.client.environment,
                }
              : c
          )
        );
        setEditingClient(null);
        showToast('success', 'Application details updated successfully!');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to update application.');
      }
    } catch {
      showToast('error', 'Network error connecting to backend.');
    } finally {
      setUpdating(false);
    }
  };

  // ----------------- FILTERED APPLICATIONS & METRICS -----------------
  const totalAppsCount = clients.length;
  const prodAppsCount = clients.filter((c) => String(c.environment).toLowerCase() === 'production').length;
  const devAppsCount = clients.filter((c) => String(c.environment).toLowerCase() === 'development').length;
  const verifiedDomainsCount = clients.filter((c) => c.domainStatus === 'VERIFIED').length;

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const isProd = String(c.environment).toLowerCase() === 'production';
      if (envFilter === 'PRODUCTION' && !isProd) return false;
      if (envFilter === 'DEVELOPMENT' && isProd) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDomain = c.domain.toLowerCase().includes(q);
        const matchesId = c.id.toLowerCase().includes(q);
        return matchesName || matchesDomain || matchesId;
      }

      return true;
    });
  }, [clients, envFilter, searchQuery]);

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
            Developer Hub is restricted to authenticated developers. Please sign in to register or manage your OAuth 2.0 applications.
          </p>
          <div className="space-y-3">
            <Link
              to="/signin?redirect=/developer"
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Developer Hub
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-orange-500/10 text-[#FA812F] border border-orange-500/20">
              OAuth 2.0 & OIDC
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Register, configure, and monitor your client credentials, environment modes, and security policies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchClients}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400 hover:text-[#FA812F] hover:border-[#FA812F] transition-colors cursor-pointer"
            title="Refresh application list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-orange text-xs sm:text-sm px-4 py-2.5 font-semibold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Application</span>
          </button>
        </div>
      </div>

      {/* METRICS & DEVELOPER STATS SUMMARY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-neutral-400">Total Applications</span>
            <Layers className="w-4 h-4 text-slate-400 dark:text-neutral-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalAppsCount}</div>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5">Active & registered clients</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Production Mode</span>
            <Rocket className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{prodAppsCount}</div>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5">HTTPS verified live apps</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Development Mode</span>
            <Terminal className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{devAppsCount}</div>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5">Localhost & staging sandboxes</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#FA812F]">Verified Domains</span>
            <ShieldCheck className="w-4 h-4 text-[#FA812F]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{verifiedDomainsCount}</div>
          <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-0.5">DNS TXT validated domains</p>
        </div>
      </div>

      {/* OIDC DISCOVERY BANNER */}
      <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#FA812F] block mb-0.5">
            OIDC Discovery Document
          </span>
          <p className="text-xs sm:text-sm font-mono text-slate-700 dark:text-neutral-300 break-all">
            {discoveryDoc}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => copyToClipboard(discoveryDoc, 'discovery')}
            className="p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:text-[#FA812F] transition-colors cursor-pointer"
            title="Copy OIDC URL"
          >
            {copiedKey === 'discovery' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={discoveryDoc}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:text-[#FA812F] transition-colors"
            title="Open Document"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* FILTER TABS & SEARCH CONTROLS */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        {/* Environment Filter Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 w-fit">
          <button
            onClick={() => setEnvFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              envFilter === 'ALL'
                ? 'bg-white dark:bg-black text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Applications ({totalAppsCount})
          </button>
          <button
            onClick={() => setEnvFilter('PRODUCTION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              envFilter === 'PRODUCTION'
                ? 'bg-white dark:bg-black text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-neutral-400 hover:text-emerald-500'
            }`}
          >
            <Rocket className="w-3.5 h-3.5 text-emerald-500" />
            <span>Production ({prodAppsCount})</span>
          </button>
          <button
            onClick={() => setEnvFilter('DEVELOPMENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              envFilter === 'DEVELOPMENT'
                ? 'bg-white dark:bg-black text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-neutral-400 hover:text-amber-500'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-amber-500" />
            <span>Development ({devAppsCount})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[260px] sm:min-w-[320px]">
          <Search className="w-4 h-4 text-slate-400 dark:text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, client ID, or domain..."
            className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#FA812F] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && clients.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 h-64 animate-pulse"
            />
          ))}
        </div>
      ) : clients.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-4 bg-white dark:bg-black border border-dashed border-slate-300 dark:border-neutral-800 rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#FA812F] flex items-center justify-center mx-auto mb-4">
            <Key className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            No applications registered yet
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            Register your first OAuth 2.0 application to generate client credentials and start authenticating users.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-orange text-xs sm:text-sm px-5 py-2 font-semibold"
          >
            <span>Register First Application</span>
          </button>
        </div>
      ) : filteredClients.length === 0 ? (
        /* Filter No Match State */
        <div className="text-center py-12 px-4 bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl">
          <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-2">
            No applications match your filter criteria.
          </p>
          <button
            onClick={() => {
              setEnvFilter('ALL');
              setSearchQuery('');
            }}
            className="text-xs text-[#FA812F] font-semibold hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* APPLICATIONS CONSOLE GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((c) => {
            const isProd = String(c.environment).toLowerCase() === 'production';
            const isClientActive = c.isActive !== false;
            const isSwitchingThis = switchingEnvId === c.id;
            const isTogglingThis = togglingStatusId === c.id;
            const redirectCount = c.redirectURIs?.length || 0;

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xs hover:border-[#FA812F]/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header: Environment & Active Badges */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        isProd
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {isProd ? <Rocket className="w-3 h-3 text-emerald-500" /> : <Terminal className="w-3 h-3 text-amber-500" />}
                      <span>{isProd ? 'PRODUCTION' : 'DEVELOPMENT'}</span>
                    </span>

                    {/* Active Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                        isClientActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-neutral-500'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isClientActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-neutral-600'
                        }`}
                      />
                      <span>{isClientActive ? 'Active' : 'Suspended'}</span>
                    </span>
                  </div>

                  {/* Client Name & Domain */}
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 truncate">{c.name}</h3>

                  <div className="flex items-center justify-between gap-2 mb-4">
                    <p className="text-xs text-slate-500 dark:text-neutral-400 flex items-center gap-1.5 truncate">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{c.domain}</span>
                    </p>

                    {c.domainStatus === 'VERIFIED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500 shrink-0" title="DNS TXT verification required for production">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Pending DNS
                      </span>
                    )}
                  </div>

                  {/* PROMINENT ACTUAL CLIENT ID WITH 1-CLICK COPY */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400 mb-1 font-semibold">
                      <span>Actual Client ID</span>
                      <button
                        onClick={() => copyToClipboard(c.id, c.id)}
                        className="text-[#FA812F] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === c.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500 text-[10px]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 font-mono text-[11px] text-slate-900 dark:text-neutral-200 select-all truncate">
                      {c.id}
                    </div>
                  </div>

                  {/* DEVELOPER OPTIONS & ARCHITECTURE SUMMARY BADGES */}
                  <div className="p-3 rounded-xl bg-slate-50/60 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 mb-5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-neutral-400 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        Client Type:
                      </span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-neutral-300">
                        {c.clientType === 'CONFIDENTIAL' ? 'Confidential (Backend)' : 'Public (SPA/PKCE)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-neutral-400 flex items-center gap-1">
                        <Code2 className="w-3 h-3 text-slate-400" />
                        PKCE Policy:
                      </span>
                      <span
                        className={`font-semibold ${
                          c.enforcePKCE !== false
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-neutral-400'
                        }`}
                      >
                        {c.enforcePKCE !== false ? 'Enforced (RFC 7636)' : 'Optional'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-neutral-400 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                        Redirect URIs:
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-neutral-300">
                        {redirectCount} configured
                      </span>
                    </div>
                  </div>
                </div>

                {/* CARD ACTIONS & QUICK ENVIRONMENT SWITCHER */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-neutral-900">
                  {/* DIRECT ENVIRONMENT SWITCHER BUTTON */}
                  <button
                    onClick={() => handleSwitchEnvironment(c)}
                    disabled={isSwitchingThis}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 ${
                      isProd
                        ? 'border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                        : 'border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                    }`}
                    title={
                      isProd
                        ? 'Switch back to Development sandbox mode'
                        : 'Promote application to live Production mode'
                    }
                  >
                    <Rocket className={`w-3.5 h-3.5 ${isSwitchingThis ? 'animate-spin' : ''}`} />
                    <span>
                      {isSwitchingThis
                        ? 'Switching Mode…'
                        : isProd
                        ? 'Switch to Development'
                        : 'Promote to Production'}
                    </span>
                  </button>

                  {/* MANAGE & SECONDARY ACTIONS */}
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/client/${c.id}`}
                      className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-[#FA812F] dark:hover:bg-[#FA812F] dark:hover:text-white text-xs font-semibold text-center transition-colors block"
                    >
                      Manage Application
                    </Link>

                    {/* Toggle Active / Suspended Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(c)}
                      disabled={isTogglingThis}
                      className={`p-2 rounded-xl border border-slate-200 dark:border-neutral-800 transition-colors cursor-pointer ${
                        isClientActive
                          ? 'text-slate-500 hover:text-rose-500 hover:border-rose-300'
                          : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-emerald-500/30'
                      }`}
                      title={isClientActive ? 'Suspend application' : 'Activate application'}
                    >
                      <Power className={`w-3.5 h-3.5 ${isTogglingThis ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Edit Name & Domain Modal Trigger */}
                    <button
                      type="button"
                      onClick={() => openEditModal(c)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-neutral-400 hover:text-[#FA812F] hover:border-[#FA812F] transition-colors cursor-pointer"
                      title="Edit Name & Domain"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------- DOMAIN VERIFICATION WARNING MODAL ----------------- */}
      {verificationWarningClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Domain Verification Required
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-4 leading-relaxed">
              To promote <strong className="text-slate-900 dark:text-white">"{verificationWarningClient.name}"</strong> to Production mode, you must verify ownership of domain <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-900 font-mono text-[#FA812F]">{verificationWarningClient.domain}</code> via DNS TXT record.
            </p>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-6 leading-relaxed">
              This cryptographic verification prevents OAuth redirect hijacking and ensures your users are redirected exclusively to domains you own.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setVerificationWarningClient(null)}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = verificationWarningClient.id;
                  setVerificationWarningClient(null);
                  navigate(`/client/${targetId}`);
                }}
                className="btn-orange px-5 py-2.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Verify Domain in Settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- CREATE CLIENT MODAL ----------------- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">New OAuth Application</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-6">
              Create client credentials for your backend API or single-page application.
            </p>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Application Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Production"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9644]/30 focus:border-[#FF9644]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Host Domain (or localhost)
                </label>
                <input
                  type="text"
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com or localhost"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9644]/30 focus:border-[#FF9644]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Client Type
                </label>
                <select
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value as 'CONFIDENTIAL' | 'PUBLIC')}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9644]/30 focus:border-[#FF9644]"
                >
                  <option value="CONFIDENTIAL">Confidential Client (Backend Server / API with Secret)</option>
                  <option value="PUBLIC">Public Client (SPA / Mobile App with PKCE)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-orange px-5 py-2.5 text-xs font-semibold cursor-pointer"
                >
                  {creating ? 'Registering...' : 'Register Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- NEW CREDENTIALS GENERATED MODAL ----------------- */}
      {newCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mb-4">
              <Key className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              Application Credentials Generated
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-6">
              Save your Client Secret immediately. For security, client secrets cannot be retrieved again.
            </p>

            <div className="space-y-4 mb-6">
              {/* Actual Client ID */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                  Actual Client ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newCredentials.id}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 font-mono text-xs text-slate-900 dark:text-white select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(newCredentials.id, 'modal_id')}
                    className="p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:text-[#FA812F] cursor-pointer"
                    title="Copy Client ID"
                  >
                    {copiedKey === 'modal_id' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Client Secret */}
              {newCredentials.secret && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">
                    Client Secret
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      readOnly
                      value={newCredentials.secret}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 font-mono text-xs text-slate-900 dark:text-white select-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:text-[#FA812F] cursor-pointer"
                      title={showSecret ? 'Hide secret' : 'Show secret'}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(newCredentials.secret, 'modal_sec')}
                      className="p-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:text-[#FA812F] cursor-pointer"
                      title="Copy Secret"
                    >
                      {copiedKey === 'modal_sec' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setNewCredentials(null)}
                className="btn-orange px-6 py-2.5 text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- EDIT APPLICATION MODAL ----------------- */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Application Details</h2>
              <button
                onClick={() => setEditingClient(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mb-6">
              Update the application name and primary domain.
            </p>

            <form onSubmit={handleUpdateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Application Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Acme Web & API"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Primary Domain
                </label>
                <input
                  type="text"
                  required
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  placeholder="e.g. app.example.com or localhost"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-xs font-mono"
                />
                <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-1">
                  Changing the domain will reset domain verification status to PENDING and require DNS TXT validation.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn-orange px-5 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${updating ? 'animate-spin' : ''}`} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
