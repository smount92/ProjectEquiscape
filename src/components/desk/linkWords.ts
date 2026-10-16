import type { DeskLinks } from "@/app/actions/registry-desk";

const WORDS: Record<string, [string, string]> = {
    horses: ["horse in a member's stable", "horses in members' stables"],
    want_lists: ["want list", "want lists"],
    children: ["release filed under it", "releases filed under it"],
    id_suggestions: ["ID-help answer", "ID-help answers"],
    pending_suggestions: ["open suggestion", "open suggestions"],
    sale_reports: ["sale report", "sale reports"],
    price_flags: ["price flag", "price flags"],
    set_pieces: ["set piece that names it", "set pieces that name it"],
};

/** "2 horses in members' stables, 1 want list" — only the kinds that are there. */
export function linkWords(links: DeskLinks | Record<string, number> | null | undefined): string[] {
    if (!links) return [];
    return Object.entries(links as unknown as Record<string, number>)
        .filter(([, n]) => typeof n === "number" && n > 0)
        .map(([k, n]) => {
            const [one, many] = WORDS[k] ?? [k.replace(/_/g, " "), k.replace(/_/g, " ")];
            return `${n} ${n === 1 ? one : many}`;
        });
}
