"use client";

import { useActionState, useEffect, useState } from"react";
import Link from"next/link";
import { loginAction, type AuthFormState } from"@/app/auth/actions";

const initialState: AuthFormState = {
 error: null,
 success: false,
};

export default function LoginPage() {
 const [state, formAction, isPending] = useActionState(loginAction, initialState);
 const [showPassword, setShowPassword] = useState(false);

 return (
 <div className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-6 py-12">
 <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
 <div className="px-6 py-6">
 <h1>
 Welcome <span className="text-forest">Back</span>
 </h1>
 <p>Sign in to your Digital Stable</p>
 </div>

 {state.error && (
 <div
 className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm"
 role="alert"
 id="login-error"
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
 <label htmlFor="login-email" className="text-ink mb-1 block text-sm font-semibold">
 Email Address
 </label>
 <input
 id="login-email"
 name="email"
 type="email"
 className="form-input"
 placeholder="you@example.com"
 required
 autoComplete="email"
 autoFocus
 />
 </div>

 <div className="mb-6">
 <label htmlFor="login-password" className="text-ink mb-1 block text-sm font-semibold">
 Password
 </label>
 <div style={{ position:"relative" }}>
 <input
 id="login-password"
 name="password"
 type={showPassword ?"text" :"password"}
 className="form-input"
 placeholder="Enter your password"
 required
 autoComplete="current-password"
 style={{ paddingRight:"48px" }}
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 aria-label={showPassword ?"Hide password" :"Show password"}
 style={{
 position:"absolute",
 right:"12px",
 top:"50%",
 transform:"translateY(-50%)",
 background:"none",
 border:"none",
 color:"var(--color-text-muted)",
 cursor:"pointer",
 padding:"4px",
 display:"flex",
 alignItems:"center",
 }}
 >
 {showPassword ? (
 <svg
 width="18"
 height="18"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
 <line x1="1" y1="1" x2="23" y2="23" />
 </svg>
 ) : (
 <svg
 width="18"
 height="18"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
 <circle cx="12" cy="12" r="3" />
 </svg>
 )}
 </button>
 </div>
 </div>

 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={isPending}
 id="login-submit"
 >
 {isPending ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 Signing In...
 </>
 ) : (
"Sign In"
 )}
 </button>
 </form>

 <div className="mt-4" style={{ textAlign:"center" }}>
 <Link
 href="/forgot-password"
 style={{
 fontSize:"calc(var(--font-size-sm) * var(--font-scale))",
 color:"var(--color-text-muted)",
 }}
 id="forgot-password-link"
 >
 Forgot your password?
 </Link>
 </div>

 <div className="text-muted mt-8 text-center text-sm">
 <p>
 Don&apos;t have an account?{""}
 <Link href="/signup" id="go-to-signup">
 Create one here
 </Link>
 </p>
 </div>
 </div>
 </div>
 );
}
