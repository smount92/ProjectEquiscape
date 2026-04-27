"use client";

import Link from"next/link";
import { useSimpleMode } from"@/lib/context/SimpleModeContext";
import { createClient } from"@/lib/supabase/client";
import { useRouter, usePathname } from"next/navigation";
import { useEffect, useState, useCallback, useRef } from"react";
import NotificationBell from"@/components/NotificationBell";
import { getHeaderData } from"@/app/actions/header";
import { useNotifications } from "@/lib/context/NotificationProvider";
import {
 Home,
 Trophy,
 Newspaper,
 Users,
 Camera,
 Palette,
 Search,
 Building2,
 Calendar,
 TrendingUp,
 Heart,
 Package,
 Settings,
 User,
 Zap,
 LogOut,
 Eye,
 EyeOff,
 Mail,
 ChevronDown,
 MoreHorizontal,
 BookOpen,
 Gem,
} from"lucide-react";

// Priority-ordered nav links — highest priority first
const NAV_LINKS = [
 { href:"/dashboard", label:"Stable", Icon: Home, id:"nav-stable" },
 { href:"/community", label:"Show Ring", Icon: Trophy, id:"nav-community" },
 { href:"/feed", label:"Feed", Icon: Newspaper, id:"nav-feed" },
 { href:"/discover", label:"Discover", Icon: Users, id:"nav-discover" },
 { href:"/shows", label:"Shows", Icon: Camera, id:"nav-shows" },
 { href:"/market", label:"Market", Icon: TrendingUp, id:"nav-market" },
 { href:"/community/groups", label:"Groups", Icon: Building2, id:"nav-groups" },
 { href:"/community/events", label:"Events", Icon: Calendar, id:"nav-events" },
 { href:"/community/help-id", label:"Help ID", Icon: Search, id:"nav-helpid" },
 { href:"/catalog", label:"Catalog", Icon: BookOpen, id:"nav-catalog" },
];

// Dynamic link that depends on artist slug
const getStudioLink = (artistSlug: string | null) => ({
 href: artistSlug ?"/studio/dashboard" :"/studio/setup",
 label:"Art Studio",
 Icon: Palette,
 id:"nav-studio",
});

