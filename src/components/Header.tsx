"use client";

import Link from "next/link";
import { useSimpleMode } from "@/lib/context/SimpleModeContext";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import NotificationBell from "@/components/NotificationBell";
import { getHeaderData } from "@/app/actions/header";
import {
  Home, Trophy, Newspaper, Users, Camera, Palette, Search,
  Building2, Calendar, TrendingUp, Heart, Package, Settings,
  User, Zap, LogOut, Eye, EyeOff, Mail, ChevronDown, MoreHorizontal,
  BookOpen
} from "lucide-react";

// Priority-ordered nav links — highest priority first
const NAV_LINKS = [
  { href: "/dashboard", label: "Stable", Icon: Home, id: "nav-stable" },
  { href: "/community", label: "Show Ring", Icon: Trophy, id: "nav-community" },
  { href: "/feed", label: "Feed", Icon: Newspaper, id: "nav-feed" },
  { href: "/discover", label: "Discover", Icon: Users, id: "nav-discover" },
  { href: "/shows", label: "Shows", Icon: Camera, id: "nav-shows" },
  { href: "/market", label: "Market", Icon: TrendingUp, id: "nav-market" },
  { href: "/community/groups", label: "Groups", Icon: Building2, id: "nav-groups" },
  { href: "/community/events", label: "Events", Icon: Calendar, id: "nav-events" },
  { href: "/community/help-id", label: "Help ID", Icon: Search, id: "nav-helpid" },
  { href: "/catalog", label: "Catalog", Icon: BookOpen, id: "nav-catalog" },
];

// Dynamic link that depends on artist slug
const getStudioLink = (artistSlug: string | null) => ({
  href: artistSlug ? "/studio/dashboard" : "/studio/setup",
  label: "Art Studio",
  Icon: Palette,
  id: "nav-studio",
});

