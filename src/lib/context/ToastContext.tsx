"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from"react";
import Link from"next/link";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type ToastVariant ="success" |"error" |"info" |"warning";

/** Optional inline action rendered after the message — a link (href)
 *  or a button (onClick). Used for e.g. "View your Favorites →" and
 *  Undo affordances. */
export interface ToastAction {
 label: string;
 href?: string;
 onClick?: () => void;
}

interface Toast {
 id: string;
 message: string;
 variant: ToastVariant;
 duration: number;
 action?: ToastAction;
}

interface ToastContextValue {
 toast: (message: string, variant?: ToastVariant, duration?: number, action?: ToastAction) => void;
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

 const addToast = useCallback((message: string, variant: ToastVariant ="success", duration = 5000, action?: ToastAction) => {
 const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
 setToasts((prev) => [...prev, { id, message, variant, duration, action }]);

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
 className="pointer-events-none fixed left-1/2 top-[calc(var(--header-height)+12px)] z-[300] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
 aria-live="polite"
 >
 {toasts.map((t) => (
 <div key={t.id} className={`toast-item toast-${t.variant} animate-fade-in-up`} role="status">
 <span className="shrink-0 text-[1.1rem]">{VARIANT_ICONS[t.variant]}</span>
 <span className="text-foreground flex-1 text-sm leading-[1.4]">{t.message}</span>
 {t.action &&
 (t.action.href ? (
 <Link
 href={t.action.href}
 className="shrink-0 rounded-sm px-2 py-1 text-sm font-semibold text-forest underline underline-offset-2"
 onClick={() => dismiss(t.id)}
 >
 {t.action.label}
 </Link>
 ) : (
 <button
 className="shrink-0 cursor-pointer rounded-sm border-0 bg-transparent px-2 py-1 text-sm font-semibold text-forest underline underline-offset-2"
 onClick={() => {
 t.action?.onClick?.();
 dismiss(t.id);
 }}
 >
 {t.action.label}
 </button>
 ))}
 <button
 className="text-muted-foreground flex h-[24px] w-[24px] shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-xs transition-all"
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
