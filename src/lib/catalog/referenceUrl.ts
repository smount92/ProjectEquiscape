/**
 * Public reference-page URLs — `/reference/[maker]/[slug]`.
 *
 * `slugify` mirrors the SQL `catalog_slugify()` (migration 129) exactly so
 * app-generated links resolve against the DB-stored `maker_slug`/`slug`.
 * The stored slugs are authoritative; `referenceHref` prefers them and only
 * falls back to slugifying maker/title (or the id) when they're absent.
 */

// Same accent map as the SQL translate() in migration 129 (lowercase source).
const ACCENTS_FROM = "àáâãäåāăąçćèéêëēĕėęěìíîïĩīñòóôõöøōðšśßùúûüũūýÿžźżþ";
const ACCENTS_TO = "aaaaaaaaaccceeeeeeeeeiiiiiinoooooooodsssuuuuuuyyzzzt";
const ACCENT_MAP: Record<string, string> = {};
for (let i = 0; i < ACCENTS_FROM.length; i++) ACCENT_MAP[ACCENTS_FROM[i]] = ACCENTS_TO[i];

/** Lowercase → strip accents → non-alphanumeric to `-` → trim. */
export function slugify(input: string | null | undefined): string {
  const lowered = (input ?? "").toLowerCase();
  let mapped = "";
  for (const ch of lowered) mapped += ACCENT_MAP[ch] ?? ch;
  return mapped.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export interface ReferenceLinkable {
  id: string;
  maker: string | null;
  title: string | null;
  maker_slug?: string | null;
  slug?: string | null;
}

/**
 * Build the canonical reference href for a catalog item. Prefers the stored
 * slugs; falls back to slugifying maker/title, then to a short id, so a link
 * always resolves even before the backfill/gen-types has run everywhere.
 */
export function referenceHref(item: ReferenceLinkable): string {
  const makerSlug = item.maker_slug || slugify(item.maker) || "unknown";
  const slug =
    item.slug ||
    slugify(item.title) ||
    `item-${item.id.slice(0, 8)}`;
  return `/reference/${makerSlug}/${slug}`;
}