export default function Header() {
 const { isSimpleMode, toggleSimpleMode } = useSimpleMode();
 // Immediately check localStorage for auth token to prevent flash
 const [user, setUser] = useState<{ id: string; email?: string } | null>(() => {
 if (typeof window !=="undefined") {
 const storageKey = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
 if (storageKey) {
 try {
 const stored = JSON.parse(localStorage.getItem(storageKey) ||"{}");
 if (stored?.user?.id) return { id: stored.user.id, email: stored.user.email };
 } catch {
 /* ignore */
 }
 }
 }
 return null;
 });
 const { unreadMessages } = useNotifications();
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
 setIsAdmin(data.isAdmin ?? false);
 setArtistSlug(data.artistStudioSlug ?? null);
 } catch {
 // Silently fail if server action throws
 }
 }, []);

 useEffect(() => {
 const initAuth = async () => {
 const {
 data: { session },
 } = await supabase.auth.getSession();
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
 // Force Next.js to re-run server components so the
 // server-side cookie is read by getHeaderData()
 router.refresh();
 fetchHeaderInfo();
 } else {
 setUser(null);
 setAliasName(null);
 setAvatarUrl(null);
 setIsAdmin(false);
 setArtistSlug(null);
 }
 });

 return () => subscription.unsubscribe();
 }, [supabase, fetchHeaderInfo, router]);



 const handleSignOut = () => {
 supabase.auth.signOut().catch(() => {});
 window.location.href ="/login";
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
 // eslint-disable-next-line react-hooks/set-state-in-effect
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

 // Close"More" menu on outside click
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
 const moreButtonWidth = 80; // reserve space for"More" button

 for (const child of children) {
 if (child.dataset.navItem !=="true") continue;
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
 const overflowLinks = allLinks.slice(visibleCount);

 return (
 <header
 className="sticky top-0 z-[100] flex h-[var(--header-height)] items-center justify-between border-b border-edge bg-[#EAE1CD]/90 px-8 py-0 backdrop-blur-md transition-all max-sm:px-4"
 role="banner"
 >
 <Link
 href={user ?"/dashboard" :"/"}
 className="text-foreground mr-6 flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-[-0.02em] no-underline"
 aria-label="Model Horse Hub — Home"
 >
 <span className="text-[1.5em]" aria-hidden="true">
 🐴
 </span>
 <span className="hidden md:inline">Model Horse Hub</span>
 <span className="md:hidden">MHH</span>
 </Link>

 {/* ── Hamburger Button (mobile only) ── */}
 {user && (
 <button
 className="relative hidden max-md:flex h-[40px] w-[40px] cursor-pointer items-center justify-center rounded-md border border-edge bg-transparent text-muted-foreground transition-all"
 onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
 aria-label={mobileMenuOpen ?"Close menu" :"Open menu"}
 aria-expanded={mobileMenuOpen ? "true" : "false"}
 >
 {unreadMessages > 0 && !mobileMenuOpen && (
 <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadMessages > 9 ? "9+" : unreadMessages}</span>
 )}
 {mobileMenuOpen ? (
 <svg
 width="20"
 height="20"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <line x1="18" y1="6" x2="6" y2="18" />
 <line x1="6" y1="6" x2="18" y2="18" />
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
 >
 <line x1="3" y1="6" x2="21" y2="6" />
 <line x1="3" y1="12" x2="21" y2="12" />
 <line x1="3" y1="18" x2="21" y2="18" />
 </svg>
 )}
 </button>
 )}

 {/* ═══════════════════════════════════════════════════════════ */}
 {/* DESKTOP NAVIGATION — Priority+ progressive collapse */}
 {/* ═══════════════════════════════════════════════════════════ */}
 {user && (
 <div className="hidden md:flex min-w-0 flex-1 items-center justify-end gap-4">
 {/* Primary text links — measured by ResizeObserver */}
 <nav
 className="relative flex min-w-0 flex-1 items-center gap-[2px] overflow-hidden"
 aria-label="Main navigation"
 ref={primaryNavRef}
 >
 {allLinks.map((link, i) => (
 <Link
 key={link.id}
 href={link.href}
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id={link.id}
 data-nav-item="true"
 style={
 i >= visibleCount
 ? { position:"absolute", visibility:"hidden", pointerEvents:"none" }
 : undefined
 }
 >
 <link.Icon size={16} strokeWidth={1.5} /> {link.label}
 </Link>
 ))}
 </nav>

 {/*"More" dropdown for overflow items */}
 {hasOverflow && (
 <div className="relative shrink-0" ref={moreMenuRef}>
 <button
 className="flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 py-1 font-[inherit] text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 onClick={() => setMoreMenuOpen(!moreMenuOpen)}
 aria-expanded={moreMenuOpen ? "true" : "false"}
 aria-label="More navigation links"
 >
 <MoreHorizontal size={16} strokeWidth={1.5} /> More
 <ChevronDown size={12} strokeWidth={2} className="ml-[2]" />
 </button>
 {moreMenuOpen && (
 <div className="absolute right-0 top-[calc(100%+8px)] z-[200] flex min-w-[200px] flex-col rounded-lg border border-edge bg-[#FEFCF8] p-1 shadow-lg">
 {overflowLinks.map((link) => (
 <Link
 key={link.id}
 href={link.href}
 className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-2 text-left text-sm whitespace-nowrap text-muted-foreground no-underline transition-all"
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
 <Link
 href="/inbox"
 className="bg-[#FEFCF8] border-edge relative flex h-[36px] w-[36px] items-center justify-center rounded-full border text-base text-muted-foreground no-underline transition-all"
 title="Inbox"
 id="nav-inbox-icon"
 >
 <svg
 width="18"
 height="18"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
 <polyline points="22,6 12,13 2,6" />
 </svg>
 {unreadMessages > 0 && (
 <span className="inbox-unread-badge">{unreadMessages > 9 ?"9+" : unreadMessages}</span>
 )}
 </Link>
 <Link
 href="/wishlist"
 className="bg-[#FEFCF8] border-edge relative flex h-[36px] w-[36px] items-center justify-center rounded-full border text-base text-muted-foreground no-underline transition-all"
 title="Wishlist"
 id="nav-wishlist-icon"
 >
 <Heart size={18} strokeWidth={1.5} />
 </Link>
 </div>

 {/* User menu dropdown */}
 <div className="relative" ref={userMenuRef}>
 <button
 className="flex cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent p-1 transition-all"
 onClick={() => setUserMenuOpen(!userMenuOpen)}
 aria-expanded={userMenuOpen ? "true" : "false"}
 aria-label="User menu"
 >
 <span className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[rgb(245_245_244)] font-bold text-muted-foreground">
 {avatarUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={avatarUrl}
 alt={aliasName ||"User"}
 width={32}
 height={32}
 className="h-[32px] w-[32px] rounded-full object-cover"
 referrerPolicy="no-referrer"
 />
 ) : aliasName ? (
 aliasName.charAt(0).toUpperCase()
 ) : (
"U"
 )}
 </span>
 <svg
 width="12"
 height="12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 className={`header-chevron ${userMenuOpen ?"header-chevron-open" :""}`}
 >
 <polyline points="6 9 12 15 18 9" />
 </svg>
 </button>
 {userMenuOpen && (
 <div className="absolute right-0 top-[calc(100%+8px)] z-[200] flex min-w-[200px] flex-col rounded-lg border border-edge bg-[#FEFCF8] p-1 shadow-lg">
 <Link
 href={aliasName ? `/profile/${encodeURIComponent(aliasName)}` :"/settings"}
 className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-2 text-left text-sm whitespace-nowrap text-muted-foreground no-underline transition-all"
 onClick={() => setUserMenuOpen(false)}
 >
 <User size={16} strokeWidth={1.5} /> My Profile
 </Link>
 <Link
 href="/settings"
 className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-2 text-left text-sm whitespace-nowrap text-muted-foreground no-underline transition-all"
 onClick={() => setUserMenuOpen(false)}
 >
 <Settings size={16} strokeWidth={1.5} /> Settings
 </Link>
 <Link
 href="/claim"
 className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-2 text-left text-sm whitespace-nowrap text-muted-foreground no-underline transition-all"
 onClick={() => setUserMenuOpen(false)}
 >
 <Package size={16} strokeWidth={1.5} /> Claim
 </Link>
 <Link
 href="/studio/my-commissions"
 className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-2 text-left text-sm whitespace-nowrap text-muted-foreground no-underline transition-all"
 onClick={() => setUserMenuOpen(false)}
 >
 <Palette size={16} strokeWidth={1.5} /> My Commissions
 </Link>
 {isAdmin && (
 <Link
 href="/admin"
 className="text-forest flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-2 text-left text-sm whitespace-nowrap text-muted-foreground no-underline transition-all"
 onClick={() => setUserMenuOpen(false)}
 >
 <Zap size={16} strokeWidth={1.5} /> Admin
 </Link>
 )}
 <Link
  href="/upgrade"
  className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-2 text-left text-sm whitespace-nowrap text-amber-600 no-underline transition-all hover:bg-amber-50"
  onClick={() => setUserMenuOpen(false)}
 >
  <Gem size={16} strokeWidth={1.5} /> Upgrade to Pro
 </Link>
 <div className="mx-1 my-1 h-px bg-edge" />
 <button
 className="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-2 text-left text-sm whitespace-nowrap text-muted-foreground no-underline transition-all"
 onClick={() => {
 setUserMenuOpen(false);
 toggleSimpleMode();
 }}
 >
 {isSimpleMode ? (
 <>
 <Eye size={16} strokeWidth={1.5} /> Simple Mode: ON
 </>
 ) : (
 <>
 <EyeOff size={16} strokeWidth={1.5} /> Simple Mode
 </>
 )}
 </button>
 <button
 className="text-muted-foreground flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-4 py-2 text-left text-sm whitespace-nowrap text-muted-foreground no-underline transition-all"
 onClick={() => {
 setUserMenuOpen(false);
 handleSignOut();
 }}
 >
 <LogOut size={16} strokeWidth={1.5} /> Sign Out
 </button>
 </div>
 )}
 </div>
 </div>
 )}

 {/* ═══════════════════════════════════════════════════════════ */}
 {/* MOBILE NAVIGATION — Full menu in hamburger dropdown */}
 {/* ═══════════════════════════════════════════════════════════ */}
 {user && (
 <nav
 ref={navRef}
 className={`absolute left-0 top-[var(--header-height)] z-[150] flex w-full flex-col gap-1 border-b border-edge bg-[#EAE1CD] px-4 py-3 shadow-lg transition-all md:hidden ${mobileMenuOpen ?"" :"hidden"}`}
 aria-label="Mobile navigation"
 >
 <Link
 href="/dashboard"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-stable-m"
 onClick={closeMobileMenu}
 >
 <Home size={16} strokeWidth={1.5} /> Digital Stable
 </Link>
 <Link
 href={aliasName ? `/profile/${encodeURIComponent(aliasName)}` :"/settings"}
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-profile-m"
 onClick={closeMobileMenu}
 >
 <User size={16} strokeWidth={1.5} /> My Profile
 </Link>
 <Link
 href="/community"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-community-m"
 onClick={closeMobileMenu}
 >
 <Trophy size={16} strokeWidth={1.5} /> Show Ring
 </Link>
 <Link
 href="/discover"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-discover-m"
 onClick={closeMobileMenu}
 >
 <Users size={16} strokeWidth={1.5} /> Discover
 </Link>
 <Link
 href="/feed"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-feed-m"
 onClick={closeMobileMenu}
 >
 <Newspaper size={16} strokeWidth={1.5} /> Feed
 </Link>
 <Link
 href="/shows"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-shows-m"
 onClick={closeMobileMenu}
 >
 <Camera size={16} strokeWidth={1.5} /> Shows
 </Link>
 <Link
 href={artistSlug ?"/studio/dashboard" :"/studio/setup"}
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-studio-m"
 onClick={closeMobileMenu}
 >
 <Palette size={16} strokeWidth={1.5} /> Art Studio
 </Link>
 <Link
 href="/community/help-id"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-helpid-m"
 onClick={closeMobileMenu}
 >
 <Search size={16} strokeWidth={1.5} /> Help ID
 </Link>
 <Link
 href="/community/groups"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-groups-m"
 onClick={closeMobileMenu}
 >
 <Building2 size={16} strokeWidth={1.5} /> Groups
 </Link>
 <Link
 href="/community/events"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-events-m"
 onClick={closeMobileMenu}
 >
 <Calendar size={16} strokeWidth={1.5} /> Events
 </Link>
 <Link
 href="/catalog"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-catalog-m"
 onClick={closeMobileMenu}
 >
 <BookOpen size={16} strokeWidth={1.5} /> Catalog
 </Link>
 <Link
 href="/market"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-market-m"
 onClick={closeMobileMenu}
 >
 <TrendingUp size={16} strokeWidth={1.5} /> Price Guide
 </Link>
 <Link
 href="/wishlist"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-wishlist-m"
 onClick={closeMobileMenu}
 >
 <Heart size={16} strokeWidth={1.5} /> Wishlist
 </Link>
 <Link
 href="/claim"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-claim-m"
 onClick={closeMobileMenu}
 >
 <Package size={16} strokeWidth={1.5} /> Claim
 </Link>
 <Link
 href="/settings"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-settings-m"
 onClick={closeMobileMenu}
 >
 <Settings size={16} strokeWidth={1.5} /> Settings
 </Link>
 <Link
 href="/inbox"
 className="relative flex items-center gap-1 gap-[4px] rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-inbox-m"
 onClick={closeMobileMenu}
 >
 <Mail size={16} strokeWidth={1.5} />
 Inbox
 {unreadMessages > 0 && (
 <span className="inbox-unread-badge">{unreadMessages > 9 ?"9+" : unreadMessages}</span>
 )}
 </Link>
 <NotificationBell />
 {isAdmin && (
 <Link
 href="/admin"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold whitespace-nowrap text-[#f59e0b] no-underline transition-all"
 id="nav-admin-m"
 onClick={closeMobileMenu}
 >
 Admin <Zap size={16} strokeWidth={1.5} />
 </Link>
 )}
 {/* ── Mobile-only: Upgrade + Sign Out + Simple Mode ── */}
 <div className="mt-2 flex flex-col gap-1 border-t border-edge pt-2">
 <Link
  href="/upgrade"
  className="flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-50 to-orange-50 px-2 py-1.5 text-sm font-semibold whitespace-nowrap text-amber-700 no-underline transition-all"
  id="nav-upgrade-m"
  onClick={closeMobileMenu}
 >
  <Gem size={16} strokeWidth={1.5} /> 💎 Upgrade to Pro
 </Link>
 <button
 className="flex w-full cursor-pointer items-center justify-start gap-2 rounded-md border-0 bg-transparent px-2 py-1 text-left text-sm text-muted-foreground transition-all"
 onClick={() => {
 closeMobileMenu();
 handleSignOut();
 }}
 >
 <LogOut size={16} strokeWidth={1.5} /> Sign Out
 </button>
 <button
 className="border-edge bg-[#FEFCF8] relative flex h-auto w-full cursor-pointer items-center justify-start gap-2 rounded-full border px-2 py-1 text-sm text-muted-foreground transition-all"
 onClick={() => toggleSimpleMode()}
 aria-pressed={isSimpleMode ? "true" : "false"}
 >
 {isSimpleMode ? (
 <>
 <Eye size={16} strokeWidth={1.5} /> Simple Mode: ON
 </>
 ) : (
 <>
 <EyeOff size={16} strokeWidth={1.5} /> Simple Mode: OFF
 </>
 )}
 </button>
 </div>
 </nav>
 )}

 {/* ── Public Navigation (not signed in) ── */}
 {!user && (
 <nav
 className="flex flex-row items-center gap-4"
 aria-label="Public navigation"
 >
 <Link
 href="/about"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-about"
 >
 About
 </Link>
 <Link
 href="/catalog"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-catalog-public"
 >
 📚 Catalog
 </Link>
 <Link
 href="/contact"
 className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground no-underline transition-all"
 id="nav-contact"
 >
 Contact
 </Link>
 </nav>
 )}

 {/* ── Desktop auth actions for logged-out users ── */}
 {!user && (
 <div className="flex shrink-0 items-center gap-4">
 <Link
 href="/login"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 id="header-login-button"
 >
 Log In
 </Link>
 <button
 className="border-edge bg-[#FEFCF8] relative flex h-[40px] w-[40px] cursor-pointer items-center justify-center rounded-full border text-[1.2rem] text-muted-foreground transition-all"
 onClick={toggleSimpleMode}
 aria-pressed={isSimpleMode ? "true" : "false"}
 aria-label={
 isSimpleMode
 ?"Disable Simple Mode (high contrast and large text)"
 :"Enable Simple Mode (high contrast and large text)"
 }
 title={isSimpleMode ?"Simple Mode: ON" :"Simple Mode: OFF"}
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
 <span className="bg-[#FEFCF8] border-edge pointer-events-none absolute right-0 bottom-[-36px] rounded-sm border px-[10px] py-[4px] whitespace-nowrap text-muted-foreground text-[var(--font-size-xs)] opacity-0 transition-opacity">
 {isSimpleMode ?"Simple Mode: ON" :"Simple Mode: OFF"}
 </span>
 </button>
 </div>
 )}
 </header>
 );
}
