/**
 * Fire a Google Analytics 4 event. Client-only and best-effort: it no-ops on
 * the server and before gtag has loaded, and never throws into a user flow.
 *
 * GA is installed unconditionally in layout.tsx; declining cookies sets
 * `window["ga-disable-G-7DWKBT1JV9"]` (GA's official opt-out flag, see
 * CookieConsent.tsx), which GA honors globally — so this helper does not need
 * its own consent gate.
 *
 * Keep event names snake_case and stable; they become the conversion funnel in
 * GA. Currently wired: `sign_up`, `want_click` (MOVE-1 demand signal).
 */
export function track(
    event: string,
    params?: Record<string, string | number | boolean | null | undefined>,
): void {
    if (typeof window === "undefined") return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    try {
        gtag("event", event, params ?? {});
    } catch {
        // Analytics must never break a user flow.
    }
}
