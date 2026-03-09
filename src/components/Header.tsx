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
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const fetchHeaderInfo = useCallback(async () => {
    try {
      const data = await getHeaderData();
      setUser(data.user);
      setAliasName(data.aliasName);
      setUnreadCount(data.unreadCount);
      setIsAdmin(data.isAdmin ?? false);
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
        setIsAdmin(false);
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

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* DESKTOP NAVIGATION — Primary links + icon actions + user  */}
      {/* Hidden on mobile (mobile uses the hamburger nav below)     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {user && (
        <div className="header-desktop-nav">
          {/* Primary text links */}
          <nav className="header-nav-primary" aria-label="Main navigation">
            <Link href="/dashboard" className="header-nav-link" id="nav-stable">
              🏠 Stable
            </Link>
            <Link href="/community" className="header-nav-link" id="nav-community">
              🏆 Show Ring
            </Link>
            <Link href="/feed" className="header-nav-link" id="nav-feed">
              📰 Feed
            </Link>
            <Link href="/discover" className="header-nav-link" id="nav-discover">
              👥 Discover
            </Link>
            <Link href="/shows" className="header-nav-link" id="nav-shows">
              📸 Shows
            </Link>
            <Link href="/community/help-id" className="header-nav-link" id="nav-helpid">
              🔍 Help ID
            </Link>
          </nav>

          {/* Icon action buttons */}
          <div className="header-icon-actions">
            <NotificationBell />
            <Link href="/inbox" className="header-icon-btn" title="Inbox" id="nav-inbox-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {unreadCount > 0 && (
                <span className="inbox-unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </Link>
            <Link href="/wishlist" className="header-icon-btn" title="Wishlist" id="nav-wishlist-icon">
              ❤️
            </Link>
          </div>

          {/* User menu dropdown */}
          <div className="header-user-menu" ref={userMenuRef}>
            <button
              className="header-user-menu-trigger"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-label="User menu"
            >
              <span className="header-user-avatar">
                {aliasName ? aliasName.charAt(0).toUpperCase() : "U"}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                className={`header-chevron ${userMenuOpen ? "header-chevron-open" : ""}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {userMenuOpen && (
              <div className="header-user-dropdown">
                <Link
                  href={aliasName ? `/profile/${encodeURIComponent(aliasName)}` : "/settings"}
                  className="header-dropdown-link"
                  onClick={() => setUserMenuOpen(false)}
                >
                  👤 My Profile
                </Link>
                <Link href="/settings" className="header-dropdown-link" onClick={() => setUserMenuOpen(false)}>
                  ⚙️ Settings
                </Link>
                <Link href="/claim" className="header-dropdown-link" onClick={() => setUserMenuOpen(false)}>
                  📦 Claim
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="header-dropdown-link header-dropdown-admin" onClick={() => setUserMenuOpen(false)}>
                    ⚡ Admin
                  </Link>
                )}
                <div className="header-dropdown-divider" />
                <button
                  className="header-dropdown-link"
                  onClick={() => { setUserMenuOpen(false); toggleSimpleMode(); }}
                >
                  {isSimpleMode ? "👁 Simple Mode: ON" : "👁‍🗨 Simple Mode"}
                </button>
                <button
                  className="header-dropdown-link header-dropdown-signout"
                  onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MOBILE NAVIGATION — Full menu in hamburger dropdown       */}
      {/* Hidden on desktop                                          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {user && (
        <nav ref={navRef} className={`header-nav header-nav-mobile ${mobileMenuOpen ? "header-nav-open" : ""}`} aria-label="Mobile navigation">
          <Link href="/dashboard" className="header-nav-link" id="nav-stable-m" onClick={closeMobileMenu}>
            🏠 Digital Stable
          </Link>
          <Link
            href={aliasName ? `/profile/${encodeURIComponent(aliasName)}` : "/settings"}
            className="header-nav-link"
            id="nav-profile-m"
            onClick={closeMobileMenu}
          >
            👤 My Profile
          </Link>
          <Link href="/community" className="header-nav-link" id="nav-community-m" onClick={closeMobileMenu}>
            🏆 Show Ring
          </Link>
          <Link href="/discover" className="header-nav-link" id="nav-discover-m" onClick={closeMobileMenu}>
            👥 Discover
          </Link>
          <Link href="/feed" className="header-nav-link" id="nav-feed-m" onClick={closeMobileMenu}>
            📰 Feed
          </Link>
          <Link href="/shows" className="header-nav-link" id="nav-shows-m" onClick={closeMobileMenu}>
            📸 Shows
          </Link>
          <Link href="/community/help-id" className="header-nav-link" id="nav-helpid-m" onClick={closeMobileMenu}>
            🔍 Help ID
          </Link>
          <Link href="/wishlist" className="header-nav-link" id="nav-wishlist-m" onClick={closeMobileMenu}>
            ❤️ Wishlist
          </Link>
          <Link href="/claim" className="header-nav-link" id="nav-claim-m" onClick={closeMobileMenu}>
            📦 Claim
          </Link>
          <Link href="/settings" className="header-nav-link" id="nav-settings-m" onClick={closeMobileMenu}>
            ⚙️ Settings
          </Link>
          <Link href="/inbox" className="header-nav-link inbox-nav-link" id="nav-inbox-m" onClick={closeMobileMenu}>
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
            <Link href="/admin" className="header-nav-link admin-nav-link" id="nav-admin-m">
              Admin ⚡
            </Link>
          )}
          {/* ── Mobile-only: Sign Out + Simple Mode ── */}
          <div className="header-auth-actions-mobile">
            <button
              className="btn btn-ghost"
              onClick={() => { closeMobileMenu(); handleSignOut(); }}
              style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", width: "100%", justifyContent: "flex-start" }}
            >
              🚪 Sign Out
            </button>
            <button
              className="simple-mode-toggle"
              onClick={() => { toggleSimpleMode(); }}
              aria-pressed={isSimpleMode}
              style={{ justifyContent: "flex-start", gap: "var(--space-sm)", width: "100%" }}
            >
              {isSimpleMode ? "👁 Simple Mode: ON" : "👁‍🗨 Simple Mode: OFF"}
            </button>
          </div>
        </nav>
      )}

      {/* ── Public Navigation (not signed in) ── */}
      {!user && (
        <nav className="header-nav header-nav-public" aria-label="Public navigation">
          <Link href="/about" className="header-nav-link" id="nav-about">
            About
          </Link>
          <Link href="/contact" className="header-nav-link" id="nav-contact">
            Contact
          </Link>
        </nav>
      )}

      {/* ── Desktop auth actions for logged-out users ── */}
      {!user && (
        <div className="header-actions">
          <Link
            href="/login"
            className="btn btn-primary btn-sm"
            id="header-login-button"
          >
            Log In
          </Link>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
            <span className="simple-mode-tooltip">
              {isSimpleMode ? "Simple Mode: ON" : "Simple Mode: OFF"}
            </span>
          </button>
        </div>
      )}
    </header>
  );
}
