"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastVariant = "success" | "error" | "info" | "warning";

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
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
    return ctx;
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const VARIANT_ICONS: Record<ToastVariant, string> = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
    warning: "⚠️",
};

/* ------------------------------------------------------------------ */
/*  Provider + Renderer                                                */
/* ------------------------------------------------------------------ */

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback(
        (message: string, variant: ToastVariant = "success", duration = 5000) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setToasts((prev) => [...prev, { id, message, variant, duration }]);

            // Auto-dismiss
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        },
        [],
    );

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}

            {/* Toast Container */}
            {toasts.length > 0 && (
                <div className="toast-container" aria-live="polite">
                    {toasts.map((t) => (
                        <div
                            key={t.id}
                            className={`toast-item toast-${t.variant} animate-fade-in-up`}
                            role="status"
                        >
                            <span className="toast-icon">{VARIANT_ICONS[t.variant]}</span>
                            <span className="toast-message">{t.message}</span>
                            <button
                                className="toast-close"
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