export default function Header() {
  const { isSimpleMode, toggleSimpleMode } = useSimpleMode();
  // Immediately check localStorage for auth token to prevent flash
  const [user, setUser] = useState<{ id: string; email?: string } | null>(() => {
    if (typeof window !== "undefined") {
      const storageKey = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      if (storageKey) {
        try {
          const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
          if (stored?.user?.id) return { id: stored.user.id, email: stored.user.email };
        } catch { /* ignore */ }
      }
    }
    return null;
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [aliasName, setAliasName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [artistSlug, setArtistSlug] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(NAV_LINKS.length + 1); // +1 for Art Studio
  const navRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const primaryNavRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const fetchHeaderInfo = useCallback(async () => {
    try {
      const data = await getHeaderData();
      setUser(data.user);
      setAliasName(data.aliasName);
      setAvatarUrl(data.avatarUrl ?? null);
      setUnreadCount(data.unreadCount);
      setIsAdmin(data.isAdmin ?? false);
      setArtistSlug(data.artistStudioSlug ?? null);
    } catch {
      // Silently fail if server action throws
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? undefined });
        fetchHeaderInfo();
      }
    };
    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? undefined });
        fetchHeaderInfo();
      } else {
        setUser(null);
        setAliasName(null);
        setAvatarUrl(null);
        setUnreadCount(0);
        setIsAdmin(false);
        setArtistSlug(null);
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

  // Close mobile menu on route change (fixes touch devices where onClick can race)
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  // Close "More" menu on outside click
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreMenuOpen]);

  // ── Priority+ nav: measure available space and progressively collapse ──
  useEffect(() => {
    if (!user) return;
    const container = primaryNavRef.current;
    if (!container) return;

    const measure = () => {
      const containerWidth = container.offsetWidth;
      const children = Array.from(container.children) as HTMLElement[];
      let usedWidth = 0;
      let fitCount = 0;
      const moreButtonWidth = 80; // reserve space for "More" button

      for (const child of children) {
        if (child.dataset.navItem !== "true") continue;
        // Temporarily make it visible to measure
        const w = child.scrollWidth;
        usedWidth += w + 2; // 2px gap
        if (usedWidth < containerWidth - moreButtonWidth) {
          fitCount++;
        } else {
          break;
        }
      }
      setVisibleCount(fitCount);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    // Measure on mount
    requestAnimationFrame(measure);

    return () => observer.disconnect();
  }, [user]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Build full nav list including Art Studio
  const allLinks = [...NAV_LINKS];
  // Insert Art Studio after Shows (index 5)
  allLinks.splice(5, 0, getStudioLink(artistSlug));
  const totalLinks = allLinks.length;
  const hasOverflow = visibleCount < totalLinks;
  const visibleLinks = allLinks.slice(0, visibleCount);
  const overflowLinks = allLinks.slice(visibleCount);

  return (
    <header className="sticky top-0 z-[100] h-[var(--sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all" role="banner">
      <Link
        href={user ? "/dashboard" : "/"}
        className="flex items-center gap-2 text-lg font-extrabold text-ink no-underline tracking-[-0.02em] shrink-0 mr-6"
        aria-label="Model Horse Hub — Home"
      >
        <span className="text-[1.5em]" aria-hidden="true">
          🐴
        </span>
        <span>Model Horse Hub</span>
      </Link>

      {/* ── Hamburger Button (mobile only) ── */}
      {user && (
        <button
          className="hidden items-center justify-center w-[40px] h-[40px] bg-transparent border border-edge rounded-md text-[var(--color-text-secondary)] cursor-pointer transition-all"
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
      {/* DESKTOP NAVIGATION — Priority+ progressive collapse       */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {user && (
        <div className="flex items-center gap-4 flex-1 min-w-0 justify-end">
          {/* Primary text links — measured by ResizeObserver */}
          <nav className="flex items-center gap-[2px] flex-1 min-w-0 overflow-hidden relative" aria-label="Main navigation" ref={primaryNavRef}>
            {allLinks.map((link, i) => (
              <Link
                key={link.id}
                href={link.href}
                className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all"
                id={link.id}
                data-nav-item="true"
                style={i >= visibleCount ? { position: "absolute", visibility: "hidden", pointerEvents: "none" } : undefined}
              >
                <link.Icon size={16} strokeWidth={1.5} /> {link.label}
              </Link>
            ))}
          </nav>

          {/* "More" dropdown for overflow items */}
          {hasOverflow && (
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                aria-expanded={moreMenuOpen}
                aria-label="More navigation links"
                style={{ cursor: "pointer", background: "none", border: "none", fontFamily: "inherit" }}
              >
                <MoreHorizontal size={16} strokeWidth={1.5} /> More
                <ChevronDown size={12} strokeWidth={2}  className="ml-[2]" />
              </button>
              {moreMenuOpen && (
                <div className="absolute top-[calc(100% + 8px)] right-0 min-w-[200px] bg-[var(--color-bg-secondary)] border border-edge rounded-lg p-1 shadow-lg z-[200] flex flex-col">
                  {overflowLinks.map((link) => (
                    <Link
                      key={link.id}
                      href={link.href}
                      className="flex items-center gap-2 py-2 px-4 text-sm text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all border-0 bg-transparent cursor-pointer w-full text-left"
                      onClick={() => setMoreMenuOpen(false)}
                    >
                      <link.Icon size={16} strokeWidth={1.5} /> {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Icon action buttons */}
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Link href="/inbox" className="flex items-center justify-center relative w-[36px] h-[36px] rounded-full bg-glass border border-edge transition-all no-underline text-base text-[var(--color-text-secondary)]" title="Inbox" id="nav-inbox-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {unreadCount > 0 && (
                <span className="inbox-unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </Link>
            <Link href="/wishlist" className="flex items-center justify-center relative w-[36px] h-[36px] rounded-full bg-glass border border-edge transition-all no-underline text-base text-[var(--color-text-secondary)]" title="Wishlist" id="nav-wishlist-icon">
              <Heart size={18} strokeWidth={1.5} />
            </Link>
          </div>

          {/* User menu dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              className="relative-trigger"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-label="User menu"
            >
              <span className="sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all-rounded-full bg-[rgba(0, 0, 0, 0.06)] inline-flex items-center justify-center overflow-hidden shrink-0 font-bold text-muted">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={aliasName || "User"} className="w-full h-full rounded-full" style={{ objectFit: "cover" }} />
                ) : (
                  aliasName ? aliasName.charAt(0).toUpperCase() : "U"
                )}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                className={`header-chevron ${userMenuOpen ? "header-chevron-open" : ""}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {userMenuOpen && (
              <div className="absolute top-[calc(100% + 8px)] right-0 min-w-[200px] bg-[var(--color-bg-secondary)] border border-edge rounded-lg p-1 shadow-lg z-[200] flex flex-col">
                <Link
                  href={aliasName ? `/profile/${encodeURIComponent(aliasName)}` : "/settings"}
                  className="flex items-center gap-2 py-2 px-4 text-sm text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all border-0 bg-transparent cursor-pointer w-full text-left"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <User size={16} strokeWidth={1.5} /> My Profile
                </Link>
                <Link href="/settings" className="flex items-center gap-2 py-2 px-4 text-sm text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all border-0 bg-transparent cursor-pointer w-full text-left" onClick={() => setUserMenuOpen(false)}>
                  <Settings size={16} strokeWidth={1.5} /> Settings
                </Link>
                <Link href="/claim" className="flex items-center gap-2 py-2 px-4 text-sm text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all border-0 bg-transparent cursor-pointer w-full text-left" onClick={() => setUserMenuOpen(false)}>
                  <Package size={16} strokeWidth={1.5} /> Claim
                </Link>
                <Link href="/studio/my-commissions" className="flex items-center gap-2 py-2 px-4 text-sm text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all border-0 bg-transparent cursor-pointer w-full text-left" onClick={() => setUserMenuOpen(false)}>
                  <Palette size={16} strokeWidth={1.5} /> My Commissions
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="flex items-center gap-2 py-2 px-4 text-sm text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all border-0 bg-transparent cursor-pointer w-full text-left text-forest" onClick={() => setUserMenuOpen(false)}>
                    <Zap size={16} strokeWidth={1.5} /> Admin
                  </Link>
                )}
                <div className="h-[1px] bg-edge m-[var(--space-xs) 0]" />
                <button
                  className="flex items-center gap-2 py-2 px-4 text-sm text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all border-0 bg-transparent cursor-pointer w-full text-left"
                  onClick={() => { setUserMenuOpen(false); toggleSimpleMode(); }}
                >
                  {isSimpleMode ? <><Eye size={16} strokeWidth={1.5} /> Simple Mode: ON</> : <><EyeOff size={16} strokeWidth={1.5} /> Simple Mode</>}
                </button>
                <button
                  className="flex items-center gap-2 py-2 px-4 text-sm text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all border-0 bg-transparent cursor-pointer w-full text-left text-muted"
                  onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                >
                  <LogOut size={16} strokeWidth={1.5} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MOBILE NAVIGATION — Full menu in hamburger dropdown       */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {user && (
        <nav ref={navRef} className={`header-nav header-nav-mobile ${mobileMenuOpen ? "header-nav-open" : ""}`} aria-label="Mobile navigation">
          <Link href="/dashboard" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-stable-m" onClick={closeMobileMenu}>
            <Home size={16} strokeWidth={1.5} /> Digital Stable
          </Link>
          <Link
            href={aliasName ? `/profile/${encodeURIComponent(aliasName)}` : "/settings"}
            className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all"
            id="nav-profile-m"
            onClick={closeMobileMenu}
          >
            <User size={16} strokeWidth={1.5} /> My Profile
          </Link>
          <Link href="/community" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-community-m" onClick={closeMobileMenu}>
            <Trophy size={16} strokeWidth={1.5} /> Show Ring
          </Link>
          <Link href="/discover" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-discover-m" onClick={closeMobileMenu}>
            <Users size={16} strokeWidth={1.5} /> Discover
          </Link>
          <Link href="/feed" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-feed-m" onClick={closeMobileMenu}>
            <Newspaper size={16} strokeWidth={1.5} /> Feed
          </Link>
          <Link href="/shows" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-shows-m" onClick={closeMobileMenu}>
            <Camera size={16} strokeWidth={1.5} /> Shows
          </Link>
          <Link href={artistSlug ? "/studio/dashboard" : "/studio/setup"} className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-studio-m" onClick={closeMobileMenu}>
            <Palette size={16} strokeWidth={1.5} /> Art Studio
          </Link>
          <Link href="/community/help-id" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-helpid-m" onClick={closeMobileMenu}>
            <Search size={16} strokeWidth={1.5} /> Help ID
          </Link>
          <Link href="/community/groups" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-groups-m" onClick={closeMobileMenu}>
            <Building2 size={16} strokeWidth={1.5} /> Groups
          </Link>
          <Link href="/community/events" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-events-m" onClick={closeMobileMenu}>
            <Calendar size={16} strokeWidth={1.5} /> Events
          </Link>
          <Link href="/catalog" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-catalog-m" onClick={closeMobileMenu}>
            <BookOpen size={16} strokeWidth={1.5} /> Catalog
          </Link>
          <Link href="/market" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-market-m" onClick={closeMobileMenu}>
            <TrendingUp size={16} strokeWidth={1.5} /> Price Guide
          </Link>
          <Link href="/wishlist" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-wishlist-m" onClick={closeMobileMenu}>
            <Heart size={16} strokeWidth={1.5} /> Wishlist
          </Link>
          <Link href="/claim" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-claim-m" onClick={closeMobileMenu}>
            <Package size={16} strokeWidth={1.5} /> Claim
          </Link>
          <Link href="/settings" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-settings-m" onClick={closeMobileMenu}>
            <Settings size={16} strokeWidth={1.5} /> Settings
          </Link>
          <Link href="/inbox" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all relative flex items-center gap-[4px]" id="nav-inbox-m" onClick={closeMobileMenu}>
            <Mail size={16} strokeWidth={1.5} />
            Inbox
            {unreadCount > 0 && (
              <span className="inbox-unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </Link>
          <NotificationBell />
          {isAdmin && (
            <Link href="/admin" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all text-[#f59e0b !important] font-bold text-xs" id="nav-admin-m" onClick={closeMobileMenu}>
              Admin <Zap size={16} strokeWidth={1.5} />
            </Link>
          )}
          {/* ── Mobile-only: Sign Out + Simple Mode ── */}
          <div className="hidden">
            <button
              className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
              onClick={() => { closeMobileMenu(); handleSignOut(); }}
              style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", width: "100%", justifyContent: "flex-start" }}
            >
              <LogOut size={16} strokeWidth={1.5} /> Sign Out
            </button>
            <button
              className="flex items-center justify-center w-[40px] h-[40px] rounded-full border border-edge bg-glass text-[var(--color-text-secondary)] cursor-pointer text-[1.2rem] transition-all relative"
              onClick={() => { toggleSimpleMode(); }}
              aria-pressed={isSimpleMode}
              style={{ justifyContent: "flex-start", gap: "var(--space-sm)", width: "100%" }}
            >
              {isSimpleMode ? <><Eye size={16} strokeWidth={1.5} /> Simple Mode: ON</> : <><EyeOff size={16} strokeWidth={1.5} /> Simple Mode: OFF</>}
            </button>
          </div>
        </nav>
      )}

      {/* ── Public Navigation (not signed in) ── */}
      {!user && (
        <nav className="sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all-nav flex flex-row items-center gap-4" aria-label="Public navigation">
          <Link href="/about" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-about">
            About
          </Link>
          <Link href="/catalog" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-catalog-public">
            📚 Catalog
          </Link>
          <Link href="/contact" className="flex items-center gap-1 py-1 px-2 text-sm font-medium text-[var(--color-text-secondary)] no-underline rounded-md whitespace-nowrap transition-all" id="nav-contact">
            Contact
          </Link>
        </nav>
      )}

      {/* ── Desktop auth actions for logged-out users ── */}
      {!user && (
        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm"
            id="header-login-button"
          >
            Log In
          </Link>
          <button
            className="flex items-center justify-center w-[40px] h-[40px] rounded-full border border-edge bg-glass text-[var(--color-text-secondary)] cursor-pointer text-[1.2rem] transition-all relative"
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
            <span className="absolute bottom-[-36px] right-0 bg-elevated text-[var(--color-text-secondary)] text-[var(--font-size-xs)] py-[4px] px-[10px] rounded-sm whitespace-nowrap opacity-0 pointer-events-none transition-opacity border border-edge">
              {isSimpleMode ? "Simple Mode: ON" : "Simple Mode: OFF"}
            </span>
          </button>
        </div>
      )}
    </header>
  );
}
