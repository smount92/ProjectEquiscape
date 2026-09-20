/**
 * The glyph a work entry wears on the Hoofprint rail. Every work record
 * used to get ✂️, so a repair looked like a body mod. The work type is
 * free text at the edges (older records) and a service label from
 * lib/studio/services in the middle, so match on words, not equality.
 */
export function workEventIcon(workType: string | null | undefined): string {
    const t = (workType ?? "").toLowerCase();
    if (!t) return "✂️";
    if (/repair|restor|touch-up|touch up/.test(t)) return "🔧";
    if (/prep/.test(t)) return "🪚";
    if (/finish|paint|china|drybrush/.test(t)) return "🎨";
    if (/hair|mane|tail/.test(t)) return "💇";
    if (/tack|halter|saddle|bridle/.test(t)) return "🪢";
    if (/doll|rider/.test(t)) return "🧍";
    return "✂️";
}
