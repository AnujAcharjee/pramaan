import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Copy,
  Info,
  CheckCircle2,
  Lock,
  KeyRound,
  Globe,
  Terminal,
  Layers,
  Cpu,
  Server,
  User,
} from 'lucide-react';
import { PramaanLogo } from '../components/PramaanLogo';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const installCode = 'npm install @anuj304/pramaan';

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(installCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exampleCode = `import { PramaanClient } from '@anuj304/pramaan';

// 1. Initialize client with credentials
const pramaan = new PramaanClient({
  issuer: 'https://pramaan.anujacharjee.com',
  clientId: process.env.PRAMAAN_CLIENT_ID,
  clientSecret: process.env.PRAMAAN_CLIENT_SECRET,
  redirectUri: 'https://app.example.com/api/auth/callback',
});

// 2. Start authentication (auto-generates PKCE S256 challenge & secure state)
app.get('/login', async (req, res) => {
  const { url, transaction } = await pramaan.createAuthorizationRequest({
    scope: ['openid', 'profile', 'email'],
  });
  req.session.pramaan_tx = transaction;
  res.redirect(url);
});

// 3. Handle callback: verify PKCE & exchange code for validated tokens
app.get('/api/auth/callback', async (req, res) => {
  const tokens = await pramaan.handleCallback({
    code: req.query.code,
    state: req.query.state,
    transaction: req.session.pramaan_tx,
  });
  const user = await pramaan.getUserInfo(tokens.accessToken);
  res.json({ user, tokens });
});`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(exampleCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-black text-slate-900 dark:text-white transition-colors">
      
      {/* ----------------- HERO SECTION ----------------- */}
      <section id="hero" className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
        
        {/* Ambient Warm Color Aura in Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 pointer-events-none overflow-hidden opacity-60 dark:opacity-35 -z-10">
          <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-linear-to-br from-[#FF9644]/35 via-amber-400/20 to-purple-600/20 blur-3xl animate-pulse" />
          <div className="absolute -top-20 right-1/4 w-96 h-96 rounded-full bg-linear-to-bl from-[#FA812F]/30 via-rose-500/15 to-indigo-600/20 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Left Column: Text & CTA */}
            <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left">
              
              {/* Identity Provider Tag with Pramaan P Logo */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-orange-500/10 text-[#FA812F] border border-orange-500/20 tracking-wider uppercase mb-5 shadow-xs">
                <span className="font-bold">Identity Provider</span>
              </div>

              {/* Exact 2-Line Headline with Vivid Gradient */}
              <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12] mb-5">
                <span className="block sm:whitespace-nowrap">Ship authentication in</span>
                <span className="block sm:whitespace-nowrap bg-linear-to-r from-[#FF9644] via-[#FA812F] to-[#f43f5e] text-transparent bg-clip-text drop-shadow-[0_2px_15px_rgba(250,129,47,0.25)]">
                  just a few clicks.
                </span>
              </h1>

              {/* Supporting Copy */}
              <p className="text-base sm:text-lg text-slate-600 dark:text-neutral-400 leading-relaxed max-w-lg mb-8">
                Set up your application in Pramaan, grab your credentials, and use the official SDK to add secure authentication to your app.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-8">
                <Link
                  to={isAuthenticated ? "/developer" : "/signup"}
                  className="btn-orange w-full sm:w-auto px-8 py-3.5 text-base font-semibold group cursor-pointer"
                >
                  <span>{isAuthenticated ? "Go to Developer Hub" : "Get Started"}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                {/* Install Code Pill (Light gray in light mode, Dark gray in dark mode) */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-900 text-xs font-mono text-slate-800 dark:text-neutral-200 shadow-xs">
                  <Terminal className="w-3.5 h-3.5 text-[#FA812F]" />
                  <span>{installCode}</span>
                  <button
                    onClick={handleCopyInstall}
                    className="p-1 hover:text-[#FA812F] transition-colors cursor-pointer ml-1"
                    title="Copy npm command"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Feature Chips */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-medium text-slate-600 dark:text-neutral-400">
                <div className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>PKCE S256 Enforced</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#FA812F]" />
                  <span>Automated JWKS</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  <span>DNS TXT Verified</span>
                </div>
              </div>

            </div>

            {/* Right Column: Video Demo */}
            <div id="demo" className="lg:col-span-6 w-full">
              <div className="relative group">
                
                {/* Colorful Glow behind the video */}
                <div className="absolute -inset-1.5 bg-linear-to-r from-[#FF9644]/40 via-amber-500/25 to-purple-600/30 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative rounded-2xl bg-white dark:bg-black p-1.5 border border-slate-200 dark:border-neutral-800 shadow-2xl">
                  <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black flex items-center justify-center">
                    <video
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                      poster="https://res.cloudinary.com/ddsbhdeju/video/upload/so_0,f_auto,q_auto,w_1200/Video_Project_3_houcs8.jpg"
                    >
                      <source
                        src="https://res.cloudinary.com/ddsbhdeju/video/upload/Video_Project_3_houcs8.mp4"
                        type="video/mp4"
                      />
                      Your browser does not support HTML5 video.
                    </video>
                  </div>
                </div>

              </div>

              {/* Video Info Caption */}
              <div className="mt-3.5 flex items-start justify-center lg:justify-start gap-2 text-xs sm:text-[13px] text-slate-500 dark:text-neutral-400 text-center lg:text-left px-1">
                <span className="inline-flex items-center text-[#FA812F] shrink-0 mt-0.5" aria-hidden="true">
                  <Info className="w-3.5 h-3.5" />
                </span>
                <span className="leading-normal">
                  See how OpenSpace uses Pramaan to authenticate users, handle consent, and securely exchange tokens.
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

       {/* ----------------- HOW IT WORKS ----------------- */}
      <section id="how-it-works" className="py-20 border-t border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
              Standard OIDC in Three Simple Steps
            </h2>
            <p className="text-slate-600 dark:text-neutral-400 text-sm sm:text-base">
              Pramaan implements OAuth 2.0 Authorization Code Flow with PKCE for both server-rendered and single-page apps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Step 1 */}
            <div className="relative bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-8 rounded-2xl shadow-sm hover:border-[#FA812F]/50 transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/25 text-[#FA812F] flex items-center justify-center font-extrabold text-lg mb-5 shadow-sm group-hover:scale-105 transition-transform">
                01
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-500 block mb-1">
                Protocol Start
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Authorize</h3>
              <p className="text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                Your application redirects users to Pramaan with standard parameters: client_id, scopes, state, and PKCE code_challenge.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-8 rounded-2xl shadow-sm hover:border-purple-500/50 transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-500 flex items-center justify-center font-extrabold text-lg mb-5 shadow-sm group-hover:scale-105 transition-transform">
                02
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-500 block mb-1">
                Zero-Trust Check
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Consent & Code</h3>
              <p className="text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                Pramaan authenticates the user, checks permissions, displays a consent card if needed, and redirects back with an authorization code.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-8 rounded-2xl shadow-sm hover:border-emerald-500/50 transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 flex items-center justify-center font-extrabold text-lg mb-5 shadow-sm group-hover:scale-105 transition-transform">
                03
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 block mb-1">
                Cryptographic Mint
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Exchange & Verify</h3>
              <p className="text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                Your backend securely exchanges the code for signed ID and Access tokens verified automatically using JWKS rotation.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ----------------- DEDICATED CONSOLES / PORTALS SECTION ----------------- */}
      <section id="portals" className="py-20 border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-black transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            {/* <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-[#FA812F] border border-orange-500/20 uppercase tracking-wider mb-3">
              <Layers className="w-3.5 h-3.5" />
              <span>Two Distinct Consoles</span>
            </span> */}
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
              {/* Choose Your Entry Point */}
              Two Distinct Consoles
            </h2>
            <p className="text-slate-600 dark:text-neutral-400 text-sm sm:text-base leading-relaxed">
              Pramaan provides two dedicated portals tailored for distinct workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* User Account Portal Card */}
            <div className="relative bg-white dark:bg-black border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-sm hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all flex flex-col justify-between group">
              <div>
                {/* Header: Icon + Name */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-500 flex items-center justify-center font-extrabold text-lg shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    User Account Portal
                  </h3>
                </div>

                <p className="text-sm text-slate-600 dark:text-neutral-400 mb-6 leading-relaxed">
                  Your personal identity center to manage your profile, customize your user avatar picture, review active device sessions, and manage third-party consents.
                </p>

                <ul className="space-y-3 mb-8 text-xs sm:text-sm text-slate-700 dark:text-neutral-300">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>User Avi & Profile:</strong> Upload your photo avatar, edit your display name, and manage email.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Password & Security:</strong> Request secure password reset links and manage credential state.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Active Sessions:</strong> Real-time device visibility with one-click remote session termination.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Connected Apps:</strong> Review third-party application permissions and revoke consents at any time.</span>
                  </li>
                </ul>
              </div>

              <div>
                <Link
                  to="/account"
                  className="w-full py-3.5 text-sm font-semibold rounded-xl border-2 border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-500 hover:text-white dark:hover:bg-purple-500 dark:hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer group/btn"
                >
                  <span>Checkout User Portal</span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
                <p className="text-center text-[11px] text-slate-400 dark:text-neutral-500 mt-2">
                  For individual users. Manage your personal credentials and authorized apps.
                </p>
              </div>
            </div>

            {/* Developer Hub Card */}
            <div className="relative bg-white dark:bg-black border-2 border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-sm hover:border-[#FA812F] dark:hover:border-[#FA812F] transition-all flex flex-col justify-between group">
              <div>
                {/* Header: Icon + Name */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/25 text-[#FA812F] flex items-center justify-center font-extrabold text-lg shrink-0">
                    <Terminal className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Developer Hub
                  </h3>
                </div>

                <p className="text-sm text-slate-600 dark:text-neutral-400 mb-6 leading-relaxed">
                  The primary control plane to register OAuth 2.0 & OIDC applications, configure callback URIs, rotate client secrets, and verify domain ownership.
                </p>

                <ul className="space-y-3 mb-8 text-xs sm:text-sm text-slate-700 dark:text-neutral-300">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#FA812F] shrink-0 mt-0.5" />
                    <span><strong>Client Credentials:</strong> Instant Client ID & Secret generation and cryptographic rotation.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#FA812F] shrink-0 mt-0.5" />
                    <span><strong>Redirect URIs:</strong> Whitelist authorized callback endpoints per environment (Dev/Prod).</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#FA812F] shrink-0 mt-0.5" />
                    <span><strong>Domain Verification:</strong> Promote clients to production with DNS TXT record validation.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#FA812F] shrink-0 mt-0.5" />
                    <span><strong>OIDC Discovery:</strong> Ready-to-integrate discovery document & auto-cached JWKS endpoint.</span>
                  </li>
                </ul>
              </div>

              <div>
                <Link
                  to="/developer"
                  className="w-full py-3.5 text-sm font-semibold rounded-xl border-2 border-[#FA812F] text-[#FA812F] hover:bg-[#FA812F] hover:text-white dark:hover:text-black flex items-center justify-center gap-2 transition-all cursor-pointer group/btn"
                >
                  <span>Get Started as Developer</span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
                <p className="text-center text-[11px] text-slate-400 dark:text-neutral-500 mt-2">
                  For engineers building apps. Generate Client ID & Secret, set redirect URIs.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ----------------- CODE PLAYGROUND ----------------- */}
      <section id="playground" className="py-20 border-t border-slate-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: SDK Benefits */}
            <div className="lg:col-span-5">
              {/* <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-[#FA812F] border border-orange-500/20 uppercase tracking-wider mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Official TypeScript SDK</span>
              </div> */}
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
                Integrate in under five minutes
              </h2>
              <p className="text-slate-600 dark:text-neutral-400 text-sm sm:text-base leading-relaxed mb-6">
                Use the official <code className="text-[#FA812F] font-mono px-1 py-0.5 rounded bg-orange-500/10">@anuj304/pramaan</code> client to initialize authorization requests, handle callbacks, and verify ID tokens without writing custom crypto code.
              </p>

              <div className="space-y-3.5">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-neutral-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span>Automatic PKCE S256 code verifier generation</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-neutral-200">
                  <div className="w-6 h-6 rounded-full bg-orange-500/15 text-[#FA812F] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span>Built-in JWKS caching and asymmetric token validation</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-neutral-200">
                  <div className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span>Type-safe user profile claims & OpenID Connect scopes</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-neutral-200">
                  <div className="w-6 h-6 rounded-full bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span>Compatible with Node.js, Next.js, Express, Fastify, and Bun</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-neutral-800 flex items-center gap-4">
                <a
                  href="https://github.com/anuj304/Pramaan-IdP/tree/main/application/sdk"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#FA812F] hover:underline inline-flex items-center gap-1"
                >
                  <span>Explore SDK Repository</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Right Column: Colored Code Block (Light Gray in Light Mode, Dark Gray in Dark Mode) */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-300 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-900 shadow-2xl overflow-hidden transition-colors">
                
                {/* Window Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-200/80 dark:bg-neutral-800/80 border-b border-slate-300 dark:border-neutral-800">
                  {/* macOS Style Traffic Dots & Filename */}
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="ml-2 text-xs font-mono font-medium text-slate-600 dark:text-neutral-400">
                      auth.ts
                    </span>
                  </div>

                  {/* Header Actions: Language Badge & Copy */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-white dark:bg-black text-[#FA812F] border border-slate-300 dark:border-neutral-800">
                      TypeScript
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="px-2.5 py-1 rounded-md bg-white dark:bg-black hover:border-[#FA812F] border border-slate-300 dark:border-neutral-800 text-slate-700 dark:text-neutral-300 hover:text-[#FA812F] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                      title="Copy code"
                    >
                      {codeCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Preformatted Code with Vibrant Syntax Highlights */}
                <div className="p-6 font-mono text-xs sm:text-sm overflow-x-auto leading-relaxed text-slate-800 dark:text-neutral-200">
                  <pre className="whitespace-pre">
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">import</span>{' '}
                    <span className="text-slate-900 dark:text-white">{'{'}</span>{' '}
                    <span className="text-sky-600 dark:text-sky-400 font-semibold">PramaanClient</span>{' '}
                    <span className="text-slate-900 dark:text-white">{'}'}</span>{' '}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">from</span>{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">&apos;@anuj304/pramaan&apos;</span>;{'\n\n'}
                    <span className="text-slate-500 dark:text-neutral-500 italic">// 1. Initialize client with credentials</span>{'\n'}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">const</span>{' '}
                    <span className="text-indigo-600 dark:text-indigo-300">pramaan</span> ={' '}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">new</span>{' '}
                    <span className="text-sky-600 dark:text-sky-400 font-semibold">PramaanClient</span>({'{'}{'\n'}
                    {'  '}<span className="text-amber-600 dark:text-amber-400">issuer</span>:{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">&apos;https://pramaan.anujacharjee.com&apos;</span>,{'\n'}
                    {'  '}<span className="text-amber-600 dark:text-amber-400">clientId</span>:{' '}
                    process.env.PRAMAAN_CLIENT_ID,{'\n'}
                    {'  '}<span className="text-amber-600 dark:text-amber-400">clientSecret</span>:{' '}
                    process.env.PRAMAAN_CLIENT_SECRET,{'\n'}
                    {'  '}<span className="text-amber-600 dark:text-amber-400">redirectUri</span>:{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">&apos;https://app.example.com/api/auth/callback&apos;</span>,{'\n'}
                    {'}'});{'\n\n'}
                    <span className="text-slate-500 dark:text-neutral-500 italic">// 2. Start authentication (auto-generates PKCE S256 challenge & secure state)</span>{'\n'}
                    app.<span className="text-blue-600 dark:text-blue-400">get</span>(<span className="text-emerald-600 dark:text-emerald-400">&apos;/login&apos;</span>,{' '}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">async</span> (req, res) =&gt; {'{'}{'\n'}
                    {'  '}<span className="text-purple-600 dark:text-purple-400 font-semibold">const</span> {'{'} url, transaction {'}'} ={' '}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">await</span> pramaan.
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">createAuthorizationRequest</span>({'{'}{'\n'}
                    {'    '}<span className="text-amber-600 dark:text-amber-400">scope</span>: [<span className="text-emerald-600 dark:text-emerald-400">&apos;openid&apos;</span>, <span className="text-emerald-600 dark:text-emerald-400">&apos;profile&apos;</span>, <span className="text-emerald-600 dark:text-emerald-400">&apos;email&apos;</span>],{'\n'}
                    {'  '}{'}'});{'\n'}
                    {'  '}req.session.pramaan_tx = transaction;{'\n'}
                    {'  '}res.<span className="text-blue-600 dark:text-blue-400">redirect</span>(url);{'\n'}
                    {'}'});{'\n\n'}
                    <span className="text-slate-500 dark:text-neutral-500 italic">// 3. Handle callback: verify PKCE & exchange code for validated tokens</span>{'\n'}
                    app.<span className="text-blue-600 dark:text-blue-400">get</span>(<span className="text-emerald-600 dark:text-emerald-400">&apos;/api/auth/callback&apos;</span>,{' '}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">async</span> (req, res) =&gt; {'{'}{'\n'}
                    {'  '}<span className="text-purple-600 dark:text-purple-400 font-semibold">const</span> tokens ={' '}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">await</span> pramaan.
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">handleCallback</span>({'{'}{'\n'}
                    {'    '}<span className="text-amber-600 dark:text-amber-400">code</span>: req.query.code,{' '}<span className="text-amber-600 dark:text-amber-400">state</span>: req.query.state,{' '}<span className="text-amber-600 dark:text-amber-400">transaction</span>: req.session.pramaan_tx,{'\n'}
                    {'  '}{'}'});{'\n'}
                    {'  '}<span className="text-purple-600 dark:text-purple-400 font-semibold">const</span> user ={' '}
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">await</span> pramaan.
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">getUserInfo</span>(tokens.accessToken);{'\n'}
                    {'  '}res.<span className="text-blue-600 dark:text-blue-400">json</span>({'{'} user, tokens {'}'});{'\n'}
                    {'}'});
                  </pre>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ----------------- WHY PRAMAAN FEATURES ----------------- */}
      <section id="features" className="py-20 border-t border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
              Built for Modern Security Standards
            </h2>
            <p className="text-slate-600 dark:text-neutral-400 text-sm sm:text-base">
              Engineered with zero compromises on cryptographic security and identity specifications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Card 1: PKCE */}
            <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:border-cyan-500/50 transition-all hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center mb-4 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Enforced PKCE</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                Protects authorization codes from interception attacks on public and confidential clients alike using SHA-256 code challenges.
              </p>
            </div>

            {/* Card 2: JWKS */}
            <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:border-purple-500/50 transition-all hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Automated JWKS Rotation</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                Asymmetric key pairs rotate automatically without service disruption, exposed via standardized JSON Web Key Sets.
              </p>
            </div>

            {/* Card 3: DNS Verification */}
            <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:border-orange-500/50 transition-all hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center mb-4 shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">DNS TXT Domain Verification</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                Production OAuth clients must prove ownership of their domain via DNS TXT records before issuing production redirect URIs.
              </p>
            </div>

            {/* Card 4: Session Control */}
            <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:border-emerald-500/50 transition-all hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mb-4 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Dual Session Architecture</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                Ephemeral 15-minute active sessions backed by Redis and rolling 180-day identity sessions for smooth, secure user re-authentication.
              </p>
            </div>

            {/* Card 5: Zero Lock-In */}
            <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:border-rose-500/50 transition-all hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center mb-4 shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">RFC 6749 Compliant</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                Zero proprietary locks. Works seamlessly with any standard OAuth2 or OIDC client library in Python, Go, Java, or Node.js.
              </p>
            </div>

            {/* Card 6: Sub-millisecond Cache */}
            <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 p-6 rounded-2xl shadow-sm hover:border-amber-500/50 transition-all hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center mb-4 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Sub-Millisecond Redis</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                Distributed Redis clusters cache authorization requests, rate limit counters, and session metadata with microsecond latency.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ----------------- CALL TO ACTION BANNER ----------------- */}
      <section className="py-20 border-t border-slate-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 text-center">
            
            {/* Ambient Background Aura */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-linear-to-r from-orange-500/20 via-amber-500/15 to-rose-500/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 mb-4">
                <PramaanLogo size="lg" withText={false} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
                Ready to ship secure authentication?
              </h2>
              <p className="text-slate-600 dark:text-neutral-400 text-base mb-8">
                Create your developer client in seconds or explore our discovery documents to integrate Pramaan into your stack today.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to={isAuthenticated ? "/developer" : "/signup"}
                  className="btn-orange w-full sm:w-auto px-8 py-3.5 text-base font-semibold"
                >
                  <span>{isAuthenticated ? "Go to Developer Hub" : "Create Free Account"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to={isAuthenticated ? "/account" : "/developer"}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-lg border border-slate-300 dark:border-neutral-800 text-sm font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  {isAuthenticated ? "User Account Portal" : "Go to Developer Hub"}
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
