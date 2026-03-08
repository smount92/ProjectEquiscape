"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface AuthFormState {
  error: string | null;
  success: boolean;
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

  redirect("/dashboard");
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

    console.log("[ForgotPassword] Sending reset email to:", email);
    console.log("[ForgotPassword] redirectTo:", redirectTo);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("[ForgotPassword] Supabase error:", error.message);
      return { error: error.message, success: false };
    }

    console.log("[ForgotPassword] Success — email sent");
    return { error: null, success: true };
  } catch (err) {
    console.error("[ForgotPassword] Unexpected error:", err);
    return {
      error: "Something went wrong. Please try again.",
      success: false,
    };
  }
}

