import { fieldTitle, placingWithField } from "@/lib/records/placingLine";

/**
 * A horse's result as text — "3rd of 12" — wherever one is shown.
 * Server- and client-safe (no state); the wording lives in
 * lib/records/placingLine so every surface says the same thing.
 */
export default function PlacingText({
    placing,
    totalEntries,
    fallback = null,
    className,
}: {
    placing: string | null | undefined;
    totalEntries?: unknown;
    /** What to say when there is no placing ("Shown"); null renders nothing. */
    fallback?: string | null;
    className?: string;
}) {
    const text = placingWithField(placing, totalEntries) ?? fallback;
    if (!text) return null;
    return (
        <span className={className} title={placing ? fieldTitle(totalEntries) : undefined}>
            {text}
        </span>
    );
}
