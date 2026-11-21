import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, duration = 10000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, message, duration };

      setToasts((prev) => [newToast, ...prev]);

      // Auto-remove after duration (default 10 seconds)
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}

      {/* FLOATING HOVERING TOAST CONTAINER AT THE TOP */}
      <div
        className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2.5 max-w-md w-full px-4 pointer-events-none transition-all duration-300"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full flex items-center justify-between gap-3 p-3.5 rounded-xl shadow-2xl backdrop-blur-md border transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
              toast.type === 'success'
                ? 'bg-white/95 dark:bg-neutral-950/95 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                : toast.type === 'error'
                ? 'bg-white/95 dark:bg-neutral-950/95 border-rose-500/40 text-rose-800 dark:text-rose-300'
                : 'bg-white/95 dark:bg-neutral-950/95 border-orange-500/40 text-slate-800 dark:text-neutral-200'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === 'success' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              {toast.type === 'error' && (
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              )}
              {toast.type === 'info' && (
                <Info className="w-5 h-5 text-[#FA812F] shrink-0" />
              )}
              <span className="text-xs sm:text-sm font-medium leading-snug break-words">
                {toast.message}
              </span>
            </div>

            {/* Cross to remove button */}
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
              title="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
