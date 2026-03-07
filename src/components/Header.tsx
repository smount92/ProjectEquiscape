"use client";

import Link from "next/link";
import { useSimpleMode } from "@/lib/context/SimpleModeContext";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const { isSimpleMode, toggleSimpleMode } = useSimpleMode();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="header" role="banner">
      <Link
        href={user ? "/dashboard" : "/"}
        className="header-logo"
        aria-label="Model Horse Hub — Home"
      >
        <span className="header-logo-icon" aria-hidden="true">
          🐴
        </span>
        <span>Model Horse Hub</span>
      </Link>

      {/* ── Authenticated Navigation ── */}
      {user && (
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/dashboard" className="header-nav-link" id="nav-stable">
            🏠 Digital Stable
          </Link>
          <Link href="/community" className="header-nav-link" id="nav-community">
            🏆 Show Ring
          </Link>
          <Link href="/wishlist" className="header-nav-link" id="nav-wishlist">
            ❤️ Wishlist
          </Link>
        </nav>
      )}

      {/* ── Public Navigation (not signed in) ── */}
      {!user && (
        <nav className="header-nav" aria-label="Public navigation">
          <Link href="/about" className="header-nav-link" id="nav-about">
            About
          </Link>
          <Link href="/contact" className="header-nav-link" id="nav-contact">
            Contact
          </Link>
        </nav>
      )}

      <div className="header-actions">
        {user ? (
          <button
            className="btn btn-ghost"
            onClick={handleSignOut}
            id="sign-out-button"
            style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
          >
            Sign Out
          </button>
        ) : (
          <Link
            href="/login"
            className="btn btn-primary btn-sm"
            id="header-login-button"
          >
            Log In
          </Link>
        )}

        <button
          className="simple-mode-toggle"
          onClick={toggleSimpleMode}
          aria-pressed={isSimpleMode}
          aria-label={
            isSimpleMode
              ? "Disable Simple Mode (high contrast and large text)"
              : "Enable Simple Mode (high contrast and large text)"
          }
          title={isSimpleMode ? "Simple Mode: ON" : "Simple Mode: OFF"}
          id="simple-mode-toggle"
        >
          {isSimpleMode ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          )}
          <span className="simple-mode-tooltip">
            {isSimpleMode ? "Simple Mode: ON" : "Simple Mode: OFF"}
          </span>
        </button>
      </div>
    </header>
  );
}
