/**
 * "Come back to the card you left." When a member opens a horse from the
 * stable and comes back, the stable should put that horse's card in
 * front of them — not the top of the page (member report, 2026-10-12).
 *
 * Pure: given where the reader just came from (the nav trail's `from`,
 * which survives a Back) or, failing that, the trail itself, and the
 * horse ids on the page being shown, name the card to scroll to — or
 * null. Never a card that is not on this page.
 */

import { pathOf, trailPrevious } from "@/lib/nav/trail";

const PASSPORT_RE =
    /^\/stable\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/edit)?\/?$/i;

/** The horse id of a passport (/stable/<uuid>) or its edit page; null for anything else. */
export function passportHorseId(url: string | null | undefined): string | null {
    if (!url) return null;
    const m = PASSPORT_RE.exec(pathOf(url));
    return m ? m[1].toLowerCase() : null;
}

/**
 * The card to bring back into view.
 *
 * `from` is the page the reader was on immediately before this one
 * (NavTrail records it on every push and history move). When it is
 * known it decides alone — a member who came here from the Market must
 * not be scrolled to a horse they opened three pages ago. Only when it
 * is unknown does the trail's previous entry stand in.
 */
export function returnToCardId({
    trail,
    from,
    ids,
}: {
    trail: readonly string[];
    from?: string | null;
    ids: readonly string[];
}): string | null {
    const source = from ?? trailPrevious(trail);
    const id = passportHorseId(source);
    if (!id) return null;
    // Hand back the page's own spelling of the id: it is what the card's DOM id uses.
    return ids.find((x) => x.toLowerCase() === id) ?? null;
}
