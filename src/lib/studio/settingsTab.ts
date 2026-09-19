/**
 * The studio settings tabs, shared by the server page (which reads
 * ?tab=) and the client form (which shows it).
 *
 * This used to live in the client component and be called from the
 * server page; Next refuses to call a client-module function on the
 * server, so /studio/setup threw "This page didn't load" for every
 * artist from 2026-09-18 to 2026-09-19.
 */
export type SettingsTab = "studio" | "rates" | "terms";

/** ?tab=rates|terms|studio → a tab; anything else opens the identity tab. */
export function tabFromParam(value: string | undefined | null): SettingsTab {
    return value === "rates" || value === "terms" ? value : "studio";
}
