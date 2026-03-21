"use client";

import { useState, useEffect } from"react";
import { useRouter, useSearchParams } from"next/navigation";
import { createClient } from"@/lib/supabase/client";

export default function ResetPasswordPage() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const supabase = createClient();
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [error, setError] = useState<string | null>(null);
 const [isPending, setIsPending] = useState(false);
 const [success, setSuccess] = useState(false);
 const [ready, setReady] = useState(false); // true when session is ready for password update

 useEffect(() => {
 // Method 1: If a PKCE ?code= parameter is present, exchange it
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

 // Method 2: Listen for PASSWORD_RECOVERY event (token-hash flow via URL fragment)
 const {
 data: { subscription },
 } = supabase.auth.onAuthStateChange((event) => {
 if (event ==="PASSWORD_RECOVERY") {
 setReady(true);
 } else if (event ==="SIGNED_IN") {
 // If the user was signed in via the recovery token, the session is ready
 setReady(true);
 }
 });

 // Method 3: Check if user already has a valid session (e.g., navigated here directly)
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
 <div className="min-h-[calc(100vh - var(sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
 <div className="bg-card border-edge sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div aria-hidden="true" className="mb-4 text-[3rem]">
 ✅
 </div>
 <h1>Password Updated!</h1>
 <p className="mt-4">Redirecting to your stable...</p>
 </div>
 </div>
 </div>
 );
 }

 if (!ready) {
 return (
 <div className="min-h-[calc(100vh - var(sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
 <div className="bg-card border-edge sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div aria-hidden="true" className="mb-4 text-[3rem]">
 🔐
 </div>
 <h1>
 Verifying <span className="text-forest">Reset Link</span>
 </h1>
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
 </div>
 );
 }

 return (
 <div className="min-h-[calc(100vh - var(sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div className="bg-card border-edge animate-fade-in-up relative w-full max-w-[460px] overflow-hidden rounded-lg border shadow-md transition-all">
 <div className="bg-card border-edge sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <h1>
 New <span className="text-forest">Password</span>
 </h1>
 <p>Choose a new password for your account</p>
 </div>

 {error && (
 <div
 className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm"
 role="alert"
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
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} noValidate>
 <div className="mb-6">
 <label htmlFor="new-password" className="text-ink mb-1 block text-sm font-semibold">
 New Password
 </label>
 <input
 id="new-password"
 type="password"
 className="form-input"
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
 <label htmlFor="confirm-new-password" className="text-ink mb-1 block text-sm font-semibold">
 Confirm New Password
 </label>
 <input
 id="confirm-new-password"
 type="password"
 className="form-input"
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
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 Updating...
 </>
 ) : (
"Update Password"
 )}
 </button>
 </form>
 </div>
 </div>
 );
}
