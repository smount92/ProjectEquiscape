import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Open-redirect guard mirroring loginAction's safeRedirectPath
 * (src/app/auth/actions.ts). Only same-origin absolute paths are allowed —
 * rejects protocol-relative (`//evil.com`) and backslash-escaped values.
 */
function safeRedirectPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/**
 * Pre-signup destination stowed by signupAction (src/app/auth/actions.ts)
 * so intent survives the email-confirmation round-trip. Read + cleared here.
 */
const POST_AUTH_REDIRECT_COOKIE = "mhh_post_auth_redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery", "signup", "magiclink", etc.
  // `redirectTo` is the standard name used elsewhere (proxy.ts, loginAction);
  // `next` is kept for back-compat with any existing callback links.
  const requestedRedirect =
    safeRedirectPath(searchParams.get("redirectTo")) ?? safeRedirectPath(searchParams.get("next"));

  // The cookie set at signup time (still open-redirect-guarded — the
  // value is attacker-influenced in principle, so re-check on read).
  const cookieStore = await cookies();
  const storedRedirect = safeRedirectPath(
    cookieStore.get(POST_AUTH_REDIRECT_COOKIE)?.value ?? null,
  );

  /** Redirect and clear the one-shot signup cookie once consumed (or stale). */
  const redirectClearingCookie = (to: string) => {
    const response = NextResponse.redirect(to);
    if (cookieStore.get(POST_AUTH_REDIRECT_COOKIE)) {
      response.cookies.set(POST_AUTH_REDIRECT_COOKIE, "", { path: "/", maxAge: 0 });
    }
    return response;
  };

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Password reset flow → send to the reset-password page (not dashboard)
      if (type === "recovery") {
        return redirectClearingCookie(`${origin}/auth/reset-password`);
      }
      if (requestedRedirect) {
        return redirectClearingCookie(`${origin}${requestedRedirect}`);
      }
      // The destination the visitor had before signing up (stowed by
      // signupAction) beats the generic onboarding page: they were
      // heading somewhere — take them there.
      if (storedRedirect) {
        return redirectClearingCookie(`${origin}${storedRedirect}`);
      }
      // First-time email confirmation with no explicit destination →
      // onboarding instead of dumping straight into the dashboard.
      if (type === "signup") {
        return redirectClearingCookie(`${origin}/getting-started`);
      }
      return redirectClearingCookie(`${origin}/dashboard`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
