import { redirect } from "next/navigation";

/**
 * /stable has no page of its own — the stable IS the dashboard — but it
 * is the most natural URL to type, and every link on the site to a
 * horse starts with it. It used to 404 (2026-09-19).
 */
export default function StableIndex() {
    redirect("/dashboard");
}
