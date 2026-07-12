import { redirect } from "next/navigation";

/**
 * `/reference` has no index of its own — the catalog IS the browse surface.
 * Send visitors (and any stray crawler) straight there.
 */
export default function ReferenceIndex() {
    redirect("/catalog");
}
