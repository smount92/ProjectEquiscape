/**
 * Neutralize a user-supplied search term before it is interpolated into a
 * PostgREST `.or()` / `.ilike()` filter string.
 *
 * A PostgREST filter looks like `column.ilike.%value%`, and multiple conditions
 * are comma-separated inside `.or("a.ilike.%x%,b.ilike.%y%")`. If the raw value
 * contains `,` or `(` `)` it breaks out of its slot and injects new filter
 * conditions; `%` `*` `\` are LIKE wildcards/escape that let a term balloon into
 * an unbounded scan. We strip all of those and collapse the resulting
 * whitespace. Everything a real model name contains — letters, digits, spaces,
 * hyphens, apostrophes, `&`, `#`, `/` — passes through untouched.
 *
 * Row access is still governed by RLS; this is defense-in-depth against filter
 * injection and wildcard-abuse, and keeps the search results predictable.
 */
export function sanitizeForOr(q: string): string {
    return q.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim();
}
