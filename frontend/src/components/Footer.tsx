import { BookOpen, Terminal, User, ExternalLink, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PramaanLogo } from './PramaanLogo';

const currentYear = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 pt-12 pb-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main 3-Column Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 pb-10 border-b border-slate-200 dark:border-neutral-900">
          
          {/* Column 1: Developer Hub */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FA812F]">
              <Terminal className="w-4 h-4" />
              <span>Developer Hub</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 leading-relaxed">
              Register OAuth 2.0 & OIDC applications, rotate client secrets, configure callback redirect URIs, and verify custom domains via DNS TXT records.
            </p>
            <div className="pt-1">
              <Link
                to="/developer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FA812F] hover:underline"
              >
                <span>Launch Developer Hub</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Column 2: Account Portal */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              <User className="w-4 h-4" />
              <span>Account Portal</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 leading-relaxed">
              Manage personal identity profile, upload user avatar pictures, update security passwords, audit active login sessions across devices, and control third-party app consents.
            </p>
            <div className="pt-1">
              <Link
                to="/account"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                <span>Access Account Portal</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Column 3: Resources & Open Standards */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              <BookOpen className="w-4 h-4 text-emerald-500" />
              <span>Resources & Protocol</span>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-500 dark:text-neutral-400">
              <li>
                <a
                  href="https://github.com/anuj304/Pramaan-IdP"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#FA812F] transition-colors inline-flex items-center gap-1.5"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </li>
              <li>
                <a
                  href="https://pramaan.anujacharjee.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#FA812F] transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Documentation</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </li>
              <li>
                <a
                  href="/.well-known/openid-configuration"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#FA812F] transition-colors font-mono text-xs"
                >
                  OIDC Discovery Document
                </a>
              </li>
              <li>
                <a
                  href="/.well-known/jwks.json"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#FA812F] transition-colors font-mono text-xs"
                >
                  Public JWKS Keyset
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Sub-footer */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-neutral-500 gap-4">
          <div className="flex items-center gap-3">
            <PramaanLogo size="sm" withText={true} />
            <span className="hidden sm:inline-block text-slate-300 dark:text-neutral-700">•</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              <span>RFC 6749 & 7636 Compliant</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span>© {currentYear} Pramaan. All rights reserved.</span>
            <span>•</span>
            <span>Zero-Trust Identity</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
