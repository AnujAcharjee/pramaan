import { useState } from 'react';

interface PramaanLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withText?: boolean;
}

export function PramaanLogo({ className = '', size = 'md', withText = true }: PramaanLogoProps) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8 sm:w-9 sm:h-9',
    lg: 'w-10 h-10 sm:w-11 sm:h-11',
    xl: 'w-14 h-14',
  };

  const textClasses = {
    sm: 'text-base font-bold',
    md: 'text-lg sm:text-xl font-extrabold',
    lg: 'text-xl sm:text-2xl font-extrabold',
    xl: 'text-2xl sm:text-3xl font-extrabold',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 group ${className}`}>
      <div
        className={`relative overflow-hidden rounded-xl shadow-md shadow-orange-500/25 group-hover:scale-105 transition-transform duration-200 border border-orange-500/30 shrink-0 ${sizeClasses[size]}`}
      >
        {!imgError ? (
          <img
            src="/android-chrome-192x192.png"
            alt="Pramaan Logo"
            className="w-full h-full object-cover rounded-xl"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-[#FF9644] to-[#FA812F] flex items-center justify-center text-white font-extrabold text-lg select-none">
            P
          </div>
        )}
      </div>

      {withText && (
        <span
          className={`tracking-tight text-slate-900 dark:text-white group-hover:text-[#FA812F] transition-colors ${textClasses[size]}`}
        >
          Pramaan
        </span>
      )}
    </div>
  );
}
