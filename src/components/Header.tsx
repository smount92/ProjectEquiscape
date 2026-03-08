"use client";

import Link from "next/link";
import { useSimpleMode } from "@/lib/context/SimpleModeContext";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import NotificationBell from "@/components/NotificationBell";
import { getHeaderData } from "@/app/actions/header";
export default function Header() {
  const { isSimpleMode, toggleSimpleMode } = useSimpleMode();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [aliasName, setAliasName] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const isAdmin = user?.email && adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase();

  const fetchHeaderInfo = useCallback(async () => {
    try {
      const data = await getHeaderData();
      setUser(data.user);
      setAliasName(data.aliasName);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently fail if server action throws
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchHeaderInfo();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        fetchHeaderInfo();
      } else {
        setUser(null);
        setAliasName(null);
        setUnreadCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchHeaderInfo]);

  // Poll for new messages every 30 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => fetchHeaderInfo(), 30000);
    return () => clearInterval(interval);
  }, [user, fetchHeaderInfo]);

  const handleSignOut = () => {
    // Fire-and-forget — redirect immediately regardless of signOut result
    supabase.auth.signOut().catch(() => { });
    window.location.href = "/login";
  };

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

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
      {/* ── Hamburger Button (mobile only) ── */}
      {user && (
        <button
          className="header-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          id="hamburger-menu"
        >
          {mobileMenuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      )}

      {/* ── Authenticated Navigation ── */}
      {user && (
        <nav ref={navRef} className={`header-nav ${mobileMenuOpen ? "header-nav-open" : ""}`} aria-label="Main navigation">
          <Link href="/dashboard" className="header-nav-link" id="nav-stable" onClick={closeMobileMenu}>
            🏠 Digital Stable
          </Link>
          <Link
            href={aliasName ? `/profile/${encodeURIComponent(aliasName)}` : "/settings"}
            className="header-nav-link"
            id="nav-profile"
            onClick={closeMobileMenu}
          >
            👤 My Profile
          </Link>
          <Link href="/community" className="header-nav-link" id="nav-community" onClick={closeMobileMenu}>
            🏆 Show Ring
          </Link>
          <Link href="/discover" className="header-nav-link" id="nav-discover" onClick={closeMobileMenu}>
            👥 Discover
          </Link>
          <Link href="/feed" className="header-nav-link" id="nav-feed" onClick={closeMobileMenu}>
            📰 Feed
          </Link>
          <Link href="/shows" className="header-nav-link" id="nav-shows" onClick={closeMobileMenu}>
            📸 Shows
          </Link>
          <Link href="/wishlist" className="header-nav-link" id="nav-wishlist" onClick={closeMobileMenu}>
            ❤️ Wishlist
          </Link>
          <Link href="/claim" className="header-nav-link" id="nav-claim" onClick={closeMobileMenu}>
            📦 Claim
          </Link>
          <Link href="/settings" className="header-nav-link" id="nav-settings" onClick={closeMobileMenu}>
            ⚙️ Settings
          </Link>
          <Link href="/inbox" className="header-nav-link inbox-nav-link" id="nav-inbox" onClick={closeMobileMenu}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Inbox
            {unreadCount > 0 && (
              <span className="inbox-unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </Link>
          <NotificationBell />
          {isAdmin && (
            <Link href="/admin" className="header-nav-link admin-nav-link" id="nav-admin">
              Admin ⚡
            </Link>
          )}
          {/* ── Public info links (always accessible) ── */}
          <div className="header-nav-divider" aria-hidden="true" />
          <Link href="/" className="header-nav-link header-nav-link-secondary" id="nav-home" onClick={closeMobileMenu}>
            🏡 Home
          </Link>
          <Link href="/about" className="header-nav-link header-nav-link-secondary" id="nav-about" onClick={closeMobileMenu}>
            ℹ️ About
          </Link>
          <Link href="/contact" className="header-nav-link header-nav-link-secondary" id="nav-contact" onClick={closeMobileMenu}>
            ✉️ Contact
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
