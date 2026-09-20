"use client";

import { useLayoutEffect } from "react";

import { NOT_FOUND_ATTR } from "@/lib/notFoundPage";

/**
 * Rendered by app/not-found.tsx. Marks the document as a not-found page
 * before any layout-level effect runs (layout effects of children fire
 * before parents' passive effects), so the header and the notification
 * provider can skip their server-action calls.
 *
 * Why: a server action POSTs to the current URL; on a 404 route Next
 * answers with the HTML 404, the client treats that as a stale page and
 * hard-reloads, the layout mounts again, calls the action again — and a
 * signed-in visitor on a mistyped URL reloaded the page forever
 * (2026-09-19).
 */
export default function NotFoundMarker() {
    useLayoutEffect(() => {
        document.documentElement.setAttribute(NOT_FOUND_ATTR, "1");
        return () => document.documentElement.removeAttribute(NOT_FOUND_ATTR);
    }, []);
    return null;
}
