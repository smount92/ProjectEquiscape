import type { Metadata } from "next";

import SettingsClient from "./SettingsClient";

/**
 * /settings — thin server shell.
 *
 * The page itself is a client component (it loads the profile through
 * getProfile on mount, exactly as before). Splitting the shell off buys
 * the one thing a "use client" page cannot have: metadata, including the
 * noindex a personal config page has always needed and never had.
 */
export const metadata: Metadata = {
    title: "Settings",
    description: "Manage your profile, notifications, privacy defaults and account.",
    robots: { index: false, follow: false },
};

export default function SettingsPage() {
    return <SettingsClient />;
}
