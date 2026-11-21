import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-white dark:bg-black transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 shadow-xl text-center">
        
        {/* 404 Illustration */}
        <div className="flex justify-center mb-6">
          <img
            src="/images/404 Error.svg"
            alt="404 Page Not Found"
            className="w-56 h-auto drop-shadow-sm dark:opacity-90"
          />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
          Page not found
        </h1>

        <p className="text-sm text-slate-500 dark:text-neutral-400 mb-8 leading-relaxed">
          The page you are looking for doesn't exist, may have moved, or the authorization session expired.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="btn-orange w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-semibold"
          >
            <Home className="w-4 h-4" />
            <span>Go to Landing</span>
          </Link>

          <Link
            to="/signin"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Sign In</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
