import Link from "next/link";
import { referenceHref, type ReferenceLinkable } from "@/lib/catalog/referenceUrl";

/**
 * RegistryLink — the one way a catalog item's name links to its
 * Registry (reference) page.
 *
 * Wherever the site NAMES a catalog entry, the name should be a door,
 * not a label — the passport was showing "A Class Act" as dead text
 * while the Registry entry with values, photos and eBay signals sat
 * one URL away (Amanda's feedback, 2026-08-27). Use this instead of
 * ad-hoc <Link>s so the affordance stays consistent everywhere.
 */
export default function RegistryLink({
    item,
    className,
    children,
}: {
    item: ReferenceLinkable;
    className?: string;
    children?: React.ReactNode;
}) {
    return (
        <Link
            href={referenceHref(item)}
            className={className ?? "text-forest decoration-forest/40 hover:decoration-forest underline underline-offset-2"}
        >
            {children ?? item.title}
        </Link>
    );
}
