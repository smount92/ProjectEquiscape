"use client";

import { useState, useEffect, useCallback } from"react";
import Link from"next/link";
import { createClient } from"@/lib/supabase/client";

export default function NotificationBell() {
 const [unreadCount, setUnreadCount] = useState(0);
 const supabase = createClient();

 const fetchCount = useCallback(async () => {
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) return;

 const { count } = await supabase
 .from("notifications")
 .select("id", { count:"exact", head: true })
 .eq("user_id", user.id)
 .eq("is_read", false);

 setUnreadCount(count ?? 0);
 }, [supabase]);

 useEffect(() => {
 // Fetch immediately on mount
 fetchCount();

 let intervalId: ReturnType<typeof setInterval> | null = null;

 const startPolling = () => {
  if (!intervalId) {
   intervalId = setInterval(fetchCount, 60_000);
  }
 };

 const stopPolling = () => {
  if (intervalId) {
   clearInterval(intervalId);
   intervalId = null;
  }
 };

 const handleVisibility = () => {
  if (document.visibilityState === "visible") {
   fetchCount(); // Immediate fetch when user returns
   startPolling();
  } else {
   stopPolling();
  }
 };

 // Only poll if tab is visible
 if (document.visibilityState === "visible") {
  startPolling();
 }

 document.addEventListener("visibilitychange", handleVisibility);

 return () => {
  stopPolling();
  document.removeEventListener("visibilitychange", handleVisibility);
 };
 }, [fetchCount]);

 return (
 <Link
 href="/notifications"
 className="relative flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-[var(--color-text-secondary)] no-underline transition-all"
 id="nav-notifications"
 title="Notifications"
 >
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
 <path d="M13.73 21a2 2 0 0 1-3.46 0" />
 </svg>
 {unreadCount > 0 && (
 <span className="absolute -top-1 -right-1.5 h-4 min-w-[16px] animate-[notification-pop_0.3s_ease-out] rounded-lg bg-[#ef4444] px-1 text-center text-[10px] leading-4 font-bold text-white">
 {unreadCount > 9 ?"9+" : unreadCount}
 </span>
 )}
 </Link>
 );
}
