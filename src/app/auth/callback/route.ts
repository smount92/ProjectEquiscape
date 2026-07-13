import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery", "signup", "magiclink", etc.
  // `redirectTo` is the standard name used elsewhere (proxy.ts, loginAction);
  // `next` is kept for back-compat with any existing callback links.
  const requestedRedirect =
    safeRedirectPath(searchParams.get("redirectTo")) ?? safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Password reset flow → send to the reset-password page (not dashboard)
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      if (requestedRedirect) {
        return NextResponse.redirect(`${origin}${requestedRedirect}`);
      }
      // First-time email confirmation with no explicit destination →
      // onboarding instead of dumping straight into the dashboard.
      if (type === "signup") {
        return NextResponse.redirect(`${origin}/getting-started`);
      }
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
