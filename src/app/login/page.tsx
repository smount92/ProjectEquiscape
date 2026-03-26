"use client";

import { useActionState, useEffect, useState } from"react";
import Link from"next/link";
import { loginAction, type AuthFormState } from"@/app/auth/actions";
import { Input } from "@/components/ui/input";

const initialState: AuthFormState = {
 error: null,
 success: false,
};

export default function LoginPage() {
 const [state, formAction, isPending] = useActionState(loginAction, initialState);
 const [showPassword, setShowPassword] = useState(false);

 return (
 <div className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-6 py-12">
 <div className="animate-fade-in-up relative w-full max-w-[440px] overflow-hidden rounded-xl border border-edge bg-card shadow-lg">
 {/* Header */}
 <div className="border-b border-edge bg-gradient-to-b from-[var(--color-bg-parchment-dark)] to-card px-8 pb-6 pt-8 text-center">
 <div className="mb-3 text-4xl">🐴</div>
 <h1 className="text-2xl font-bold tracking-tight">
 Welcome <span className="text-forest">Back</span>
 </h1>
 <p className="mt-1 text-sm text-muted">Sign in to your Digital Stable</p>
 </div>

 {/* Body */}
 <div className="px-8 pb-8 pt-6">
 {state.error && (
 <div
 className="mb-6 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-3 text-sm text-danger"
 role="alert"
 id="login-error"
 >
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
 <circle cx="12" cy="12" r="10" />
 <line x1="15" y1="9" x2="9" y2="15" />
 <line x1="9" y1="9" x2="15" y2="15" />
 </svg>
 {state.error}
 </div>
 )}

 <form action={formAction} noValidate>
 <div className="mb-5">
 <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-ink">
 Email Address
 </label>
 <Input
 id="login-email"
 name="email"
 type="email"
 className="w-full rounded-lg border border-edge bg-[var(--color-bg-input)] px-4 py-3 text-sm transition-colors focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
 placeholder="you@example.com"
 required
 autoComplete="email"
 autoFocus
 />
 </div>

 <div className="mb-6">
 <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-ink">
 Password
 </label>
 <div className="relative">
 <Input
 id="login-password"
 name="password"
 type={showPassword ?"text" :"password"}
 className="w-full rounded-lg border border-edge bg-[var(--color-bg-input)] px-4 py-3 pr-12 text-sm transition-colors focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
 placeholder="Enter your password"
 required
 autoComplete="current-password"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 aria-label={showPassword ?"Hide password" :"Show password"}
 className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center border-none bg-transparent p-1 text-muted transition-colors hover:text-ink"
 >
 {showPassword ? (
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
 <line x1="1" y1="1" x2="23" y2="23" />
 </svg>
 ) : (
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
 <circle cx="12" cy="12" r="3" />
 </svg>
 )}
 </button>
 </div>
 </div>

 <button
 type="submit"
 className="w-full cursor-pointer rounded-lg border-0 bg-forest px-6 py-3 text-sm font-semibold text-inverse shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
 disabled={isPending}
 id="login-submit"
 >
 {isPending ?"Signing In..." :"Sign In"}
 </button>
 </form>

 <div className="mt-5 text-center">
 <Link
 href="/forgot-password"
 className="text-sm text-muted transition-colors hover:text-forest"
 id="forgot-password-link"
 >
 Forgot your password?
 </Link>
 </div>

 <div className="mt-6 border-t border-edge pt-5 text-center text-sm text-muted">
 <p>
 Don&apos;t have an account?{" "}
 <Link href="/signup" className="font-semibold text-forest hover:underline" id="go-to-signup">
 Create one here
 </Link>
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
