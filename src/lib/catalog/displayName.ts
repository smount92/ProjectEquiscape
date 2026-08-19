/**
 * Compose "Maker Title" for display WITHOUT doubling the maker when
 * the title already carries it (user report: a Hoofprint entry read
 * "North Light North Light Quarter Horse" — community-suggested
 * titles often arrive with the maker baked in, and every composition
 * site was blindly prepending).
 */
export function catalogDisplayName(
    maker: string | null | undefined,
    title: string | null | undefined,
    separator = " ",
): string {
    const t = (title ?? "").trim();
    const m = (maker ?? "").trim();
    if (!m) return t;
    if (!t) return m;
    if (t.toLowerCase().startsWith(m.toLowerCase())) return t;
    return `${m}${separator}${t}`;
}
