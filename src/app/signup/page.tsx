"use client";

import { useState } from"react";
import Link from"next/link";
import { signupAction, type AuthFormState } from"@/app/auth/actions";
import { Input } from "@/components/ui/input";
import FocusLayout from"@/components/layouts/FocusLayout";

export default function SignupPage() {
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState(false);
 const [isPending, setIsPending] = useState(false);
 const [showPassword, setShowPassword] = useState(false);

 const handleSubmit = async (formData: FormData) => {
 setIsPending(true);
 setError(null);

 const result: AuthFormState = await signupAction({ error: null, success: false }, formData);

 if (result.success) {
  setSuccess(true);
 } else {
  setError(result.error);
 }
 setIsPending(false);
 };

 if (success) {
 return (
  <FocusLayout title="Check Your Email">
  <div className="animate-fade-in-up relative w-full max-w-[440px] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
   <div className="border-b border-stone-200 bg-gradient-to-b from-stone-50 to-card px-8 pb-6 pt-8 text-center">
   <div className="mb-3 text-4xl" aria-hidden="true">✉️</div>
   <p className="mt-2 text-sm leading-relaxed text-stone-600">
    We&apos;ve sent a confirmation link to your email address. Click the link to activate your
    account and start building your Digital Stable!
   </p>
   </div>
   <div className="px-8 pb-8 pt-6 text-center">
   <Link
    href="/login"
    className="inline-block w-full cursor-pointer rounded-lg border-0 bg-forest px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md no-underline"
    id="back-to-login"
   >
    Back to Sign In
   </Link>
   </div>
  </div>
  </FocusLayout>
 );
 }

 return (
 <FocusLayout
  title={<>Join the <span className="text-forest">Stable</span></>}
  description="Create your account and start cataloging your collection"
 >
  <div className="animate-fade-in-up relative w-full max-w-[440px] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
  {/* Body */}
  <div className="px-8 pb-8 pt-6">
   {error && (
   <div
    className="mb-6 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    role="alert"
    id="signup-error"
   >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
    {error}
   </div>
   )}

   {/* Privacy Callout */}
   <div
   className="mb-6 flex items-start gap-3 rounded-lg border border-forest/20 bg-forest/5 p-4"
   role="note"
   aria-label="Privacy information"
   >
   <span className="mt-0.5 text-lg" aria-hidden="true">🛡️</span>
   <p className="text-sm leading-relaxed text-stone-600">
    <strong className="text-stone-900">Your real name is private.</strong> Your alias is how the community will know you. Only
    you can see your personal details — we take your privacy seriously.
   </p>
   </div>

   <form action={handleSubmit} noValidate>
   <div className="mb-5">
    <label htmlFor="signup-alias" className="mb-1.5 block text-sm font-semibold text-stone-900">
    Choose Your Alias *
    </label>
    <Input
    id="signup-alias"
    name="aliasName"
    type="text"
    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm transition-colors focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
    placeholder="e.g. StableQueen42"
    required
    minLength={3}
    maxLength={30}
    autoFocus
    autoComplete="username"
    />
    <span className="mt-1.5 block text-xs text-stone-500">
    This is your public display name (3–30 characters). Choose wisely!
    </span>
   </div>

   <div className="mb-5">
    <label htmlFor="signup-email" className="mb-1.5 block text-sm font-semibold text-stone-900">
    Email Address *
    </label>
    <Input
    id="signup-email"
    name="email"
    type="email"
    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm transition-colors focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
    placeholder="you@example.com"
    required
    autoComplete="email"
    />
    <span className="mt-1.5 block text-xs text-stone-500">
    We&apos;ll send a confirmation link. Your email is never shared.
    </span>
   </div>

   <div className="mb-5">
    <label htmlFor="signup-password" className="mb-1.5 block text-sm font-semibold text-stone-900">
    Password *
    </label>
    <div className="relative">
    <Input
     id="signup-password"
     name="password"
     type={showPassword ?"text" :"password"}
     className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 pr-12 text-sm transition-colors focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
     placeholder="At least 6 characters"
     required
     minLength={6}
     autoComplete="new-password"
    />
    <button
     type="button"
     onClick={() => setShowPassword(!showPassword)}
     aria-label={showPassword ?"Hide password" :"Show password"}
     className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center border-none bg-transparent p-1 text-stone-500 transition-colors hover:text-stone-900"
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

   <div className="mb-6">
    <label htmlFor="signup-confirm-password" className="mb-1.5 block text-sm font-semibold text-stone-900">
    Confirm Password *
    </label>
    <Input
    id="signup-confirm-password"
    name="confirmPassword"
    type={showPassword ?"text" :"password"}
    className="w-full rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm transition-colors focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
    placeholder="Re-enter your password"
    required
    autoComplete="new-password"
    />
   </div>

   <button
    type="submit"
    className="w-full cursor-pointer rounded-lg border-0 bg-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-forest-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
    disabled={isPending}
    id="signup-submit"
   >
    {isPending ?"Creating Account..." :"Create My Account"}
   </button>
   </form>

   <div className="mt-6 border-t border-stone-200 pt-5 text-center text-sm text-stone-500">
   <p>
    Already have an account?{" "}
    <Link href="/login" className="font-semibold text-forest hover:underline" id="go-to-login">
    Sign in here
    </Link>
   </p>
   </div>
  </div>
  </div>
 </FocusLayout>
 );
}
