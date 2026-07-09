"use client";

import { useEffect, useState } from "react";

/**
 * Lamplight night-mode toggle — a design-preview affordance.
 *
 * Floating brass pill (bottom-right) that flips the site between
 * daylight and "the tack room by lamplight" by stamping
 * html[data-theme="night"] and persisting the choice to
 * localStorage("mhh-theme"). A tiny inline script in the root layout
 * <head> re-stamps the attribute before first paint so there is no
 * flash of daylight on reload.
 *
 * Explicit toggle only — deliberately does NOT follow
 * prefers-color-scheme while this is a preview. Self-contained so it
 * can be relocated into the user menu later.
 */
export default function ThemeToggle() {
  const [night, setNight] = useState(false);

  // The inline head script stamps data-theme before hydration; sync
  // React state to it after mount (server HTML always renders "day").
  useEffect(() => {
    setNight(document.documentElement.dataset.theme === "night");
  }, []);

  function toggle() {
    const next = !night;
    setNight(next);
    document.documentElement.dataset.theme = next ? "night" : "";
    try {
      localStorage.setItem("mhh-theme", next ? "night" : "day");
    } catch {
      /* private browsing / storage disabled — theme just won't persist */
    }
  }

  return (
    <button
      type="button"
      className="lamplight-toggle"
      onClick={toggle}
      aria-pressed={night}
      aria-label={night ? "Switch to daylight theme" : "Switch to lamplight night theme"}
    >
      {night ? "☀️ Daylight" : "🌙 Lamplight"}
    </button>
  );
}
