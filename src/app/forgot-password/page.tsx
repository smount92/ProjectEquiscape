"use client";

import { useActionState } from"react";
import Link from"next/link";
import { forgotPasswordAction, type AuthFormState } from"@/app/auth/actions";
import { Input } from "@/components/ui/input";
import FocusLayout from"@/components/layouts/FocusLayout";

const initialState: AuthFormState = { error: null, success: false };

export default function ForgotPasswordPage() {
 const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialState);

 if (state.success) {
 return (
  <FocusLayout title="Check Your Email">
  <div className="bg-white border-input animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
   <div className="px-6 py-6">
   <div aria-hidden="true" className="mb-4 text-[3rem]">
    ✉️
   </div>
   <h2>Check Your Email</h2>
   <p className="mt-4">
    If an account exists with that email, we&apos;ve sent you a password reset link. Check your
    inbox and spam folder.
   </p>
   </div>
   <Link
   href="/login"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   id="back-to-login"
   >
   Back to Sign In
   </Link>
  </div>
  </FocusLayout>
 );
 }

 return (
 <FocusLayout
  title={<>Reset <span className="text-forest">Password</span></>}
  description="Enter your email and we'll send you a reset link"
 >
  <div className="bg-white border-input animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
  {state.error && (
   <div
   className="text-red-700 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm"
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
   <label htmlFor="forgot-email" className="text-stone-900 mb-1 block text-sm font-semibold">
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
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   disabled={isPending}
   id="forgot-submit"
   >
   {isPending ? (
    <>
    <span
     className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
     aria-hidden="true"
    />
    Sending...
    </>
   ) : (
    "Send Reset Link"
   )}
   </button>
  </form>

  <div className="text-stone-500 mt-8 text-center text-sm">
   <p>
   Remember your password?{""}
   <Link href="/login" id="go-to-login">
    Sign in here
   </Link>
   </p>
  </div>
  </div>
 </FocusLayout>
 );
}
