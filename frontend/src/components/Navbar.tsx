import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { PramaanLogo } from './PramaanLogo';
import { ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { isAuthenticated, user, signout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-slate-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo with Pramaan 'P' Logo */}
        <Link to="/" className="flex items-center">
          <PramaanLogo size="md" />
        </Link>

        {/* When signed in: strictly remove signin, getstarted, and other nav options per user request */}
        {!isAuthenticated && (
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-neutral-400">
            <a href="/#demo" className="hover:text-[#FA812F] dark:hover:text-[#FA812F] transition-colors">
              Demo
            </a>
            <a href="/#how-it-works" className="hover:text-[#FA812F] dark:hover:text-[#FA812F] transition-colors">
              How it works
            </a>
            <a href="/#portals" className="hover:text-[#FA812F] dark:hover:text-[#FA812F] transition-colors">
              Consoles
            </a>
            <a href="/#playground" className="hover:text-[#FA812F] dark:hover:text-[#FA812F] transition-colors">
              Implementation
            </a>
            <a href="/#features" className="hover:text-[#FA812F] dark:hover:text-[#FA812F] transition-colors">
              Why Pramaan
            </a>
          </nav>
        )}

        {/* Actions & Theme */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* When signed in: only keep theme toggle and subtle sign-out/avatar link */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2.5 pl-1">
              <Link
                to="/account"
                className="flex items-center gap-2 p-1 rounded-full border border-slate-200 dark:border-neutral-800 hover:border-[#FA812F] dark:hover:border-[#FA812F] transition-colors"
                title="Account Portal"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User Avatar'}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-linear-to-br from-[#FF9644] to-[#FA812F] text-white flex items-center justify-center text-xs font-bold">
                    {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>
              <button
                onClick={signout}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-neutral-400 hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/signin"
                className="hidden sm:inline-flex text-sm font-semibold text-slate-700 dark:text-neutral-300 hover:text-[#FA812F] dark:hover:text-[#FA812F] px-3.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors"
              >
                Sign in
              </Link>

              <Link
                to="/signup"
                className="btn-orange text-xs sm:text-sm px-4 sm:px-5 py-2 font-semibold"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
