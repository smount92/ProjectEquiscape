"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface AuthFormState {
  error: string | null;
  success: boolean;
}

/**
 * Open-redirect guard for post-login return trips. Only same-origin absolute
 * paths are allowed — rejects protocol-relative (`//evil.com`), scheme-carrying,
 * and backslash-escaped values so a crafted `?redirectTo=` can't bounce a user
 * off-site. Returns null when the value isn't a safe internal path.
 */
function safeRedirectPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please enter both email and password.", success: false };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  // Return the user to where they were headed before the login wall (set by
  // proxy.ts as ?redirectTo=), falling back to the dashboard.
  redirect(safeRedirectPath(formData.get("redirectTo")) ?? "/dashboard");
}

export async function signupAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const aliasName = formData.get("aliasName") as string;

  // Validation
  if (!email || !password || !aliasName) {
    return { error: "Please fill in all required fields.", success: false };
  }

  if (aliasName.length < 3) {
    return {
      error: "Your alias must be at least 3 characters long.",
      success: false,
    };
  }

  if (aliasName.length > 30) {
    return {
      error: "Your alias must be 30 characters or less.",
      success: false,
    };
  }

  if (password.length < 6) {
    return {
      error: "Password must be at least 6 characters long.",
      success: false,
    };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match.", success: false };
  }

  const supabase = await createClient();

  // Check if alias is already taken
  const { data: existingAlias } = await supabase
    .from("users")
    .select("alias_name")
    .eq("alias_name", aliasName)
    .single<{ alias_name: string }>();

  if (existingAlias) {
    return {
      error: "This alias is already taken. Please choose another.",
      success: false,
    };
  }

  // Sign up with Supabase Auth
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        alias_name: aliasName,
      },
    },
  });

  if (error) {
    return { error: error.message, success: false };
  }

  return {
    error: null,
    success: true,
  };
}

/**
 * Re-send the signup confirmation email (the post-signup interstitial's
 * "Resend" button). Supabase applies its own rate limit to resends; its
 * error message is surfaced verbatim when that trips.
 */
export async function resendConfirmationAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Missing email address.", success: false };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });

    if (error) {
      console.error("[ResendConfirmation] Supabase error:", error.message);
      return { error: error.message, success: false };
    }

    return { error: null, success: true };
  } catch (err) {
    console.error("[ResendConfirmation] Unexpected error:", err);
    return {
      error: "Something went wrong. Please try again.",
      success: false,
    };
  }
}

export async function forgotPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Please enter your email address.", success: false };
  }

  try {
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectTo = `${siteUrl}/auth/reset-password`;


    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("[ForgotPassword] Supabase error:", error.message);
      return { error: error.message, success: false };
    }

    return { error: null, success: true };
  } catch (err) {
    console.error("[ForgotPassword] Unexpected error:", err);
    return {
      error: "Something went wrong. Please try again.",
      success: false,
    };
  }
}

