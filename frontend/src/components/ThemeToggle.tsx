import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      // Default to light screen; only use dark if user explicitly chose it
      return localStorage.getItem('pramaan_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('pramaan_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('pramaan_theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark((prev) => !prev)}
      className="p-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400 hover:text-[#FA812F] dark:hover:text-[#FA812F] hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
      aria-label="Toggle theme"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
    </button>
  );
}
