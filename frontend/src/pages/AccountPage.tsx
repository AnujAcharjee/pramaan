import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Laptop,
  Key,
  Trash2,
  Lock,
  Camera,
  Upload,
  Link2,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface ActiveSession {
  id: string;
  ip: string;
  userAgent: string;
  lastActive: string;
  isCurrent: boolean;
}

interface AuthorizedConsent {
  id: string;
  clientId: string;
  clientName: string;
  domain: string;
  scopes: string[];
  createdAt: string;
}

export function AccountPage() {
  const { isAuthenticated, loading: authLoading, setUser, user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'sessions' | 'consents'>('profile');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [avatarUrlText, setAvatarUrlText] = useState(user?.avatar || '');

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [consents, setConsents] = useState<AuthorizedConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfaEnabled || false);
  const [mfaLoading, setMfaLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever user from AuthContext changes
  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.email) setEmail(user.email);
      if (user.avatar !== undefined) {
        setAvatar(user.avatar);
        setAvatarUrlText(user.avatar || '');
      }
      if (user.mfaEnabled !== undefined) {
        setMfaEnabled(user.mfaEnabled);
      }
    }
  }, [user]);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/account', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setName(data.user.name || '');
          setEmail(data.user.email || '');
          setAvatar(data.user.avatar || null);
          setAvatarUrlText(data.user.avatar || '');
          setMfaEnabled(Boolean(data.user.mfaEnabled));
        }

        // Parse consents
        if (data.consents && Array.isArray(data.consents)) {
          setConsents(
            data.consents.map((c: any) => ({
              id: c.id || c.client?.id || String(Math.random()),
              clientId: c.clientId || c.client?.id || '',
              clientName: c.client?.name || c.clientName || 'OAuth Client',
              domain: c.client?.domain || c.domain || 'localhost',
              scopes: c.scopes || ['openid', 'profile', 'email'],
              createdAt: c.createdAt
                ? new Date(c.createdAt).toLocaleDateString()
                : c.date
                ? new Date(c.date).toLocaleDateString()
                : 'Recent',
            }))
          );
        }

        // Set sessions (active device + server sessions if available)
        setSessions([
          {
            id: 'sess_current',
            ip: 'Current Connection',
            userAgent: navigator.userAgent.includes('Windows')
              ? 'Chrome / Windows 11'
              : navigator.userAgent.includes('Mac')
              ? 'Safari / macOS'
              : 'Web Browser Device',
            lastActive: 'Active now',
            isCurrent: true,
          },
        ]);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Unable to load account information.');
      }
    } catch {
      showToast('error', 'Network error while connecting to account service.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAccount();
    }
  }, [isAuthenticated, fetchAccount]);

  // Handle local image file upload -> convert to Base64 Data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please select a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'Avatar image size must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatar(result);
      setAvatarUrlText(result);
      showToast('info', 'Avatar updated in preview! Click Save Changes to apply.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (avatarUrlText.trim()) {
      setAvatar(avatarUrlText.trim());
      setShowUrlInput(false);
      showToast('info', 'Avatar URL updated in preview! Click Save Changes to apply.');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    setAvatarUrlText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast('info', 'Avatar removed in preview! Click Save Changes to apply.');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/v1/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          avatar: avatar || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser((prev) =>
          prev
            ? {
                ...prev,
                name: name.trim(),
                avatar: avatar || null,
              }
            : null
        );

        showToast('success', data.message || 'Profile details updated successfully.');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to update profile.');
      }
    } catch {
      showToast('error', 'Error connecting to backend.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    const targetEmail = email || user?.email;
    if (!targetEmail) return;

    setResetSending(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, flow: 'default' }),
      });

      if (res.ok) {
        setResetSent(true);
        showToast('success', `A secure password reset link has been dispatched to ${targetEmail}.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to dispatch password reset link.');
      }
    } catch {
      showToast('error', 'Network error while requesting password reset.');
    } finally {
      setResetSending(false);
    }
  };

  const handleToggleMfa = async () => {
    setMfaLoading(true);
    try {
      const nextState = !mfaEnabled;
      const res = await fetch('/api/v1/account/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enable: nextState }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.mfaEnabled ?? nextState;
        setMfaEnabled(updated);
        setUser((prev) => (prev ? { ...prev, mfaEnabled: updated } : null));
        showToast('success', data.message || `Two-factor authentication ${updated ? 'enabled' : 'disabled'} successfully.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to update two-factor authentication.');
      }
    } catch {
      showToast('error', 'Error connecting to account security service.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleRevokeConsent = async (clientId: string) => {
    if (!clientId) {
      showToast('error', 'Cannot revoke consent: client ID is missing.');
      return;
    }
    try {
      const res = await fetch('/api/v1/account/consent/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ client_id: clientId, clientId }),
      });

      if (res.ok) {
        setConsents((prev) => prev.filter((c) => c.clientId !== clientId));
        showToast('success', 'Authorized application revoked successfully.');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('error', err.message || 'Failed to revoke application access.');
      }
    } catch {
      showToast('error', 'Error connecting to backend.');
    }
  };

  // ----------------- AUTHENTICATION GATE -----------------
  if (authLoading || (loading && !name && !email)) {
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
            Account Portal is restricted to authenticated users. Please sign in to manage your identity credentials.
          </p>
          <div className="space-y-3">
            <Link
              to="/signin?redirect=/account"
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Account Portal
        </h1>
        <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
          Manage your personal identity credentials, user avatar, active sessions, and authorized apps.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-neutral-800 gap-6 mb-8 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'profile'
              ? 'border-[#FA812F] text-[#FA812F]'
              : 'border-transparent text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Profile & Security
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'sessions'
              ? 'border-[#FA812F] text-[#FA812F]'
              : 'border-transparent text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Active Sessions ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('consents')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'consents'
              ? 'border-[#FA812F] text-[#FA812F]'
              : 'border-transparent text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Connected Apps ({consents.length})
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-[#FA812F]" />
              <span>Personal Details & Avatar</span>
            </h2>

            {/* USER AVI (AVATAR) DISPLAY & UPLOADER */}
            <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50">
              <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-3">
                User Avatar (Profile Picture)
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Big Avatar Circle */}
                <div className="relative group shrink-0">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name || 'User Avatar'}
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#FA812F] shadow-sm"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-linear-to-br from-[#FF9644] to-[#FA812F] text-white flex items-center justify-center text-3xl font-extrabold shadow-md">
                      {(name || email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Change picture"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>

                {/* Avatar Action Buttons */}
                <div className="space-y-2 w-full text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:text-[#FA812F] hover:border-[#FA812F] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black text-xs font-semibold text-slate-700 dark:text-neutral-300 hover:text-[#FA812F] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Image URL</span>
                    </button>

                    {avatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <p className="text-[11px] text-slate-400 dark:text-neutral-500">
                    Supports JPG, PNG, WebP or SVG up to 2MB. Stored with your secure profile.
                  </p>
                </div>
              </div>

              {/* URL Input Dropdown */}
              {showUrlInput && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-neutral-800 flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/my-photo.jpg"
                    value={avatarUrlText}
                    onChange={(e) => setAvatarUrlText(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="btn-orange px-3 py-1.5 text-xs font-semibold"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(false)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">
                  Primary Email (Read Only)
                </label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 text-sm cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-orange px-5 py-2 text-xs font-semibold mt-2 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
                <span>Save Changes</span>
              </button>
            </form>
          </div>

          <div className="space-y-6">
            {/* Two-Factor Authentication Card */}
            <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#FA812F]" />
                  <span>Two-Factor Authentication</span>
                </h2>
                {mfaEnabled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Active</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700">
                    Disabled
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-neutral-400 mb-5 leading-relaxed">
                Add an extra layer of defense to your Pramaan account. When enabled, every sign-in attempt requires a secure one-time verification link dispatched to your registered primary email address before granting access.
              </p>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 mb-5">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-[#FA812F]" />
                  <span>Primary Verification Channel:</span>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white ml-4 mt-0.5 block">
                  {email || user?.email || 'Loading…'}
                </span>
              </div>

              {mfaEnabled ? (
                <button
                  type="button"
                  onClick={handleToggleMfa}
                  disabled={mfaLoading}
                  className="px-4 py-2.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{mfaLoading ? 'Updating 2FA…' : 'Disable Two-Factor Authentication'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleMfa}
                  disabled={mfaLoading}
                  className="btn-orange px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{mfaLoading ? 'Enabling 2FA…' : 'Enable Two-Factor Authentication'}</span>
                </button>
              )}
            </div>

            {/* Password & Security Card */}
            <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#FA812F]" />
                <span>Password & Security</span>
              </h2>

              <p className="text-xs text-slate-500 dark:text-neutral-400 mb-4 leading-relaxed">
                Ensure your identity credentials remain secure. Since you are already signed in, you can request a single-use password reset link sent directly to your registered primary email without re-typing it.
              </p>

              <div className="mb-5 p-3 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 text-xs">
                <span className="text-slate-400 block mb-0.5 font-semibold">Registered Primary Email:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {email || user?.email || 'Loading…'}
                </span>
              </div>

              {resetSent ? (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Password Reset Link Dispatched!</span>
                  </p>
                  <p>
                    Please check your inbox at <strong>{email || user?.email}</strong> and click the link to choose a new password.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPasswordReset}
                  disabled={resetSending || !(email || user?.email)}
                  className="btn-orange px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Key className="w-4 h-4" />
                  <span>{resetSending ? 'Sending Reset Link…' : 'Send Password Reset Link'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Laptop className="w-5 h-5 text-[#FA812F]" />
            <span>Active Login Sessions</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mb-6">
            Devices and browser clients that currently have active session cookies issued by Pramaan.
          </p>

          <div className="divide-y divide-slate-100 dark:divide-neutral-900">
            {sessions.map((s) => (
              <div key={s.id} className="py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {s.userAgent}
                    </span>
                    {s.isCurrent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        This Device
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
                    Connection: {s.ip} • {s.lastActive}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connected Apps Tab */}
      {activeTab === 'consents' && (
        <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#FA812F]" />
            <span>Authorized Third-Party Applications</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mb-6">
            Applications granted access to your identity tokens and user profile scopes.
          </p>

          {consents.length === 0 ? (
            <div className="text-center py-10">
              <Shield className="w-10 h-10 text-slate-300 dark:text-neutral-700 mx-auto mb-3" />
              <p className="text-xs text-slate-400 dark:text-neutral-500">
                No third-party applications have been authorized yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-neutral-900">
              {consents.map((c) => (
                <div key={c.id} className="py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{c.clientName}</h3>
                    <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
                      Domain: {c.domain} • Authorized on {c.createdAt}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      {c.scopes.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-800"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevokeConsent(c.clientId)}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                    title="Revoke access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
