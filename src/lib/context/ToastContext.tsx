"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from"react";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type ToastVariant ="success" |"error" |"info" |"warning";

interface Toast {
 id: string;
 message: string;
 variant: ToastVariant;
 duration: number;
}

interface ToastContextValue {
 toast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

/* ------------------------------------------------------------------ */
/* Context */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
 const ctx = useContext(ToastContext);
 if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
 return ctx;
}

/* ------------------------------------------------------------------ */
/* Icons */
/* ------------------------------------------------------------------ */

const VARIANT_ICONS: Record<ToastVariant, string> = {
 success:"✅",
 error:"❌",
 info:"ℹ️",
 warning:"⚠️",
};

/* ------------------------------------------------------------------ */
/* Provider + Renderer */
/* ------------------------------------------------------------------ */

export function ToastProvider({ children }: { children: ReactNode }) {
 const [toasts, setToasts] = useState<Toast[]>([]);

 const addToast = useCallback((message: string, variant: ToastVariant ="success", duration = 5000) => {
 const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
 setToasts((prev) => [...prev, { id, message, variant, duration }]);

 // Auto-dismiss
 setTimeout(() => {
 setToasts((prev) => prev.filter((t) => t.id !== id));
 }, duration);
 }, []);

 const dismiss = useCallback((id: string) => {
 setToasts((prev) => prev.filter((t) => t.id !== id));
 }, []);

 return (
 <ToastContext.Provider value={{ toast: addToast }}>
 {children}

 {/* Toast Container */}
 {toasts.length > 0 && (
 <div
 className="top-[calc(sticky top-[var(--header-height)] z-40 border-b border-stone-200 bg-stone-100"
 aria-live="polite"
 >
 {toasts.map((t) => (
 <div key={t.id} className={`toast-item toast-${t.variant} animate-fade-in-up`} role="status">
 <span className="shrink-0 text-[1.1rem]">{VARIANT_ICONS[t.variant]}</span>
 <span className="text-stone-900 flex-1 text-sm leading-[1.4]">{t.message}</span>
 <button
 className="text-stone-500 flex h-[24px] w-[24px] shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-xs transition-all"
 onClick={() => dismiss(t.id)}
 aria-label="Dismiss"
 >
 ✕
 </button>
 </div>
 ))}
 </div>
 )}
 </ToastContext.Provider>
 );
}
