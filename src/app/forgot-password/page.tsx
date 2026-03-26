"use client";

import { useActionState } from"react";
import Link from"next/link";
import { forgotPasswordAction, type AuthFormState } from"@/app/auth/actions";
import { Input } from "@/components/ui/input";

const initialState: AuthFormState = { error: null, success: false };

export default function ForgotPasswordPage() {
 const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState);

 if (state.success) {
 return (
 <div className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-6 py-12">
 <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
 <div className="px-6 py-6">
 <div aria-hidden="true" className="mb-4 text-[3rem]">
 ✉️
 </div>
 <h1>Check Your Email</h1>
 <p className="mt-4">
 If an account exists with that email, we&apos;ve sent you a password reset link. Check your
 inbox and spam folder.
 </p>
 </div>
 <Link
 href="/login"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 id="back-to-login"
 >
 Back to Sign In
 </Link>
 </div>
 </div>
 );
 }

 return (
 <div className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-6 py-12">
 <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
 <div className="px-6 py-6">
 <h1>
 Reset <span className="text-forest">Password</span>
 </h1>
 <p>Enter your email and we&apos;ll send you a reset link</p>
 </div>

 {state.error && (
 <div
 className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm"
 role="alert"
 id="forgot-error"
 >
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 aria-hidden="true"
 >
 <circle cx="12" cy="12" r="10" />
 <line x1="15" y1="9" x2="9" y2="15" />
 <line x1="9" y1="9" x2="15" y2="15" />
 </svg>
 {state.error}
 </div>
 )}

 <form action={formAction} noValidate>
 <div className="mb-6">
 <label htmlFor="forgot-email" className="text-ink mb-1 block text-sm font-semibold">
 Email Address
 </label>
 <Input
 id="forgot-email"
 name="email"
 type="email"
 
 placeholder="you@example.com"
 required
 autoComplete="email"
 autoFocus
 />
 </div>

 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={isPending}
 id="forgot-submit"
 >
 {isPending ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 Sending...
 </>
 ) : (
"Send Reset Link"
 )}
 </button>
 </form>

 <div className="text-muted mt-8 text-center text-sm">
 <p>
 Remember your password?{""}
 <Link href="/login" id="go-to-login">
 Sign in here
 </Link>
 </p>
 </div>
 </div>
 </div>
 );
}
