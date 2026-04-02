"use client";

import Link from "next/link";
import { useNotifications } from "@/lib/context/NotificationProvider";

export default function NotificationBell() {
 const { unreadNotifications } = useNotifications();

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
 {unreadNotifications > 0 && (
 <span className="absolute -top-1 -right-1.5 h-4 min-w-[16px] animate-[notification-pop_0.3s_ease-out] rounded-lg bg-[#ef4444] px-1 text-center text-[10px] leading-4 font-bold text-white">
 {unreadNotifications > 9 ? "9+" : unreadNotifications}
 </span>
 )}
 </Link>
 );
}
