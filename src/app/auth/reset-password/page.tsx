"use client";

import { useState, useEffect } from"react";
import { useRouter, useSearchParams } from"next/navigation";
import { createClient } from"@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import FocusLayout from"@/components/layouts/FocusLayout";

export default function ResetPasswordPage() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const supabase = createClient();
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [isPending, setIsPending] = useState(false);
 const [success, setSuccess] = useState(false);
 const [ready, setReady] = useState(false);

 useEffect(() => {
 const code = searchParams.get("code");
 if (code) {
  supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
  if (exchangeError) {
   console.error("[ResetPassword] Code exchange failed:", exchangeError.message);
   setError("This reset link has expired. Please request a new one.");
  } else {
   setReady(true);
  }
  });
  return;
 }

 const {
  data: { subscription },
 } = supabase.auth.onAuthStateChange((event) => {
  if (event ==="PASSWORD_RECOVERY") {
  setReady(true);
  } else if (event ==="SIGNED_IN") {
  setReady(true);
  }
 });

 supabase.auth.getUser().then(({ data: { user } }) => {
  if (user) {
  setReady(true);
  }
 });

 return () => subscription.unsubscribe();
 }, [searchParams, supabase.auth]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);

 if (password.length < 6) {
  setError("Password must be at least 6 characters.");
  return;
 }
 if (password !== confirmPassword) {
  setError("Passwords do not match.");
  return;
 }

 setIsPending(true);
 const { error: updateError } = await supabase.auth.updateUser({ password });

 if (updateError) {
  setError(updateError.message);
  setIsPending(false);
  return;
 }

 setSuccess(true);
 setTimeout(() => router.push("/dashboard"), 2000);
 };

 if (success) {
 return (
  <FocusLayout title="Password Updated!">
  <div className="bg-white border-stone-200 animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
   <div className="px-6 py-6">
   <div aria-hidden="true" className="mb-4 text-[3rem]">
    ✅
   </div>
   <h2>Password Updated!</h2>
   <p className="mt-4">Redirecting to your stable...</p>
   </div>
  </div>
  </FocusLayout>
 );
 }

 if (!ready) {
 return (
  <FocusLayout title={<>Verifying <span className="text-forest">Reset Link</span></>}>
  <div className="bg-white border-stone-200 animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
   <div className="px-6 py-6">
   <div aria-hidden="true" className="mb-4 text-[3rem]">
    🔐
   </div>
   <p className="mt-4">{error ||"Please wait while we verify your reset link..."}</p>
   {error && (
    <a
    href="/forgot-password"
    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
    >
    Request New Reset Link
    </a>
   )}
   </div>
  </div>
  </FocusLayout>
 );
 }

 return (
 <FocusLayout
  title={<>New <span className="text-forest">Password</span></>}
  description="Choose a new password for your account"
 >
  <div className="bg-white border-stone-200 animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
  {error && (
   <div
   className="text-red-700 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm"
   role="alert"
   >
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
   </svg>
   {error}
   </div>
  )}

  <form onSubmit={handleSubmit} noValidate>
   <div className="mb-6">
   <label htmlFor="new-password" className="text-stone-900 mb-1 block text-sm font-semibold">
    New Password
   </label>
   <Input
    id="new-password"
    type="password"
    placeholder="At least 6 characters"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
    minLength={6}
    autoComplete="new-password"
    autoFocus
   />
   </div>
   <div className="mb-6">
   <label htmlFor="confirm-new-password" className="text-stone-900 mb-1 block text-sm font-semibold">
    Confirm New Password
   </label>
   <Input
    id="confirm-new-password"
    type="password"
    placeholder="Re-enter your password"
    value={confirmPassword}
    onChange={(e) => setConfirmPassword(e.target.value)}
    required
    autoComplete="new-password"
   />
   </div>

   <button
   type="submit"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
   disabled={isPending}
   id="reset-submit"
   >
   {isPending ? (
    <>
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
    Updating...
    </>
   ) : (
    "Update Password"
   )}
   </button>
  </form>
  </div>
 </FocusLayout>
 );
}
